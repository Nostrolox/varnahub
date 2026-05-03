import parkingData from "../data/parkingData.json";
import { distanceInKm } from "../utils/geo";

export const DEFAULT_FILTERS = {
  free: true,
  paid: true,
  restricted: true
};

export const STATUS_META = {
  free: {
    label: "Free",
    color: "#16a34a"
  },
  occupied: {
    label: "Occupied",
    color: "#dc2626"
  },
  unknown: {
    label: "Unknown",
    color: "#6b7280"
  }
};

export function getParkingData() {
  return parkingData;
}

export function getZoneById(zoneId) {
  return parkingData.zones.features.find((zone) => zone.properties.id === zoneId);
}

export function getVisibleZones(filters) {
  return {
    ...parkingData.zones,
    features: parkingData.zones.features.filter((zone) => {
      if (zone.properties.kind === "restricted") return filters.restricted;
      return filters.paid;
    })
  };
}

export function getVisibleSpots(filters) {
  return parkingData.spots.filter((spot) => {
    if (spot.type === "restricted") return filters.restricted;
    if (spot.type === "paid") return filters.paid || (filters.free && spot.status === "free");
    return filters.free;
  });
}

export function withDistances(spots, origin) {
  return spots
    .map((spot) => ({
      ...spot,
      distanceKm: distanceInKm(origin, spot)
    }))
    .sort((left, right) => left.distanceKm - right.distanceKm);
}

export function findNearestParking(spots, origin) {
  // Prefer known free spaces, then unknown availability, and never suggest restricted or occupied spots.
  const candidates = spots.filter(
    (spot) => spot.type !== "restricted" && (spot.status === "free" || spot.status === "unknown")
  );

  return withDistances(candidates, origin)[0] || null;
}

export function summarizeSpots(spots) {
  return spots.reduce(
    (summary, spot) => {
      summary[spot.status] += 1;
      return summary;
    },
    { free: 0, occupied: 0, unknown: 0 }
  );
}
