import parkingData from "../data/varnaParkingData.json";
import { withDistance } from "../utils/geo";

export const DEFAULT_FILTERS = {
  free: true,
  paid: true,
  restricted: true
};

export function getCityConfig() {
  return parkingData.city;
}

export function getParkingZones() {
  return parkingData.zones;
}

export function getRestrictedAreas() {
  return parkingData.restrictedAreas;
}

export function getParkingSpots() {
  return parkingData.spots;
}

export function filterSpots(spots, filters) {
  return spots.filter((spot) => {
    if (spot.type === "restricted") return filters.restricted;
    if (spot.type === "paid") return filters.paid;
    return filters.free;
  });
}

export function findNearestAvailableSpot(spots, location) {
  // Prefer genuinely available spots, then fall back to unknown availability so the CTA always helps.
  const candidates = spots.filter((spot) => spot.status === "free" || spot.status === "unknown");
  return withDistance(candidates, location)[0] || null;
}

export function summarizeAvailability(spots) {
  return spots.reduce(
    (summary, spot) => ({
      ...summary,
      [spot.status]: summary[spot.status] + 1
    }),
    { free: 0, full: 0, unknown: 0 }
  );
}
