const DATA_URL = "https://data.sf.gov/resource/rqzj-sfat.json";
const CACHE_TTL_MS = 60_000;
const cache = new Map();

function toNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeTruck(record) {
  const latitude = toNumber(record.latitude);
  const longitude = toNumber(record.longitude);
  if (latitude === null || longitude === null) return null;

  return {
    id: `${record.locationid || record.applicant || "truck"}-${latitude}-${longitude}`,
    name: record.applicant || "Unnamed food truck",
    address: record.address || "San Francisco",
    foodItems: record.fooditems || "Menu not listed",
    schedule: record.dayshours || "Schedule not listed",
    latitude,
    longitude,
    status: record.status || "Unknown"
  };
}

export function distanceInMiles(latitude, longitude, truck) {
  const radians = Math.PI / 180;
  const lat1 = latitude * radians;
  const lat2 = truck.latitude * radians;
  const deltaLat = (truck.latitude - latitude) * radians;
  const deltaLon = (truck.longitude - longitude) * radians;
  const arc = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

export async function getFoodTrucks({ query = "", limit = "1000", fetcher = fetch } = {}) {
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 1000, 1), 2000);
  const cacheKey = `${query.trim().toLowerCase()}:${safeLimit}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) return cached.data;

  const params = new URLSearchParams({
    "$limit": String(safeLimit),
    "$where": "latitude IS NOT NULL AND longitude IS NOT NULL"
  });
  if (query.trim()) {
    params.set("$q", query.trim().slice(0, 100));
  }

  try {
    const response = await fetcher(`${DATA_URL}?${params}`);
    if (!response.ok) {
      throw new Error(`DataSF request failed with ${response.status}`);
    }
    const records = (await response.json()).map(normalizeTruck).filter(Boolean);
    cache.set(cacheKey, { createdAt: Date.now(), data: records });
    return records;
  } catch (error) {
    if (cached) return cached.data;
    throw error;
  }
}

export async function getNearbyFoodTrucks({ latitude, longitude, radius = "5", query = "", fetcher = fetch } = {}) {
  const safeRadius = Math.min(Math.max(Number(radius) || 5, 0.1), 25);
  const trucks = await getFoodTrucks({ query, limit: "2000", fetcher });
  return trucks
    .map((truck) => ({ ...truck, distanceMiles: distanceInMiles(latitude, longitude, truck) }))
    .filter((truck) => truck.distanceMiles <= safeRadius)
    .sort((a, b) => a.distanceMiles - b.distanceMiles);
}
