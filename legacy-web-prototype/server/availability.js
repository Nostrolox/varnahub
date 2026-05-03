import { config, isInsideBlueZone } from "./config.js";

const METERS_PER_DEGREE_LATITUDE = 111_320;

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

function weightedCenter(cluster) {
  const totalWeight = cluster.reports.reduce((sum, report) => sum + report.weight, 0);
  if (totalWeight <= 0) {
    return {
      latitude: cluster.reports[0].latitude,
      longitude: cluster.reports[0].longitude,
    };
  }

  return cluster.reports.reduce(
    (center, report) => ({
      latitude: center.latitude + (report.latitude * report.weight) / totalWeight,
      longitude: center.longitude + (report.longitude * report.weight) / totalWeight,
    }),
    { latitude: 0, longitude: 0 },
  );
}

export function freshnessWeight(createdAt, now = new Date()) {
  const ageMs = Math.max(0, now.getTime() - new Date(createdAt).getTime());
  const tenMinutes = 10 * 60 * 1000;

  return Math.max(0, 1 - ageMs / tenMinutes);
}

function confidenceFor(score) {
  if (score >= 1.8) return "high";
  if (score >= 0.65) return "medium";
  return "low";
}

function colorFor(confidence) {
  if (confidence === "high") return "#22c55e";
  if (confidence === "medium") return "#eab308";
  return "#ef4444";
}

function radiusFor(score, reportCount) {
  return Math.round(Math.max(50, Math.min(80, 46 + reportCount * 8 + score * 8)));
}

function jitterCenter(center, id) {
  const seed = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const angle = (seed % 360) * (Math.PI / 180);
  const distance = 18 + (seed % 18);
  const latitudeOffset = (Math.sin(angle) * distance) / METERS_PER_DEGREE_LATITUDE;
  const longitudeOffset =
    (Math.cos(angle) * distance) /
    (METERS_PER_DEGREE_LATITUDE * Math.cos((center.latitude * Math.PI) / 180));

  return {
    latitude: center.latitude + latitudeOffset,
    longitude: center.longitude + longitudeOffset,
  };
}

export function buildAvailability(spots, now = new Date()) {
  const zoneSpots = spots.filter((spot) => isInsideBlueZone(spot.latitude, spot.longitude));
  const weightedReports = zoneSpots
    .map((spot) => ({
      ...spot,
      weight: freshnessWeight(spot.createdAt, now),
    }))
    .filter((spot) => spot.weight > 0);

  const clusters = [];
  for (const report of weightedReports) {
    let cluster = clusters.find((candidate) => distanceMeters(candidate.center, report) <= config.clusterRadiusMeters);

    if (!cluster) {
      cluster = {
        id: report.id,
        center: { latitude: report.latitude, longitude: report.longitude },
        reports: [],
      };
      clusters.push(cluster);
    }

    cluster.reports.push(report);
    cluster.center = weightedCenter(cluster);
  }

  const signals = clusters
    .map((cluster) => {
      const score = cluster.reports.reduce((sum, report) => sum + report.weight, 0);
      const reportCount = cluster.reports.length;
      const confidence = confidenceFor(score);
      const newestReport = cluster.reports.reduce((latest, report) =>
        new Date(report.createdAt) > new Date(latest.createdAt) ? report : latest,
      );
      const center = jitterCenter(cluster.center, cluster.id);

      return {
        id: cluster.id,
        latitude: Number(center.latitude.toFixed(6)),
        longitude: Number(center.longitude.toFixed(6)),
        radiusMeters: radiusFor(score, reportCount),
        confidence,
        color: colorFor(confidence),
        score: Number(score.toFixed(2)),
        reportCount,
        newestReportAt: newestReport.createdAt,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, config.maxAvailabilitySignals);

  return {
    spots: zoneSpots,
    signals,
    heatPoints: signals.map((signal) => ({
      id: signal.id,
      latitude: signal.latitude,
      longitude: signal.longitude,
      intensity: Number(Math.max(0.15, Math.min(1, signal.score / 2.5)).toFixed(3)),
    })),
  };
}
