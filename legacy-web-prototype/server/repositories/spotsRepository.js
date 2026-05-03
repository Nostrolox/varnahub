import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { MongoClient } from "mongodb";
import { config } from "../config.js";

function toPublicSpot(spot) {
  const id = String(spot._id || spot.id);
  const createdAt = spot.createdAt instanceof Date ? spot.createdAt : new Date(spot.createdAt);
  const expiresAt = spot.expiresAt instanceof Date ? spot.expiresAt : new Date(spot.expiresAt);

  return {
    id,
    latitude: Number(spot.latitude),
    longitude: Number(spot.longitude),
    accuracy: spot.accuracy ?? null,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

function distanceMeters(a, b) {
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const deltaLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const deltaLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const sinLat = Math.sin(deltaLat / 2);
  const sinLon = Math.sin(deltaLon / 2);
  const h =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;

  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

class MongoSpotStore {
  constructor(uri, dbName) {
    this.client = new MongoClient(uri);
    this.dbName = dbName;
    this.collection = null;
  }

  async init() {
    await this.client.connect();
    this.collection = this.client.db(this.dbName).collection("spots");
    // MongoDB removes expired spot documents automatically through this TTL index.
    await Promise.all([
      this.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      this.collection.createIndex({ userId: 1, createdAt: -1 }),
      this.collection.createIndex({ location: "2dsphere" }),
    ]);
  }

  async listActive(now = new Date()) {
    const spots = await this.collection
      .find({ expiresAt: { $gt: now } })
      .sort({ createdAt: -1 })
      .limit(config.maxActiveSpots)
      .toArray();
    return spots.map(toPublicSpot);
  }

  async create({ userId, latitude, longitude, accuracy }) {
    const createdAt = new Date();
    // The API also filters expired rows immediately; TTL handles durable cleanup.
    const expiresAt = new Date(createdAt.getTime() + config.spotTtlMs);
    const document = {
      userId,
      latitude,
      longitude,
      accuracy,
      location: {
        type: "Point",
        coordinates: [longitude, latitude],
      },
      createdAt,
      expiresAt,
    };

    const result = await this.collection.insertOne(document);
    return toPublicSpot({ ...document, _id: result.insertedId });
  }

  async countRecentByUser(userId, since) {
    return this.collection.countDocuments({
      userId,
      createdAt: { $gte: since },
      expiresAt: { $gt: new Date() },
    });
  }

  async hasNearbyRecentByUser(userId, latitude, longitude, since, maxDistanceMeters) {
    const matches = await this.collection
      .find({
        userId,
        createdAt: { $gte: since },
        expiresAt: { $gt: new Date() },
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [longitude, latitude],
            },
            $maxDistance: maxDistanceMeters,
          },
        },
      })
      .limit(1)
      .toArray();

    return matches.length > 0;
  }

  async cleanupExpired(now = new Date()) {
    const result = await this.collection.deleteMany({ expiresAt: { $lte: now } });
    return result.deletedCount;
  }

  async close() {
    await this.client.close();
  }
}

class FileSpotStore {
  constructor(dataDir) {
    this.filePath = path.join(dataDir, "parking-spots.json");
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, JSON.stringify({ spots: [] }, null, 2));
    }
  }

  async read() {
    await this.init();
    const raw = await fs.readFile(this.filePath, "utf8");
    const parsed = JSON.parse(raw || "{}");
    parsed.spots = Array.isArray(parsed.spots) ? parsed.spots : [];
    return parsed;
  }

  async write(db) {
    const tmp = `${this.filePath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(db, null, 2));
    await fs.rename(tmp, this.filePath);
  }

  async listActive(now = new Date()) {
    const db = await this.read();
    const active = db.spots
      .filter((spot) => new Date(spot.expiresAt) > now)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, config.maxActiveSpots);

    return active.map(toPublicSpot);
  }

  async create({ userId, latitude, longitude, accuracy }) {
    const db = await this.read();
    const createdAt = new Date();
    const spot = {
      id: crypto.randomUUID(),
      userId,
      latitude,
      longitude,
      accuracy,
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + config.spotTtlMs).toISOString(),
    };

    db.spots.push(spot);
    await this.write(db);
    return toPublicSpot(spot);
  }

  async countRecentByUser(userId, since) {
    const db = await this.read();
    return db.spots.filter(
      (spot) =>
        spot.userId === userId &&
        new Date(spot.createdAt) >= since &&
        new Date(spot.expiresAt) > new Date(),
    ).length;
  }

  async hasNearbyRecentByUser(userId, latitude, longitude, since, maxDistanceMeters) {
    const db = await this.read();
    const candidate = { latitude, longitude };

    return db.spots.some(
      (spot) =>
        spot.userId === userId &&
        new Date(spot.createdAt) >= since &&
        new Date(spot.expiresAt) > new Date() &&
        distanceMeters(candidate, spot) <= maxDistanceMeters,
    );
  }

  async cleanupExpired(now = new Date()) {
    const db = await this.read();
    const before = db.spots.length;
    db.spots = db.spots.filter((spot) => new Date(spot.expiresAt) > now);
    if (db.spots.length !== before) {
      await this.write(db);
    }
    return before - db.spots.length;
  }

  async close() {}
}

export async function createSpotRepository() {
  const store = config.mongoUri
    ? new MongoSpotStore(config.mongoUri, config.mongoDbName)
    : new FileSpotStore(config.dataDir);

  await store.init();
  return store;
}
