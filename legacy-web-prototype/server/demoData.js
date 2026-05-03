import { config, isInsideBlueZone } from "./config.js";

const METERS_PER_DEGREE_LATITUDE = 111_320;

const demoClusters = [
  { east: 0, north: 0, reports: 4, minAge: 1, maxAge: 3, spread: 34 },
  { east: 145, north: 65, reports: 2, minAge: 3, maxAge: 6, spread: 42 },
  { east: -165, north: 80, reports: 2, minAge: 4, maxAge: 7, spread: 44 },
  { east: 90, north: -150, reports: 1, minAge: 7, maxAge: 8, spread: 34 },
  { east: -235, north: -80, reports: 1, minAge: 6, maxAge: 8, spread: 38 },
];

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function offsetCoordinate(origin, eastMeters, northMeters) {
  const latitude = origin.latitude + northMeters / METERS_PER_DEGREE_LATITUDE;
  const longitude =
    origin.longitude +
    eastMeters /
      (METERS_PER_DEGREE_LATITUDE * Math.cos((origin.latitude * Math.PI) / 180));

  return { latitude, longitude };
}

function polygonCenter() {
  const coordinates = config.blueZoneGeoJson.geometry.coordinates[0];
  const usableCoordinates = coordinates.slice(0, -1);
  const center = usableCoordinates.reduce(
    (sum, [longitude, latitude]) => ({
      latitude: sum.latitude + latitude / usableCoordinates.length,
      longitude: sum.longitude + longitude / usableCoordinates.length,
    }),
    { latitude: 0, longitude: 0 },
  );

  return isInsideBlueZone(center.latitude, center.longitude) ? center : config.mapCenter;
}

function safeBase(latitude, longitude) {
  if (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    isInsideBlueZone(latitude, longitude)
  ) {
    return { latitude, longitude };
  }

  return isInsideBlueZone(config.mapCenter.latitude, config.mapCenter.longitude)
    ? config.mapCenter
    : polygonCenter();
}

function insideOffset(origin, eastMeters, northMeters) {
  const preferred = offsetCoordinate(origin, eastMeters, northMeters);
  if (isInsideBlueZone(preferred.latitude, preferred.longitude)) {
    return preferred;
  }

  const center = polygonCenter();
  const softened = offsetCoordinate(center, eastMeters * 0.35, northMeters * 0.35);
  return isInsideBlueZone(softened.latitude, softened.longitude) ? softened : center;
}

function jitterInside(anchor, spreadMeters, fallbackIndex) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const angle = randomBetween(0, Math.PI * 2);
    const distance = randomBetween(10, spreadMeters);
    const point = offsetCoordinate(
      anchor,
      Math.cos(angle) * distance,
      Math.sin(angle) * distance,
    );

    if (isInsideBlueZone(point.latitude, point.longitude)) {
      return point;
    }
  }

  const fallbackAngle = (fallbackIndex * 71 * Math.PI) / 180;
  return offsetCoordinate(
    polygonCenter(),
    Math.cos(fallbackAngle) * 42,
    Math.sin(fallbackAngle) * 42,
  );
}

export function buildDemoSpots({ latitude, longitude } = {}, now = new Date()) {
  const base = safeBase(Number(latitude), Number(longitude));
  const spots = [];

  demoClusters.forEach((cluster, clusterIndex) => {
    const anchor = insideOffset(base, cluster.east, cluster.north);

    for (let reportIndex = 0; reportIndex < cluster.reports; reportIndex += 1) {
      const ageMinutes = randomBetween(cluster.minAge, cluster.maxAge);
      const createdAt = new Date(now.getTime() - ageMinutes * 60 * 1000);
      const point = jitterInside(anchor, cluster.spread, clusterIndex + reportIndex);

      spots.push({
        id: `demo-${now.getTime()}-${clusterIndex}-${reportIndex}`,
        userId: `demo-user-${clusterIndex}`,
        latitude: Number(point.latitude.toFixed(6)),
        longitude: Number(point.longitude.toFixed(6)),
        accuracy: Math.round(randomBetween(12, 46)),
        createdAt: createdAt.toISOString(),
        expiresAt: new Date(createdAt.getTime() + config.spotTtlMs).toISOString(),
        demo: true,
      });
    }
  });

  return spots;
}
