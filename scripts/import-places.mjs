import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PLACE_IMPORT_REFRESH_MS, importAllPlaces } from "../server/placeImportParsers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const OUTPUT_PATH = path.join(ROOT_DIR, "src", "data", "importedPlaces.json");
const force = process.argv.includes("--force");
const dryRun = process.argv.includes("--dry-run");

function log(message) {
  console.log(`[place-import] ${message}`);
}

function warn(message) {
  console.warn(`[place-import] ${message}`);
}

async function readExistingPlaces() {
  if (!existsSync(OUTPUT_PATH)) return [];
  try {
    return JSON.parse(await readFile(OUTPUT_PATH, "utf8"));
  } catch (error) {
    warn(`Could not read existing place cache: ${error.message}`);
    return [];
  }
}

function wasUpdatedRecently(places) {
  const latest = Math.max(...places.map((place) => Date.parse(place.importedAt || "") || 0), 0);
  return latest && Date.now() - latest < PLACE_IMPORT_REFRESH_MS;
}

try {
  const existing = await readExistingPlaces();
  if (!force && wasUpdatedRecently(existing)) {
    log("Place import cache is less than 24 hours old. Use --force to refresh manually.");
    process.exit(0);
  }

  const result = await importAllPlaces();
  if (result.errors.length) {
    for (const error of result.errors) warn(`${error.sourceName}: ${error.message}`);
  }

  const places = result.places.length ? result.places : existing;
  if (!result.places.length) warn("No fresh places were imported. Keeping the existing cache.");

  if (dryRun) {
    log(`Dry run complete. ${places.length} places would be written.`);
  } else {
    await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(OUTPUT_PATH, `${JSON.stringify(places, null, 2)}\n`, "utf8");
    log(`Wrote ${places.length} places to ${path.relative(ROOT_DIR, OUTPUT_PATH)}.`);
  }
} catch (error) {
  warn(`Place import failed safely: ${error.message}`);
  warn("The existing place data was not changed. You can still paste places manually in the admin panel.");
}
