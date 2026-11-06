import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { getFoodTrucks, getNearbyFoodTrucks } from "./src/data.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicRoot = join(root, "public");
const port = Number(process.env.PORT || 3000);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

async function serveStatic(response, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = normalize(join(publicRoot, requested));
  if (!filePath.startsWith(publicRoot)) {
    json(response, 403, { error: "Forbidden" });
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff"
    });
    response.end(body);
  } catch (error) {
    if (error.code === "ENOENT") {
      json(response, 404, { error: "Not found" });
      return;
    }
    throw error;
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    if (request.method === "GET" && url.pathname === "/api/food-trucks") {
      const trucks = await getFoodTrucks({
        query: url.searchParams.get("q") || "",
        limit: url.searchParams.get("limit") || "1000"
      });
      json(response, 200, { data: trucks, count: trucks.length });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/food-trucks/nearby") {
      const latitude = Number(url.searchParams.get("lat"));
      const longitude = Number(url.searchParams.get("lng"));
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        json(response, 400, { error: "Valid lat and lng coordinates are required." });
        return;
      }
      const trucks = await getNearbyFoodTrucks({
        latitude,
        longitude,
        radius: url.searchParams.get("radius") || "5",
        query: url.searchParams.get("q") || ""
      });
      json(response, 200, { data: trucks, count: trucks.length });
      return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      json(response, 200, { status: "ok", service: "sf-food-trucks" });
      return;
    }

    if (request.method === "GET") {
      await serveStatic(response, url.pathname);
      return;
    }

    json(response, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    json(response, 502, { error: "The food truck data service is temporarily unavailable." });
  }
});

server.listen(port, () => {
  console.log(`SF Food Trucks running at http://localhost:${port}`);
});
