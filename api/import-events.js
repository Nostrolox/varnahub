import { importAllEvents } from "../server/eventImportParsers.mjs";

export default async function handler(request, response) {
  if (request.method && request.method !== "GET") {
    response.status(405).json({ events: [], errors: [{ sourceName: "Varna Hub", message: "Method not allowed" }] });
    return;
  }

  try {
    const result = await importAllEvents();
    response.setHeader("Cache-Control", "s-maxage=43200, stale-while-revalidate=3600");
    response.status(200).json(result);
  } catch (error) {
    console.warn("[event-import] API import failed safely:", error);
    response.status(200).json({
      events: [],
      errors: [{ sourceName: "Varna Hub", message: error?.message || "Import failed" }],
      importedAt: new Date().toISOString()
    });
  }
}
