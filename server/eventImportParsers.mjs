import crypto from "node:crypto";

export const IMPORT_REFRESH_MS = 12 * 60 * 60 * 1000;
export const FALLBACK_IMAGE = "/event-placeholder.svg";

const VARNA_CENTER = { lat: null, lng: null };
const REQUEST_DELAY_MS = 450;
const DEFAULT_LIMIT = Number(process.env.VARNA_IMPORT_LIMIT || 18);

const SOURCES = {
  visitVarna: {
    name: "Visit Varna",
    origin: "https://visit.varna.bg",
    url: "https://visit.varna.bg/bg/event.html"
  },
  varnaEvents: {
    name: "Varna Events",
    origin: "https://varna.events",
    url: "https://varna.events/"
  },
  varnaCulture: {
    name: "Varna Culture",
    origin: "https://varnaculture.bg",
    url: "https://varnaculture.bg/"
  }
};

const MONTHS_BG = {
  януари: "01",
  февруари: "02",
  март: "03",
  април: "04",
  май: "05",
  юни: "06",
  юли: "07",
  август: "08",
  септември: "09",
  октомври: "10",
  ноември: "11",
  декември: "12"
};

const DAY_NAMES = ["Понеделник", "Вторник", "Сряда", "Четвъртък", "Петък", "Събота", "Неделя"];

function log(message) {
  console.log(`[event-import] ${message}`);
}

function warn(message) {
  console.warn(`[event-import] ${message}`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  return `${slug(event.title)}:${event.date || ""}:${slug(event.location)}:${slug(event.sourceName)}`;
}

function dedupeImportedEvents(events) {
  const seen = new Map();
  for (const event of events) {
    const key = eventKey(event);
    if (!event.title || !event.date || !event.location || seen.has(key)) continue;
    seen.set(key, event);
  }
  return [...seen.values()];
}

function extractImage(html, origin) {
  const ogImage = firstMatch(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || firstMatch(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i);
  if (ogImage) return absoluteUrl(ogImage, origin);

  const images = [...String(html || "").matchAll(/<img\b[^>]+src=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => absoluteUrl(match[1], origin))
    .filter((src) => src && !/logo|flag|icon|captcha|blank|pixel/i.test(src));
  return images[0] || "";
}

function extractDateText(text) {
  const day = DAY_NAMES.join("|");
  const numericDate = `(?:${day})?,?\\s*\\d{1,2}[\\/.]\\d{1,2}[\\/.]\\d{4}\\s*г?\\.?`;
  const numericMatch = new RegExp(`${numericDate}(?:\\s*[–-]\\s*${numericDate})?`, "i").exec(text || "");
  if (numericMatch) return normalizeSpace(numericMatch[0]);

  const monthNames = Object.keys(MONTHS_BG).join("|");
  const monthMatch = new RegExp(`\\d{1,2}\\s+(?:${monthNames})(?:\\s+\\d{4})?`, "i").exec(text || "");
  return normalizeSpace(monthMatch?.[0] || "");
}

function toIsoDate(dateText) {
  const numeric = /(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/.exec(dateText || "");
  if (numeric) {
    const [, day, month, year] = numeric;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const monthNames = Object.keys(MONTHS_BG).join("|");
  const month = new RegExp(`(\\d{1,2})\\s+(${monthNames})(?:\\s+(\\d{4}))?`, "i").exec(dateText || "");
  if (!month) return "";
  const year = month[3] || String(new Date().getFullYear());
  return `${year}-${MONTHS_BG[month[2].toLowerCase()]}-${month[1].padStart(2, "0")}`;
}

function extractTimes(text) {
  const times = [...String(text || "").matchAll(/([01]?\d|2[0-3])[:.][0-5]\d/g)].map((match) => match[0].replace(".", ":").padStart(5, "0"));
  return { startTime: times[0] || "19:00", endTime: times[1] || null };
}

function inferCategory(text) {
  const value = String(text || "").toLowerCase();
  if (/концерт|опера|музик|оркестър|джаз|рок|гала|опера|мюзикъл/i.test(value)) return "concerts";
  if (/фестивал|festival|варненско лято|конкурс/i.test(value)) return "festivals";
  if (/парти|party|dj|клуб|night|бар/i.test(value)) return "nightlife";
  if (/храна|вино|кулинар|food|wine/i.test(value)) return "food";
  if (/среща|лекция|работилница|семинар|форум|образование/i.test(value)) return "meetups";
  return "culture";
}

function cleanNoise(line) {
  return !/^(снимки|image|виж всички събития|добави обект|бюлетин|начало|събития|разгледай|сподели|toggle navigation)$/i.test(line)
    && !/^резултати\s*\(/i.test(line)
    && !/^категория|ключова дума|дата от|дата до|телефон|имейл|календар/i.test(line);
}

function extractLocation(lines, dateText, title) {
  const labelLine = lines.find((line) => /^(място|локация|къде|адрес)\s*[:：]/i.test(line));
  if (labelLine) return normalizeSpace(labelLine.replace(/^(място|локация|къде|адрес)\s*[:：]/i, ""));

  const dateIndex = lines.findIndex((line) => line.includes(dateText) || extractDateText(line));
  const candidates = lines
    .slice(Math.max(0, dateIndex + 1), dateIndex > -1 ? dateIndex + 9 : 12)
    .filter((line) => cleanNoise(line))
    .filter((line) => line !== title)
    .filter((line) => !extractDateText(line))
    .filter((line) => !extractTimes(line).startTime || line.length > 22)
    .filter((line) => line.length >= 3 && line.length <= 180);

  const likely = candidates.find((line) => /галерия|дворец|зала|театър|опера|музей|градина|парк|клуб|бар|ул\.|бул\.|варна|център|сцена|фестивален/i.test(line));
  return likely || candidates[0] || "Варна";
}

function extractDescription(lines, title, dateText, location) {
  const blacklist = new Set([title, dateText, location]);
  const paragraphs = lines
    .filter((line) => cleanNoise(line))
    .filter((line) => !blacklist.has(line))
    .filter((line) => line.length >= 40)
    .filter((line) => !/^абонирай|община варна|за нас|контакт/i.test(line));
  return paragraphs.slice(0, 4).join("\n\n");
}

function extractTitle(html, fallback = "") {
  return firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)
    || firstMatch(html, /<h2[^>]*>([\s\S]*?)<\/h2>/i)
    || firstMatch(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || fallback;
}

function extractTicketUrl(html, origin) {
  for (const match of String(html || "").matchAll(/<a\b[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = stripTags(match[2]);
    if (/билет|ticket|rsvp|купи/i.test(label)) return absoluteUrl(match[1], origin);
  }
  return null;
}

function removeTrailingDateFromTitle(title) {
  return normalizeSpace(String(title || "").replace(/\s+\d{1,2}[\/.]\d{1,2}[\/.]\d{4}\s*г?\.?(?:\s*[–-]\s*\d{1,2}[\/.]\d{1,2}[\/.]\d{4}\s*г?\.?)?$/i, ""));
}

function isGenericTitle(title) {
  return /^(събития|начало|varna|visit varna)$/i.test(normalizeSpace(title));
}

function normalizeImportedEvent(raw) {
  const sourceName = raw.sourceName || raw.source || "Unknown source";
  const sourceUrl = raw.sourceUrl || "";
  const title = normalizeSpace(raw.title);
  const location = normalizeSpace(raw.location || "Варна");
  const date = raw.date || toIsoDate(raw.dateText);
  const { startTime, endTime } = extractTimes(`${raw.startTime || ""} ${raw.timeText || ""}`);
  const description = normalizeSpace(raw.fullDescription || raw.shortDescription || title);
  const category = raw.category || inferCategory(`${title} ${description}`);
  const image = raw.imageUrl || raw.image || raw.images?.[0] || FALLBACK_IMAGE;

  return {
    id: raw.id || `${slug(sourceName)}-${hash(`${title}|${date}|${location}|${sourceUrl}`)}`,
    title,
    category,
    date,
    startTime: raw.startTime || startTime,
    endTime: raw.endTime || endTime,
    location,
    coordinates: raw.coordinates || VARNA_CENTER,
    shortDescription: normalizeSpace(raw.shortDescription || description.slice(0, 260)),
    fullDescription: description,
    images: raw.images?.length ? raw.images : [image],
    sourceName,
    sourceUrl,
    ticketUrl: raw.ticketUrl || null,
    organizer: raw.organizer || null,
    tags: [...new Set([...(raw.tags || []), "varna", slug(sourceName), category].filter(Boolean))],
    badges: [...new Set([...(raw.badges || []), "verified", "foodNearby"])],
    status: "published",
    importedAt: raw.importedAt || new Date().toISOString(),
    image,
    source: sourceName
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
        "User-Agent": "VarnaHubImporter/2.0 (+https://github.com/Nostrolox/varnahub)"
      },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function extractVisitVarnaCandidates(html) {
  const source = SOURCES.visitVarna;
  const candidates = [];
  const seen = new Set();
  const anchorRegex = /<a\b[^>]+href=["']([^"']*\/bg\/event\/[^"']+\.html[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorRegex)) {
    const sourceUrl = absoluteUrl(match[1], source.origin);
    const title = stripTags(match[2]);
    if (!sourceUrl || !title || title.length < 4 || seen.has(sourceUrl)) continue;
    seen.add(sourceUrl);
    const snippet = html.slice(Math.max(0, match.index - 900), Math.min(html.length, match.index + match[0].length + 500));
    const dateText = extractDateText(stripTags(snippet));
    candidates.push({ title, dateText, date: toIsoDate(dateText), sourceUrl, imageUrl: extractImage(snippet, source.origin) });
  }
  return candidates;
}

function buildFromDetail(candidate, detailHtml, source) {
  const lines = htmlToLines(detailHtml || "");
  const detailTitle = extractTitle(detailHtml, candidate.title) || candidate.title;
  const title = removeTrailingDateFromTitle(isGenericTitle(detailTitle) ? candidate.title : detailTitle);
  const allText = [candidate.title, candidate.dateText, stripTags(detailHtml)].join(" ");
  const dateText = extractDateText(allText) || candidate.dateText;
  const times = extractTimes(allText);
  const location = extractLocation(lines, dateText, title);
  const description = extractDescription(lines, title, dateText, location) || candidate.title;

  return normalizeImportedEvent({
    title,
    date: toIsoDate(dateText) || candidate.date,
    startTime: times.startTime,
    endTime: times.endTime,
    location,
    shortDescription: description.slice(0, 260),
    fullDescription: description,
    imageUrl: extractImage(detailHtml, source.origin) || candidate.imageUrl || FALLBACK_IMAGE,
    sourceName: source.name,
    sourceUrl: candidate.sourceUrl || source.url,
    ticketUrl: extractTicketUrl(detailHtml, source.origin),
    organizer: source.name,
    tags: [source.name],
    badges: []
  });
}

export async function importFromVisitVarna({ limit = DEFAULT_LIMIT } = {}) {
  const source = SOURCES.visitVarna;
  const html = await fetchHtml(source.url);
  const candidates = extractVisitVarnaCandidates(html).slice(0, limit);
  const events = [];
  for (const [index, candidate] of candidates.entries()) {
    try {
      const detailHtml = await fetchHtml(candidate.sourceUrl);
      events.push(buildFromDetail(candidate, detailHtml, source));
    } catch (error) {
      warn(`${source.name}: detail failed for "${candidate.title}": ${error.message}`);
      events.push(buildFromDetail(candidate, "", source));
    }
    if (index < candidates.length - 1) await wait(REQUEST_DELAY_MS);
  }
  return dedupeImportedEvents(events);
}

function parseVarnaEventsListings(html, source) {
  const lines = htmlToLines(html);
  const events = [];
  for (let i = 0; i < lines.length - 3; i += 1) {
    const titleLine = lines[i];
    const timeLine = lines[i + 1];
    if (!cleanNoise(titleLine) || titleLine.length > 180 || !extractTimes(timeLine).startTime || !/[-–]|:/.test(timeLine)) continue;
    if (/днес|месец|музика|театър|музеи|телефон|имейл|контакт|община/i.test(titleLine)) continue;

    const dateText = extractDateText(titleLine) || extractDateText(timeLine);
    const date = toIsoDate(dateText);
    if (!date) continue;

    const title = removeTrailingDateFromTitle(titleLine);
    const times = extractTimes(timeLine);
    const location = cleanNoise(lines[i + 2]) ? lines[i + 2] : "Варна";
    const descLines = [];
    for (let j = i + 3; j < Math.min(lines.length, i + 14); j += 1) {
      if (/добави в календар/i.test(lines[j])) break;
      if (j > i + 3 && extractTimes(lines[j]).startTime && /[-–]/.test(lines[j])) break;
      if (cleanNoise(lines[j])) descLines.push(lines[j]);
    }
    const fullDescription = descLines.join("\n\n") || title;
    events.push(normalizeImportedEvent({
      title,
      date,
      startTime: times.startTime,
      endTime: times.endTime,
      location,
      shortDescription: fullDescription.slice(0, 260),
      fullDescription,
      imageUrl: extractImage(html, source.origin) || FALLBACK_IMAGE,
      sourceName: source.name,
      sourceUrl: source.url,
      ticketUrl: extractTicketUrl(fullDescription, source.origin),
      organizer: "Община Варна",
      tags: [source.name],
      badges: /вход свободен|безплат/i.test(fullDescription) ? ["free"] : []
    }));
  }
  return dedupeImportedEvents(events);
}

export async function importFromVarnaEvents({ limit = DEFAULT_LIMIT } = {}) {
  const source = SOURCES.varnaEvents;
  const html = await fetchHtml(source.url);
  return parseVarnaEventsListings(html, source).slice(0, limit);
}

function parseVarnaCultureListings(html, source) {
  const lines = htmlToLines(html);
  const start = Math.max(0, lines.findIndex((line) => /предстоящи събития/i.test(line)));
  const end = lines.findIndex((line, index) => index > start && /последни новини/i.test(line));
  const scope = lines.slice(start, end > start ? end : lines.length);
  const events = [];

  for (let i = 0; i < scope.length - 2; i += 1) {
    const title = removeTrailingDateFromTitle(scope[i]);
    const dateText = extractDateText(scope[i + 1]);
    const date = toIsoDate(dateText);
    if (!date || title.length < 3 || title.length > 180 || !cleanNoise(title)) continue;

    const location = scope.slice(i + 2, i + 7).find((line) => cleanNoise(line) && !extractDateText(line) && !/^\*+$/.test(line)) || "Варна";
    events.push(normalizeImportedEvent({
      title,
      date,
      startTime: "19:00",
      endTime: null,
      location,
      shortDescription: title,
      fullDescription: `${title}\n\n${dateText}\n\n${location}`,
      imageUrl: extractImage(html, source.origin) || FALLBACK_IMAGE,
      sourceName: source.name,
      sourceUrl: source.url,
      ticketUrl: extractTicketUrl(html, source.origin),
      organizer: "Община Варна - Дирекция култура",
      tags: [source.name, "culture"],
      badges: []
    }));
  }
  return dedupeImportedEvents(events);
}

export async function importFromVarnaCulture({ limit = DEFAULT_LIMIT } = {}) {
  const source = SOURCES.varnaCulture;
  const html = await fetchHtml(source.url);
  return parseVarnaCultureListings(html, source).slice(0, limit);
}

export async function importAllEvents(options = {}) {
  const startedAt = new Date().toISOString();
  const importers = [
    ["Visit Varna", () => importFromVisitVarna(options)],
    ["Varna Events", () => importFromVarnaEvents(options)],
    ["Varna Culture", () => importFromVarnaCulture(options)]
  ];

  const settled = await Promise.allSettled(importers.map(([, importer]) => importer()));
  const events = [];
  const errors = [];

  for (const [index, result] of settled.entries()) {
    const sourceName = importers[index][0];
    if (result.status === "fulfilled") {
      events.push(...result.value.map((event) => ({ ...event, importedAt: startedAt })));
    } else {
      warn(`${sourceName} failed: ${result.reason?.message || result.reason}`);
      errors.push({ sourceName, message: result.reason?.message || String(result.reason) });
    }
  }

  return {
    events: dedupeImportedEvents(events),
    errors,
    importedAt: startedAt
  };
}
