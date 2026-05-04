import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const OUTPUT_PATH = path.join(ROOT_DIR, "src", "data", "importedVisitVarnaEvents.json");
const SOURCE_NAME = "Visit Varna";
const SOURCE_URL = "https://visit.varna.bg/bg/event.html";
const SOURCE_ORIGIN = "https://visit.varna.bg";
const FALLBACK_IMAGE = "/event-placeholder.svg";
const VARNA_CENTER = { lat: 43.2047, lng: 27.9105 };
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DETAIL_LIMIT = Number(process.env.VARNA_IMPORT_LIMIT || 24);
const force = process.argv.includes("--force");
const dryRun = process.argv.includes("--dry-run");

const DAY_NAMES = [
  "Понеделник",
  "Вторник",
  "Сряда",
  "Четвъртък",
  "Петък",
  "Събота",
  "Неделя"
];

function log(message) {
  console.log(`[Visit Varna importer] ${message}`);
}

function warn(message) {
  console.warn(`[Visit Varna importer] ${message}`);
}

function normalizeSpace(value) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtml(value) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\""
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

function absoluteUrl(value) {
  if (!value) return "";
  try {
    return new URL(decodeHtml(value), SOURCE_ORIGIN).href;
  } catch {
    return "";
  }
}

function firstMatch(value, regex) {
  return normalizeSpace(regex.exec(value)?.[1] || "");
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

function eventKey(event) {
  return `${slug(textValue(event.title))}:${event.date || ""}:${slug(textValue(event.location))}`;
}

function textValue(value) {
  return typeof value === "object" && value ? value.bg || value.en || "" : value || "";
}

function extractImage(html) {
  const ogImage = firstMatch(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || firstMatch(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i);
  if (ogImage) return absoluteUrl(ogImage);

  const images = [...String(html || "").matchAll(/<img\b[^>]+src=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => absoluteUrl(match[1]))
    .filter((src) => src && !/logo|flag|icon|dotmedia|captcha/i.test(src));
  return images[0] || "";
}

function extractDateText(text) {
  const day = DAY_NAMES.join("|");
  const date = `(?:${day})?,?\\s*\\d{1,2}[\\/.]\\d{1,2}[\\/.]\\d{4}\\s*г?\\.?`;
  const match = new RegExp(`${date}(?:\\s*-\\s*${date})?`, "i").exec(text);
  return normalizeSpace(match?.[0] || "");
}

function toIsoDate(dateText) {
  const match = /(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/.exec(dateText || "");
  if (!match) return "";
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function extractTime(text) {
  const match = /(?:начало|старт|откриване|start)?\s*[:–-]?\s*([01]?\d|2[0-3])[:.][0-5]\d\s*(?:ч\.?|часа|hrs?)?/i.exec(text || "");
  return match ? match[0].match(/([01]?\d|2[0-3])[:.][0-5]\d/)[0].replace(".", ":").padStart(5, "0") : "";
}

function inferCategory(text) {
  const value = String(text || "").toLowerCase();
  if (/концерт|опера|музик|оркестър|джаз|рок|club concert|клубен концерт/i.test(value)) return "concerts";
  if (/фестивал|festival|sunwaves|варненско лято/i.test(value)) return "festivals";
  if (/парти|party|dj|клуб|night|бар/i.test(value)) return "nightlife";
  if (/храна|вино|кулинар|food|wine/i.test(value)) return "food";
  if (/среща|лекция|работилница|семинар|форум/i.test(value)) return "meetups";
  return "culture";
}

function cleanNoise(line) {
  return !/^(снимки|image|виж всички събития|добави обект|бюлетин|начало|събития)$/i.test(line)
    && !/^резултати\s*\(/i.test(line)
    && !/^категория|ключова дума|дата от|дата до/i.test(line);
}

function extractLocation(lines, dateText, title) {
  const labelLine = lines.find((line) => /^(място|локация|къде)\s*[:：]/i.test(line));
  if (labelLine) return normalizeSpace(labelLine.replace(/^(място|локация|къде)\s*[:：]/i, ""));

  const dateIndex = lines.findIndex((line) => line.includes(dateText) || extractDateText(line));
  const candidates = lines
    .slice(Math.max(0, dateIndex + 1), dateIndex > -1 ? dateIndex + 9 : 12)
    .filter((line) => cleanNoise(line))
    .filter((line) => line !== title)
    .filter((line) => !extractDateText(line))
    .filter((line) => !extractTime(line) || line.length > 22)
    .filter((line) => line.length >= 3 && line.length <= 140);

  const likely = candidates.find((line) => /галерия|дворец|зала|театър|опера|музей|градина|парк|клуб|бар|ул\.|бул\.|варна/i.test(line));
  return likely || candidates[0] || "Варна";
}

function extractDescription(lines, title, dateText, location) {
  const blacklist = new Set([title, dateText, location]);
  const paragraphs = lines
    .filter((line) => cleanNoise(line))
    .filter((line) => !blacklist.has(line))
    .filter((line) => line.length >= 45)
    .filter((line) => !/^абонирай/i.test(line));
  return paragraphs.slice(0, 3).join("\n\n");
}

function extractTitle(html, fallback = "") {
  return firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)
    || firstMatch(html, /<h2[^>]*>([\s\S]*?)<\/h2>/i)
    || firstMatch(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || fallback;
}

function extractListingCandidates(html) {
  const candidates = [];
  const seen = new Set();
  const anchorRegex = /<a\b[^>]+href=["']([^"']*\/bg\/event\/[^"']+\.html[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorRegex)) {
    const sourceUrl = absoluteUrl(match[1]);
    const title = stripTags(match[2]);
    if (!sourceUrl || !title || title.length < 4 || seen.has(sourceUrl)) continue;
    seen.add(sourceUrl);
    const snippet = html.slice(Math.max(0, match.index - 900), Math.min(html.length, match.index + match[0].length + 400));
    const dateText = extractDateText(stripTags(snippet));
    candidates.push({
      title,
      dateText,
      date: toIsoDate(dateText),
      sourceUrl,
      imageUrl: extractImage(snippet)
    });
  }
  return candidates;
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    log(`Fetching ${url}`);
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "VarnaHubImporter/1.0 (+https://github.com/Nostrolox/varnahub)"
      },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function readExistingEvents() {
  if (!existsSync(OUTPUT_PATH)) return [];
  try {
    return JSON.parse(await readFile(OUTPUT_PATH, "utf8"));
  } catch (error) {
    warn(`Could not read existing import cache: ${error.message}`);
    return [];
  }
}

function wasUpdatedRecently(events) {
  const latest = Math.max(...events.map((event) => Date.parse(event.lastUpdated || "") || 0), 0);
  return latest && Date.now() - latest < ONE_DAY_MS;
}

function buildEvent(candidate, detailHtml, lastUpdated) {
  const lines = htmlToLines(detailHtml || "");
  const title = normalizeSpace(extractTitle(detailHtml, candidate.title) || candidate.title);
  const allText = [candidate.title, candidate.dateText, stripTags(detailHtml)].join(" ");
  const dateText = extractDateText(allText) || candidate.dateText;
  const date = toIsoDate(dateText) || candidate.date;
  const startTime = extractTime(allText) || "19:00";
  const location = extractLocation(lines, dateText, title);
  const description = extractDescription(lines, title, dateText, location) || candidate.title;
  const category = inferCategory(`${title} ${description}`);
  const imageUrl = extractImage(detailHtml) || candidate.imageUrl || FALLBACK_IMAGE;
  const sourceUrl = candidate.sourceUrl;
  const id = `visit-varna-${hash(`${title}|${date}|${location}|${sourceUrl}`)}`;

  return {
    id,
    title: { bg: title, en: title },
    category,
    date,
    startTime,
    endTime: "",
    location: { bg: location, en: location },
    coordinates: VARNA_CENTER,
    shortDescription: { bg: description.slice(0, 260), en: description.slice(0, 260) },
    fullDescription: { bg: description.split(/\n{2,}/), en: description.split(/\n{2,}/) },
    images: [imageUrl],
    image: imageUrl,
    organizer: { name: SOURCE_NAME, link: SOURCE_URL, contact: "" },
    ticket: { price: "", link: sourceUrl },
    schedule: [{ time: startTime, bg: title, en: title }],
    badges: ["verified", "foodNearby"],
    tags: ["visit-varna", "varna", category],
    source: SOURCE_NAME,
    sourceUrl,
    lastUpdated,
    rating: 0,
    reviewsCount: 0,
    popularityScore: 55
  };
}

async function importEvents() {
  const existing = await readExistingEvents();
  if (!force && wasUpdatedRecently(existing)) {
    log("Import cache was updated less than 24 hours ago. Use --force to refresh manually.");
    return existing;
  }

  const listingHtml = await fetchHtml(SOURCE_URL);
  const candidates = extractListingCandidates(listingHtml).slice(0, DETAIL_LIMIT);
  if (!candidates.length) {
    warn("No event links were found. Keeping the existing import cache untouched.");
    return existing;
  }

  log(`Found ${candidates.length} event candidates. Fetching detail pages politely.`);
  const lastUpdated = new Date().toISOString();
  const imported = [];
  for (const [index, candidate] of candidates.entries()) {
    let detailHtml = "";
    try {
      detailHtml = await fetchHtml(candidate.sourceUrl);
    } catch (error) {
      warn(`Detail page failed for "${candidate.title}": ${error.message}. Using listing data.`);
    }
    imported.push(buildEvent(candidate, detailHtml, lastUpdated));
    if (index < candidates.length - 1) await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const deduped = [];
  const keys = new Set();
  for (const event of imported) {
    const key = eventKey(event);
    if (!event.title?.bg || !event.date || keys.has(key)) continue;
    keys.add(key);
    deduped.push(event);
  }

  log(`Prepared ${deduped.length} unique Visit Varna events.`);
  return deduped;
}

try {
  const events = await importEvents();
  if (dryRun) {
    log(`Dry run complete. ${events.length} events would be available.`);
  } else {
    await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(OUTPUT_PATH, `${JSON.stringify(events, null, 2)}\n`, "utf8");
    log(`Wrote ${events.length} events to ${path.relative(ROOT_DIR, OUTPUT_PATH)}.`);
  }
} catch (error) {
  warn(`Import failed safely: ${error.message}`);
  warn("The existing site data was not changed. You can still paste events manually in the admin panel.");
}
