const DEFAULT_CENTER = [37.7749, -122.4194];
const map = L.map("map", { zoomControl: false }).setView(DEFAULT_CENTER, 12);
L.control.zoom({ position: "bottomleft" }).addTo(map);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

const markerLayer = L.layerGroup().addTo(map);
const searchInput = document.querySelector("#search");
const results = document.querySelector("#results");
const count = document.querySelector("#count");
const visibleCount = document.querySelector("#visible-count");
const clearButton = document.querySelector("#clear");
const status = document.querySelector("#result-status");
const updated = document.querySelector("#updated");
const sortNearby = document.querySelector("#sort-nearby");
let trucks = [];
let userLocation = null;
let sortByDistance = false;
let debounceTimer;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[character]));
}

function distanceInMiles(from, truck) {
  const [lat1, lon1] = from;
  const lat2 = truck.latitude * Math.PI / 180;
  const lon2 = truck.longitude * Math.PI / 180;
  const lat1Radians = lat1 * Math.PI / 180;
  const lon1Radians = lon1 * Math.PI / 180;
  const a = Math.sin((lat2 - lat1Radians) / 2) ** 2 +
    Math.cos(lat1Radians) * Math.cos(lat2) * Math.sin((lon2 - lon1Radians) / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function currentItems() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = query
    ? trucks.filter((truck) => `${truck.name} ${truck.foodItems} ${truck.address}`.toLowerCase().includes(query))
    : [...trucks];
  if (sortByDistance && userLocation) {
    filtered.sort((a, b) => distanceInMiles(userLocation, a) - distanceInMiles(userLocation, b));
  }
  return filtered;
}

function render(items) {
  markerLayer.clearLayers();
  visibleCount.textContent = items.length;
  status.textContent = items.length === trucks.length ? "All listings" : `${items.length} found`;
  clearButton.hidden = !searchInput.value;

  if (!items.length) {
    results.innerHTML = `<div class="empty-state"><span class="empty-icon">⌕</span><h3>No exact matches</h3><p>Try a broader search, like “tacos”, “coffee”, or “dessert”.</p></div>`;
    return;
  }

  results.innerHTML = items.slice(0, 100).map((truck, index) => {
    const distance = userLocation ? `<span class="distance">${distanceInMiles(userLocation, truck).toFixed(1)} mi away</span>` : "";
    return `<article class="truck-card">
      <div class="card-topline"><span class="card-number">${String(index + 1).padStart(2, "0")}</span>${distance}</div>
      <h3>${escapeHtml(truck.name)}</h3>
      <p class="food-items">${escapeHtml(truck.foodItems)}</p>
      <div class="card-footer"><span class="address">${escapeHtml(truck.address)}</span><button type="button" data-index="${index}">View pin <span>↗</span></button></div>
    </article>`;
  }).join("");

  items.forEach((truck) => {
    const marker = L.circleMarker([truck.latitude, truck.longitude], {
      radius: 7, color: "#fffefa", weight: 2, fillColor: "#e8794f", fillOpacity: .95
    });
    marker.bindPopup(`<strong>${escapeHtml(truck.name)}</strong><br>${escapeHtml(truck.foodItems)}<br><small>${escapeHtml(truck.address)}</small>`);
    marker.addTo(markerLayer);
  });
}

function setLoading() {
  status.textContent = "Loading";
  results.innerHTML = `<div class="loading-state"><span class="loader"></span><p>Finding the city’s best bites…</p></div>`;
}

function normalizeRecords(records) {
  return records.map((record) => ({
    id: `${record.locationid || record.applicant || "truck"}-${record.latitude}-${record.longitude}`,
    name: record.applicant || "Unnamed food truck",
    address: record.address || "San Francisco",
    foodItems: record.fooditems || "Menu not listed",
    schedule: record.dayshours || "Schedule not listed",
    latitude: Number(record.latitude),
    longitude: Number(record.longitude),
    status: record.status || "Unknown"
  })).filter((truck) => Number.isFinite(truck.latitude) && Number.isFinite(truck.longitude));
}

async function loadTrucks() {
  setLoading();
  try {
    const apiUrl = window.location.hostname.endsWith("github.io")
      ? "https://data.sf.gov/resource/rqzj-sfat.json?$limit=1000&$where=latitude IS NOT NULL AND longitude IS NOT NULL"
      : "/api/food-trucks?limit=1000";
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error("Request failed");
    const payload = await response.json();
    trucks = normalizeRecords(Array.isArray(payload) ? payload : payload.data);
    count.textContent = trucks.length;
    updated.textContent = `Updated just now · ${trucks.length} locations`;
    sortNearby.hidden = false;
    render(currentItems());
  } catch (error) {
    console.error(error);
    status.textContent = "Offline";
    updated.textContent = "DataSF could not be reached";
    count.textContent = "—";
    results.innerHTML = `<div class="empty-state"><span class="empty-icon">!</span><h3>Listings are taking a pause</h3><p>We could not connect to DataSF. Check your connection and try again.</p><button id="retry" class="retry-button" type="button">Try again</button></div>`;
  }
}

function updateResults() {
  render(currentItems());
}

searchInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(updateResults, 120);
});
document.querySelectorAll("[data-query]").forEach((button) => {
  button.addEventListener("click", () => {
    searchInput.value = button.dataset.query;
    updateResults();
    searchInput.focus();
  });
});
clearButton.addEventListener("click", () => {
  searchInput.value = "";
  updateResults();
  searchInput.focus();
});
sortNearby.addEventListener("click", () => {
  if (!userLocation) return;
  sortByDistance = !sortByDistance;
  sortNearby.textContent = sortByDistance ? "Default order" : "Nearest first";
  updateResults();
});
results.addEventListener("click", (event) => {
  if (event.target.closest("#retry")) {
    loadTrucks();
    return;
  }
  const button = event.target.closest("[data-index]");
  if (!button) return;
  const truck = currentItems()[Number(button.dataset.index)];
  map.flyTo([truck.latitude, truck.longitude], 16, { duration: .8 });
});
document.querySelector("#reset-map").addEventListener("click", () => map.setView(DEFAULT_CENTER, 12));
document.querySelector("#locate").addEventListener("click", () => {
  if (!navigator.geolocation) return;
  const button = document.querySelector("#locate");
  button.classList.add("is-loading");
  navigator.geolocation.getCurrentPosition(({ coords }) => {
    userLocation = [coords.latitude, coords.longitude];
    sortNearby.hidden = false;
    sortByDistance = true;
    sortNearby.textContent = "Default order";
    map.flyTo(userLocation, 14);
    L.circleMarker(userLocation, { radius: 8, color: "#183c2b", fillColor: "#fffefa", fillOpacity: 1, weight: 3 }).addTo(map).bindPopup("You are here").openPopup();
    updateResults();
    button.classList.remove("is-loading");
  }, () => button.classList.remove("is-loading"));
});
loadTrucks();
