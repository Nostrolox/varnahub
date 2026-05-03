export function formatRemaining(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function relativeAge(isoDate) {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(isoDate)) / 1000));
  if (elapsedSeconds < 60) return "now";
  const minutes = Math.floor(elapsedSeconds / 60);
  return `${minutes} min ago`;
}

export function freshnessWeight(spot, ttlMs) {
  const created = new Date(spot.createdAt).getTime();
  const age = Math.max(0, Date.now() - created);
  const freshness = Math.max(0.15, 1 - age / ttlMs);
  return 1 + freshness * 4;
}
