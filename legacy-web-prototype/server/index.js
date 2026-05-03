import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { z } from "zod";
import { buildAvailability } from "./availability.js";
import { config, isInsideBlueZone, isInsideServiceArea } from "./config.js";
import { buildDemoSpots } from "./demoData.js";
import { createSpotRepository } from "./repositories/spotsRepository.js";
import { getOrCreateSession, publicUser, requireSession } from "./auth.js";
import { errorHandler, notFound } from "./middleware/errors.js";

const spotSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().max(5000).optional(),
});

const demoSpotSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

const repository = await createSpotRepository();
const app = express();

app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "32kb" }));
app.use(
  "/api",
  rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    storage: config.mongoUri ? "mongodb" : "file",
    now: new Date().toISOString(),
  });
});

app.get("/api/config", (req, res) => {
  res.json({
    mapProvider: "openstreetmap",
    mapCenter: config.mapCenter,
    spotTtlSeconds: config.spotTtlMs / 1000,
    cooldownSeconds: config.cooldownMs / 1000,
    updateIntervalSeconds: config.updateIntervalMs / 1000,
    blueZoneSmsNumber: config.blueZoneSmsNumber,
    blueZoneCode: config.blueZoneCode,
    blueZoneGeoJson: config.blueZoneGeoJson,
    serviceBounds: config.serviceBounds,
  });
});

app.post("/api/auth/anonymous", (req, res) => {
  const user = getOrCreateSession(req, res);
  res.json({ user: publicUser(user) });
});

app.get("/api/me", requireSession, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.get("/api/spots", async (req, res, next) => {
  try {
    await repository.cleanupExpired();
    const spots = await repository.listActive();
    res.json({
      ...buildAvailability(spots),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/demo/spots", (req, res, next) => {
  try {
    const parsed = demoSpotSchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({ error: "Send valid demo latitude and longitude values." });
      return;
    }

    const spots = buildDemoSpots(parsed.data);
    res.json({
      demo: true,
      ...buildAvailability(spots),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/spots", requireSession, async (req, res, next) => {
  try {
    const parsed = spotSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Send a valid latitude and longitude." });
      return;
    }

    const { latitude, longitude, accuracy } = parsed.data;
    if (!isInsideServiceArea(latitude, longitude)) {
      res.status(422).json({ error: "This location is outside the Varna parking area." });
      return;
    }

    if (!isInsideBlueZone(latitude, longitude)) {
      res.status(422).json({ error: "This signal is outside the paid parking zone." });
      return;
    }

    const duplicateSince = new Date(Date.now() - config.duplicateWindowMs);
    const duplicateNearby = await repository.hasNearbyRecentByUser(
      req.user.id,
      latitude,
      longitude,
      duplicateSince,
      config.duplicateDistanceMeters,
    );

    if (duplicateNearby) {
      const spots = await repository.listActive();
      res.status(202).json({
        ignoredDuplicate: true,
        message: "This nearby report is already counted.",
        ...buildAvailability(spots),
        generatedAt: new Date().toISOString(),
      });
      return;
    }

    const since = new Date(Date.now() - config.cooldownMs);
    const recentReports = await repository.countRecentByUser(req.user.id, since);
    if (recentReports > 0) {
      const retryAfterSeconds = Math.ceil(config.cooldownMs / 1000);
      res
        .status(429)
        .set("Retry-After", String(retryAfterSeconds))
        .json({
          error: "Please wait before reporting another free spot.",
          retryAfterSeconds,
        });
      return;
    }

    const spot = await repository.create({
      userId: req.user.id,
      latitude,
      longitude,
      accuracy,
    });
    const spots = await repository.listActive();

    res.status(201).json({
      spot,
      ...buildAvailability(spots),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

app.use("/api", notFound);

if (fs.existsSync(config.distDir)) {
  app.use(express.static(config.distDir));
  app.get("*", (req, res) => {
    res.sendFile(path.join(config.distDir, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res
      .status(200)
      .type("text/plain")
      .send("Varna Parking API is running. Use npm run dev for the React app.");
  });
}

app.use(errorHandler);

const server = app.listen(config.port, () => {
  const storage = config.mongoUri ? "MongoDB" : "local JSON";
  console.log(`Varna Parking API listening on http://localhost:${config.port}`);
  console.log(`Storage: ${storage}`);
  if (config.isProduction && !process.env.SESSION_SECRET) {
    console.warn("SESSION_SECRET is not set. Configure it before deploying.");
  }
});

const cleanupTimer = setInterval(() => {
  repository.cleanupExpired().catch((error) => {
    console.error("Failed to clean expired spots", error);
  });
}, 60 * 1000);
cleanupTimer.unref();

async function shutdown() {
  clearInterval(cleanupTimer);
  server.close(async () => {
    await repository.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
