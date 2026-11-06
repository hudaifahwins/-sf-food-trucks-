const map = L.map("map", { zoomControl: false }).setView([37.7749, -122.4194], 12);
L.control.zoom({ position: "bottomleft" }).addTo(map);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

const markerLayer = L.layerGroup().addTo(map);
const searchInput = document.querySelector("#search");
const results = document.querySelector("#results");
const count = document.querySelector("#count");
const clearButton = document.querySelector("#clear");
let trucks = [];
let debounceTimer;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[character]));
}

function render(items) {
  markerLayer.clearLayers();
  count.textContent = items.length;
  clearButton.hidden = !searchInput.value;
  if (!items.length) {
    results.innerHTML = '<p class="empty">No trucks matched that search. Try a broader cuisine or ingredient.</p>';
    return;
  }

  results.innerHTML = items.slice(0, 80).map((truck, index) => `
    <article class="truck-card">
      <h3>${escapeHtml(truck.name)}</h3>
      <p>${escapeHtml(truck.foodItems)}</p>
      <p>${escapeHtml(truck.address)}</p>
      <button type="button" data-index="${index}">View on map →</button>
    </article>
  `).join("");

  items.forEach((truck) => {
    const marker = L.circleMarker([truck.latitude, truck.longitude], {
      radius: 7, color: "#fffefa", weight: 2, fillColor: "#e97947", fillOpacity: .95
    });
    marker.bindPopup(`<strong>${escapeHtml(truck.name)}</strong><br>${escapeHtml(truck.foodItems)}<br><small>${escapeHtml(truck.address)}</small>`);
    marker.addTo(markerLayer);
  });
}

async function loadTrucks(query = "") {
  results.innerHTML = '<p class="empty">Loading the latest listings...</p>';
  try {
    const apiUrl = window.location.hostname.endsWith("github.io")
      ? `https://data.sfgov.org/resource/rqzj-sfat.json?$limit=1000&$where=latitude IS NOT NULL AND longitude IS NOT NULL${query ? `&$q=${encodeURIComponent(query)}` : ""}`
      : `/api/food-trucks${query ? `?q=${encodeURIComponent(query)}` : ""}`;
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error("Request failed");
    const payload = await response.json();
    trucks = Array.isArray(payload) ? payload.map((record) => ({
      id: `${record.locationid || record.applicant || "truck"}-${record.latitude}-${record.longitude}`,
      name: record.applicant || "Unnamed food truck",
      address: record.address || "San Francisco",
      foodItems: record.fooditems || "Menu not listed",
      schedule: record.dayshours || "Schedule not listed",
      latitude: Number(record.latitude),
      longitude: Number(record.longitude),
      status: record.status || "Unknown"
    })) : payload.data;
    render(trucks);
  } catch {
    results.innerHTML = '<p class="empty">We could not load listings right now. Please try again in a moment.</p>';
    count.textContent = "—";
  }
}

searchInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => loadTrucks(searchInput.value.trim()), 250);
});
clearButton.addEventListener("click", () => {
  searchInput.value = "";
  loadTrucks();
  searchInput.focus();
});
results.addEventListener("click", (event) => {
  const button = event.target.closest("[data-index]");
  if (!button) return;
  const truck = trucks[Number(button.dataset.index)];
  map.flyTo([truck.latitude, truck.longitude], 16);
});
document.querySelector("#locate").addEventListener("click", () => {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(({ coords }) => {
    map.flyTo([coords.latitude, coords.longitude], 14);
    L.marker([coords.latitude, coords.longitude]).addTo(map).bindPopup("You are here").openPopup();
  });
});
loadTrucks();
