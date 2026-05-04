import { importAllPlaces } from "../server/placeImportParsers.mjs";

export default async function handler(request, response) {
  if (request.method && request.method !== "GET") {
    response.status(405).json({ places: [], errors: [{ sourceName: "Varna Hub", message: "Method not allowed" }] });
    return;
  }

  try {
    const result = await importAllPlaces();
    response.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=3600");
    response.status(200).json(result);
  } catch (error) {
    console.warn("[place-import] API import failed safely:", error);
    response.status(200).json({
      places: [],
      errors: [{ sourceName: "Varna Hub", message: error?.message || "Place import failed" }],
      importedAt: new Date().toISOString()
    });
  }
}
