const http = require("node:http");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const dataPath = join(__dirname, "..", "src", "data", "varnaParkingData.json");
const parkingData = JSON.parse(readFileSync(dataPath, "utf8"));
const port = process.env.PORT || 4000;

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  });
  response.end(JSON.stringify(payload, null, 2));
}

const server = http.createServer((request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    response.end();
    return;
  }

  if (request.url === "/api/parking") {
    sendJson(response, 200, parkingData);
    return;
  }

  if (request.url === "/api/spots") {
    sendJson(response, 200, { spots: parkingData.spots });
    return;
  }

  if (request.url === "/api/zones") {
    sendJson(response, 200, {
      zones: parkingData.zones,
      restrictedAreas: parkingData.restrictedAreas
    });
    return;
  }

  sendJson(response, 404, { error: "Not found" });
});

server.listen(port, () => {
  console.log(`Varna Parking mock backend running at http://localhost:${port}`);
});
