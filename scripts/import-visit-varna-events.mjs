import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { IMPORT_REFRESH_MS, importAllEvents } from "../server/eventImportParsers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const OUTPUT_PATH = path.join(ROOT_DIR, "src", "data", "importedVisitVarnaEvents.json");
const force = process.argv.includes("--force");
const dryRun = process.argv.includes("--dry-run");

function log(message) {
  console.log(`[event-import] ${message}`);
}

function warn(message) {
  console.warn(`[event-import] ${message}`);
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
  const latest = Math.max(...events.map((event) => Date.parse(event.importedAt || event.lastUpdated || "") || 0), 0);
  return latest && Date.now() - latest < IMPORT_REFRESH_MS;
}

try {
  const existing = await readExistingEvents();
  if (!force && wasUpdatedRecently(existing)) {
    log("Import cache is less than 12 hours old. Use --force to refresh manually.");
    process.exit(0);
  }

  const result = await importAllEvents();
  if (result.errors.length) {
    for (const error of result.errors) warn(`${error.sourceName}: ${error.message}`);
  }

  const events = result.events.length ? result.events : existing;
  if (!result.events.length) warn("No fresh events were imported. Keeping the existing cache.");

  if (dryRun) {
    log(`Dry run complete. ${events.length} events would be written.`);
  } else {
    await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(OUTPUT_PATH, `${JSON.stringify(events, null, 2)}\n`, "utf8");
    log(`Wrote ${events.length} events to ${path.relative(ROOT_DIR, OUTPUT_PATH)}.`);
  }
} catch (error) {
  warn(`Import failed safely: ${error.message}`);
  warn("The existing site data was not changed. You can still paste events manually in the admin panel.");
}
