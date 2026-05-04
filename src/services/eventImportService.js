import bundledImportedEvents from "../data/importedVisitVarnaEvents.json";

export const IMPORT_REFRESH_MS = 12 * 60 * 60 * 1000;
const STORAGE_KEY = "varnaHub:importedEvents:v1";
const API_URL = "/api/import-events";

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readCache() {
  if (!isBrowser()) return { events: [], importedAt: null };
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : { events: [], importedAt: null };
  } catch (error) {
    console.warn("[event-import] Could not read import cache:", error);
    return { events: [], importedAt: null };
  }
}

function writeCache(cache) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn("[event-import] Could not save import cache:", error);
  }
}

function eventKey(event) {
  return [event.title, event.date, event.location, event.sourceName || event.source].map((value) => String(value || "").toLowerCase().trim()).join("|");
}

export function mergeImportedEvents(existing = [], incoming = []) {
  const seen = new Map();
  for (const event of [...existing, ...incoming]) {
    if (!event?.title || !event?.date || !event?.location) continue;
    seen.set(eventKey(event), event);
  }
  return [...seen.values()];
}

function cacheIsFresh(importedAt) {
  const timestamp = Date.parse(importedAt || "");
  return timestamp && Date.now() - timestamp < IMPORT_REFRESH_MS;
}

async function fetchImportedEventsFromApi() {
  // TODO: Keep scraping server-side in production. Browsers often hit CORS blocks on public event pages, so the frontend should only call this API endpoint.
  const response = await fetch(API_URL, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Import API returned ${response.status}`);
  const result = await response.json();
  return {
    events: Array.isArray(result.events) ? result.events : [],
    errors: Array.isArray(result.errors) ? result.errors : [],
    importedAt: result.importedAt || new Date().toISOString()
  };
}

export async function loadImportedEvents({ force = false } = {}) {
  const cached = readCache();
  const fallbackEvents = bundledImportedEvents || [];
  const baseEvents = cached.events?.length ? cached.events : fallbackEvents;

  if (!force && cacheIsFresh(cached.importedAt)) {
    return { events: baseEvents, errors: [], importedAt: cached.importedAt, fromCache: true };
  }

  try {
    const fresh = await fetchImportedEventsFromApi();
    const merged = mergeImportedEvents(baseEvents, fresh.events);
    const nextCache = { events: merged, importedAt: fresh.importedAt };
    writeCache(nextCache);
    return { ...fresh, events: merged, fromCache: false };
  } catch (error) {
    console.warn("[event-import] Import API unavailable, using cached or bundled events:", error);
    return {
      events: baseEvents,
      errors: [{ sourceName: "Varna Hub", message: error?.message || "Import API unavailable" }],
      importedAt: cached.importedAt,
      fromCache: true
    };
  }
}

export function readImportedEventsCache() {
  const cached = readCache();
  return cached.events?.length ? cached.events : bundledImportedEvents || [];
}
