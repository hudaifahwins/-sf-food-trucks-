const DATA_URL = "https://data.sf.gov/resource/rqzj-sfat.json";

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

export async function getFoodTrucks({ query = "", limit = "1000", fetcher = fetch } = {}) {
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 1000, 1), 2000);
  const params = new URLSearchParams({
    "$limit": String(safeLimit),
    "$where": "latitude IS NOT NULL AND longitude IS NOT NULL"
  });
  if (query.trim()) {
    params.set("$q", query.trim().slice(0, 100));
  }

  const response = await fetcher(`${DATA_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`DataSF request failed with ${response.status}`);
  }
  const records = await response.json();
  return records.map(normalizeTruck).filter(Boolean);
}
