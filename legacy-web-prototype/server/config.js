import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const isProduction = process.env.NODE_ENV === "production";

const blueZoneGeoJson = {
  type: "Feature",
  properties: {
    name: "Varna Blue Zone",
    kind: "paid-parking-zone",
  },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [27.8996, 43.2115],
        [27.904, 43.224],
        [27.9175, 43.229],
        [27.9345, 43.2245],
        [27.941, 43.214],
        [27.93, 43.206],
        [27.91, 43.2045],
        [27.8996, 43.2115],
      ],
    ],
  },
};

export const config = {
  rootDir,
  distDir: path.join(rootDir, "dist"),
  dataDir: path.join(rootDir, "data"),
  port: Number(process.env.PORT || (isProduction ? 5173 : 4000)),
  isProduction,
  mongoUri: process.env.MONGO_URI || "",
  mongoDbName: process.env.MONGO_DB_NAME || "varna_parking",
  blueZoneSmsNumber: process.env.BLUE_ZONE_SMS_NUMBER || "",
  blueZoneCode: process.env.BLUE_ZONE_CODE || "ZONE",
  sessionSecret:
    process.env.SESSION_SECRET ||
    "development-only-varna-parking-session-secret-change-me",
  corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  spotTtlMs: 10 * 60 * 1000,
  cooldownMs: 2 * 60 * 1000,
  updateIntervalMs: 5 * 1000,
  duplicateWindowMs: 10 * 60 * 1000,
  duplicateDistanceMeters: 35,
  clusterRadiusMeters: 100,
  maxActiveSpots: 750,
  maxAvailabilitySignals: 120,
  mapCenter: {
    latitude: 43.2167,
    longitude: 27.9167,
  },
  blueZoneGeoJson,
  serviceBounds: {
    north: 43.32,
    south: 43.12,
    east: 28.08,
    west: 27.78,
  },
};

export function isInsideBlueZone(latitude, longitude) {
  const polygon = config.blueZoneGeoJson.geometry.coordinates[0];
  const point = [longitude, latitude];
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersects =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

export function isInsideServiceArea(latitude, longitude) {
  const { north, south, east, west } = config.serviceBounds;
  return (
    latitude >= south &&
    latitude <= north &&
    longitude >= west &&
    longitude <= east
  );
}
