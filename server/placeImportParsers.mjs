import crypto from "node:crypto";

export const PLACE_IMPORT_REFRESH_MS = 24 * 60 * 60 * 1000;
export const PLACE_FALLBACK_IMAGE = "/place-placeholder.svg";

const DEFAULT_LIMIT = Number(process.env.VARNA_PLACE_IMPORT_LIMIT || 36);
const VARNA_CENTER = { lat: null, lng: null };

const SOURCES = {
  glovo: {
    name: "Glovo",
    origin: "https://glovoapp.com",
    urls: [
      "https://glovoapp.com/bg/en/varna/categories/restaurants_1",
      "https://glovoapp.com/bg/en/varna/restaurants_1/local-food_35381/",
      "https://glovoapp.com/bg/en/varna/restaurants_1/pizza_34701/"
    ]
  },
  takeaway: {
    name: "Takeaway",
    origin: "https://www.takeaway.com",
    urls: [
      "https://www.takeaway.com/bg-en/food-delivery-varna",
      "https://www.takeaway.com/bg-en/order-pizza-varna-varna",
      "https://www.takeaway.com/bg-en/order-fish-varna-varna"
    ]
  },
  tripadvisor: {
    name: "Tripadvisor",
    origin: "https://www.tripadvisor.com",
    urls: ["https://www.tripadvisor.com/Restaurants-g295392-Varna_Varna_Province.html"]
  }
};

function log(message) {
  console.log(`[place-import] ${message}`);
}

function warn(message) {
  console.warn(`[place-import] ${message}`);
}

function normalizeSpace(value) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtml(value) {
  const named = {
    amp: "&",
    apos: "'",
    bdquo: "„",
    gt: ">",
    ldquo: "“",
    lsquo: "‘",
    lt: "<",
    mdash: "—",
    nbsp: " ",
    ndash: "–",
    quot: "\"",
    rdquo: "”",
    rsquo: "’"
  };
  return String(value || "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity) => {
    if (entity[0] === "#") {
      const code = entity[1]?.toLowerCase() === "x" ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    }
    return named[entity.toLowerCase()] ?? `&${entity};`;
  });
}

function stripTags(value) {
  return normalizeSpace(decodeHtml(String(value || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")));
}

function htmlToLines(html) {
  return decodeHtml(String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/section|\/article)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .split(/\n+/)
    .map(normalizeSpace)
    .filter(Boolean);
}

function absoluteUrl(value, origin) {
  if (!value) return "";
  try {
    return new URL(decodeHtml(value), origin).href;
  } catch {
    return "";
  }
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zа-я0-9]+/gi, "-")
    .replace(/(^-|-$)/g, "");
}

function hash(value) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 12);
}

function placeKey(place) {
  return `${slug(place.name)}:${slug(place.location || "varna")}`;
}

function sourceScore(place) {
  if (place.sourceName === "Tripadvisor") return 3;
  if (place.sourceName === "Glovo") return 2;
  if (place.sourceName === "Takeaway") return 1;
  return 0;
}

function mergeDuplicatePlaces(places) {
  const seen = new Map();
  for (const place of places) {
    if (!place?.name) continue;
    const key = placeKey(place);
    const current = seen.get(key);
    if (!current) {
      seen.set(key, place);
      continue;
    }

    seen.set(key, {
      ...current,
      ...place,
      rating: current.rating ?? place.rating,
      reviewsCount: current.reviewsCount ?? place.reviewsCount,
      images: current.images?.[0] && current.images[0] !== PLACE_FALLBACK_IMAGE ? current.images : place.images,
      image: current.image && current.image !== PLACE_FALLBACK_IMAGE ? current.image : place.image,
      cuisine: current.cuisine || place.cuisine,
      type: current.type || place.type,
      sourceName: sourceScore(current) >= sourceScore(place) ? current.sourceName : place.sourceName,
      sourceUrl: sourceScore(current) >= sourceScore(place) ? current.sourceUrl : place.sourceUrl,
      tags: [...new Set([...(current.tags || []), ...(place.tags || [])])],
      badges: [...new Set([...(current.badges || []), ...(place.badges || [])])]
    });
  }
  return [...seen.values()];
}

function extractImages(html, origin) {
  const images = [...String(html || "").matchAll(/<img\b[^>]+src=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => absoluteUrl(match[1], origin))
    .filter((src) => src && !/logo|flag|icon|captcha|blank|pixel/i.test(src));
  return [...new Set(images)].slice(0, 3);
}

function inferType(text) {
  const value = String(text || "").toLowerCase();
  if (/bar|pub|бира|бар|пъб|drinks|alcohol/i.test(value)) return "bar";
  if (/coffee|cafe|кафе|tea|сладкар|bakery|cakes|dessert/i.test(value)) return "cafe";
  if (/doner|дюнер|burger|бургер|fast|kebab|sandwich|street|grill/i.test(value)) return "fast_food";
  if (/restaurant|ресторант|bistro|бистро|pizza|sushi|seafood|кухня|food/i.test(value)) return "restaurant";
  return "other";
}

function inferCuisine(text) {
  const value = String(text || "").toLowerCase();
  if (/pizza|пица|italian|италиан/i.test(value)) return "Pizza";
  if (/burger|бургер/i.test(value)) return "Burgers";
  if (/sushi|суши|asian|азиат|китай/i.test(value)) return "Sushi";
  if (/dessert|sweet|cakes|слад|торт|bakery|пекар/i.test(value)) return "Desserts";
  if (/bulgar|българ|local|traditional|скара|механа/i.test(value)) return "Bulgarian";
  if (/seafood|fish|риба|морск/i.test(value)) return "Seafood";
  if (/coffee|cafe|кафе/i.test(value)) return "Cafe";
  return "International";
}

function priceRangeFromText(text) {
  if (/\$\$\$\$/.test(text)) return "$$$$";
  if (/\$\$\s*-\s*\$\$\$|\$\$\$/.test(text)) return "$$$";
  if (/\$\$/.test(text)) return "$$";
  if (/\$/.test(text)) return "$";
  return null;
}

function normalizePlace(raw) {
  const name = normalizeSpace(raw.name);
  const sourceName = raw.sourceName;
  const sourceUrl = raw.sourceUrl || SOURCES[sourceName?.toLowerCase()]?.urls?.[0] || "";
  const cuisine = normalizeSpace(raw.cuisine || inferCuisine(`${name} ${raw.shortDescription || ""}`));
  const type = raw.type || inferType(`${name} ${cuisine} ${raw.shortDescription || ""}`);
  const location = normalizeSpace(raw.location || "Varna");
  const images = raw.images?.length ? raw.images : [raw.imageUrl || PLACE_FALLBACK_IMAGE];
  const importedAt = raw.importedAt || new Date().toISOString();

  return {
    id: raw.id || `${slug(sourceName)}-${hash(`${name}|${location}|${sourceUrl}`)}`,
    name,
    type,
    cuisine,
    priceRange: raw.priceRange || null,
    location,
    coordinates: raw.coordinates || VARNA_CENTER,
    shortDescription: normalizeSpace(raw.shortDescription || `${cuisine} place in Varna`),
    images,
    image: images[0],
    rating: raw.rating ?? null,
    reviewsCount: raw.reviewsCount ?? null,
    openingHours: raw.openingHours || null,
    sourceName,
    sourceUrl,
    tags: [...new Set([...(raw.tags || []), cuisine.toLowerCase(), type, slug(sourceName)].filter(Boolean))],
    badges: [...new Set([...(raw.badges || []), "verified"].filter(Boolean))],
    status: "published",
    importedAt
  };
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 16_000);
  try {
    log(`Fetching ${url}`);
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "VarnaHubPlaceImporter/1.0 (+https://github.com/Nostrolox/varnahub)"
      },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function cleanName(value) {
  return normalizeSpace(value
    .replace(/-\d+%|\d+%|some items|Free delivery|Безплатно|Schedule for[^0-9А-Яа-яA-Za-z]*|Closed|Затворен|Насрочване за[^0-9А-Яа-яA-Za-z]*/gi, " ")
    .replace(/\d+[,.]\d+\s*(?:€|лв\.?|\u20ac).*/i, " ")
    .replace(/\(?\d{1,3}%\)?|\(\d+\+?\)/g, " "));
}

function parseGlovoText(html, source, url) {
  const text = stripTags(html);
  const images = extractImages(html, source.origin);
  const matches = [...text.matchAll(/([A-ZА-Я0-9][A-ZА-Яа-яёЁa-z0-9 '&|./-]{2,72}?)(?:\s+(?:Free|Безплатно|Schedule for [^0-9]+|Насрочване за [^0-9]+|Closed|Затворен|[0-9,.]+\s*(?:€|лв\.?))){1,3}\s*(\d{2,3})%\(([\d+]+)\)/g)];
  const places = matches.map((match) => {
    const name = cleanName(match[1]);
    if (!name || /varna|food|sort by|all stores|reset/i.test(name)) return null;
    const ratingPercent = Number(match[2]);
    const reviewsCount = match[3] === "500+" ? 500 : Number(match[3]);
    const cuisine = inferCuisine(name);
    return normalizePlace({
      name,
      type: inferType(`${name} ${cuisine}`),
      cuisine,
      priceRange: null,
      location: "Varna",
      shortDescription: `${cuisine} from Glovo Varna listings`,
      images: images.length ? images : [PLACE_FALLBACK_IMAGE],
      rating: Number.isFinite(ratingPercent) ? Math.round((ratingPercent / 20) * 10) / 10 : null,
      reviewsCount: Number.isFinite(reviewsCount) ? reviewsCount : null,
      openingHours: /Closed|Затворен/i.test(match[0]) ? "Closed" : null,
      sourceName: source.name,
      sourceUrl: url,
      tags: ["glovo", cuisine.toLowerCase()],
      badges: ["delivery"]
    });
  }).filter(Boolean);
  return mergeDuplicatePlaces(places);
}

export async function importFromGlovoVarna({ limit = DEFAULT_LIMIT } = {}) {
  const source = SOURCES.glovo;
  const batches = await Promise.allSettled(source.urls.map(async (url) => parseGlovoText(await fetchHtml(url), source, url)));
  const places = batches.flatMap((result) => {
    if (result.status === "fulfilled") return result.value;
    warn(`${source.name}: ${result.reason?.message || result.reason}`);
    return [];
  });
  return mergeDuplicatePlaces(places).slice(0, limit);
}

function parseTakeawayText(html, source, url) {
  const lines = htmlToLines(html);
  const images = extractImages(html, source.origin);
  const places = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!/restaurant|pizza|sushi|burger|grill|cafe|bar|бистро|ресторант|пиц|суши|бургер/i.test(line)) continue;
    if (/order food|restaurants delivering|how to order|download|customer service|terms|privacy/i.test(line)) continue;
    const name = cleanName(line).slice(0, 80);
    if (name.length < 3) continue;
    const cuisine = inferCuisine(`${name} ${lines[i + 1] || ""}`);
    places.push(normalizePlace({
      name,
      type: inferType(`${name} ${cuisine}`),
      cuisine,
      priceRange: priceRangeFromText(line),
      location: "Varna",
      shortDescription: `${cuisine} listing from Takeaway Varna`,
      images: images.length ? images : [PLACE_FALLBACK_IMAGE],
      rating: null,
      reviewsCount: null,
      openingHours: null,
      sourceName: source.name,
      sourceUrl: url,
      tags: ["takeaway", cuisine.toLowerCase()],
      badges: ["delivery"]
    }));
  }
  return mergeDuplicatePlaces(places);
}

export async function importFromTakeawayVarna({ limit = DEFAULT_LIMIT } = {}) {
  const source = SOURCES.takeaway;
  const batches = await Promise.allSettled(source.urls.map(async (url) => parseTakeawayText(await fetchHtml(url), source, url)));
  const places = batches.flatMap((result) => {
    if (result.status === "fulfilled") return result.value;
    warn(`${source.name}: ${result.reason?.message || result.reason}`);
    return [];
  });
  return mergeDuplicatePlaces(places).slice(0, limit);
}

function parseTripadvisorListings(html, source, url) {
  const lines = htmlToLines(html);
  const images = extractImages(html, source.origin);
  const places = [];

  for (let i = 0; i < lines.length - 4; i += 1) {
    const nameLine = lines[i].replace(/^\d+\.\s*/, "");
    const rating = Number(lines[i + 1]);
    const reviewsMatch = /\(\s*([\d,]+)\s+reviews\s*\)/i.exec(lines[i + 3] || lines[i + 2] || "");
    const cuisineLine = lines.slice(i + 2, i + 6).find((line) => /\$|Italian|Pizza|Bar|Seafood|European|Mediterranean|Steakhouse|French|Asian|International|Bulgarian|Eastern European/i.test(line));
    if (!nameLine || nameLine.length > 90 || !Number.isFinite(rating) || !reviewsMatch || !cuisineLine) continue;
    if (/restaurants|varna|sponsored|menu|closed|open/i.test(nameLine)) continue;

    const cuisine = normalizeSpace(cuisineLine.replace(/\$+/g, "").replace(/\s+-\s+/g, " ").replace(/•/g, ","));
    const openingHours = lines.slice(i + 2, i + 8).find((line) => /open|closed|opens/i.test(line)) || null;
    places.push(normalizePlace({
      name: nameLine,
      type: inferType(`${nameLine} ${cuisine}`),
      cuisine: cuisine || inferCuisine(nameLine),
      priceRange: priceRangeFromText(cuisineLine),
      location: "Varna",
      shortDescription: `${cuisine || "Restaurant"} listed on Tripadvisor Varna`,
      images: images.length ? images : [PLACE_FALLBACK_IMAGE],
      rating,
      reviewsCount: Number(reviewsMatch[1].replace(/,/g, "")),
      openingHours,
      sourceName: source.name,
      sourceUrl: url,
      tags: ["tripadvisor", ...(cuisine || "").split(/,\s*/).map((item) => item.toLowerCase())],
      badges: rating >= 4.5 ? ["topRated"] : []
    }));
  }
  return mergeDuplicatePlaces(places);
}

export async function importFromTripadvisorVarna({ limit = DEFAULT_LIMIT } = {}) {
  const source = SOURCES.tripadvisor;
  const html = await fetchHtml(source.urls[0]);
  return parseTripadvisorListings(html, source, source.urls[0]).slice(0, limit);
}

export async function importAllPlaces(options = {}) {
  const importedAt = new Date().toISOString();
  const importers = [
    ["Glovo", () => importFromGlovoVarna(options)],
    ["Takeaway", () => importFromTakeawayVarna(options)],
    ["Tripadvisor", () => importFromTripadvisorVarna(options)]
  ];
  const settled = await Promise.allSettled(importers.map(([, importer]) => importer()));
  const places = [];
  const errors = [];

  for (const [index, result] of settled.entries()) {
    const sourceName = importers[index][0];
    if (result.status === "fulfilled") {
      places.push(...result.value.map((place) => ({ ...place, importedAt })));
    } else {
      warn(`${sourceName} failed: ${result.reason?.message || result.reason}`);
      errors.push({ sourceName, message: result.reason?.message || String(result.reason) });
    }
  }

  return {
    places: mergeDuplicatePlaces(places),
    errors,
    importedAt
  };
}
