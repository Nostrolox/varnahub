import bundledImportedPlaces from "../data/importedPlaces.json";

export const PLACE_IMPORT_REFRESH_MS = 24 * 60 * 60 * 1000;
const STORAGE_KEY = "varnaHub:importedPlaces:v1";
const API_URL = "/api/import-places";

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readCache() {
  if (!isBrowser()) return { places: [], importedAt: null };
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : { places: [], importedAt: null };
  } catch (error) {
    console.warn("[place-import] Could not read import cache:", error);
    return { places: [], importedAt: null };
  }
}

function writeCache(cache) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn("[place-import] Could not save import cache:", error);
  }
}

function placeKey(place) {
  return [place.name, place.location].map((value) => String(value || "").toLowerCase().trim()).join("|");
}

function cacheIsFresh(importedAt) {
  const timestamp = Date.parse(importedAt || "");
  return timestamp && Date.now() - timestamp < PLACE_IMPORT_REFRESH_MS;
}

export function mergeImportedPlaces(existing = [], incoming = []) {
  const seen = new Map();
  for (const place of [...existing, ...incoming]) {
    if (!place?.name) continue;
    seen.set(placeKey(place), place);
  }
  return [...seen.values()];
}

async function fetchImportedPlacesFromApi() {
  // TODO: Keep Glovo, Takeaway, and Tripadvisor scraping server-side. The browser should only call this API to avoid CORS blocks and to respect source-site rate limits.
  const response = await fetch(API_URL, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Place import API returned ${response.status}`);
  const result = await response.json();
  return {
    places: Array.isArray(result.places) ? result.places : [],
    errors: Array.isArray(result.errors) ? result.errors : [],
    importedAt: result.importedAt || new Date().toISOString()
  };
}

export async function loadImportedPlaces({ force = false } = {}) {
  const cached = readCache();
  const fallbackPlaces = bundledImportedPlaces || [];
  const basePlaces = cached.places?.length ? cached.places : fallbackPlaces;

  if (!force && cacheIsFresh(cached.importedAt)) {
    return { places: basePlaces, errors: [], importedAt: cached.importedAt, fromCache: true };
  }

  try {
    const fresh = await fetchImportedPlacesFromApi();
    const merged = mergeImportedPlaces(basePlaces, fresh.places);
    const nextCache = { places: merged, importedAt: fresh.importedAt };
    writeCache(nextCache);
    return { ...fresh, places: merged, fromCache: false };
  } catch (error) {
    console.warn("[place-import] Import API unavailable, using cached or bundled places:", error);
    return {
      places: basePlaces,
      errors: [{ sourceName: "Varna Hub", message: error?.message || "Place import API unavailable" }],
      importedAt: cached.importedAt,
      fromCache: true
    };
  }
}

export function readImportedPlacesCache() {
  const cached = readCache();
  return cached.places?.length ? cached.places : bundledImportedPlaces || [];
}
