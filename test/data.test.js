import test from "node:test";
import assert from "node:assert/strict";
import { getFoodTrucks, normalizeTruck } from "../src/data.js";

test("normalizes a DataSF record into the public API shape", () => {
  assert.deepEqual(normalizeTruck({
    locationid: "123",
    applicant: "Taco Time",
    address: "1 Market St",
    fooditems: "Tacos: Burritos",
    dayshours: "Mo-Fr:10AM-2PM",
    latitude: "37.7936",
    longitude: "-122.3965",
    status: "APPROVED"
  }), {
    id: "123-37.7936--122.3965",
    name: "Taco Time",
    address: "1 Market St",
    foodItems: "Tacos: Burritos",
    schedule: "Mo-Fr:10AM-2PM",
    latitude: 37.7936,
    longitude: -122.3965,
    status: "APPROVED"
  });
});

test("drops records without usable coordinates", () => {
  assert.equal(normalizeTruck({ applicant: "Missing Map Pin", latitude: "", longitude: "-122" }), null);
});

test("queries DataSF and caps the requested limit", async () => {
  let requestedUrl;
  const trucks = await getFoodTrucks({
    query: "taco",
    limit: "99999",
    fetcher: async (url) => {
      requestedUrl = url;
      return { ok: true, json: async () => [{ applicant: "Taco Time", latitude: "37", longitude: "-122" }] };
    }
  });

  assert.equal(new URL(requestedUrl).searchParams.get("$limit"), "2000");
  assert.equal(new URL(requestedUrl).searchParams.get("$q"), "taco");
  assert.equal(trucks[0].name, "Taco Time");
});
