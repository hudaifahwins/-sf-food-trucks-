# Roam & Relish

A full-stack San Francisco food truck explorer built for the coding challenge. Search by truck, cuisine, or ingredient; browse live listings on a map; and use browser geolocation to center the map near you.

## Stack

- **Backend:** Node.js 20 built-in HTTP server, with a small REST API.
- **Frontend:** Semantic HTML, responsive CSS, and vanilla JavaScript.
- **Map:** Leaflet with OpenStreetMap tiles.
- **Data:** [DataSF Food Trucks](https://data.sfgov.org/Health-and-Safety/Mobile-Food-Facility-Permit/rqzj-sfat/about).

## Run locally

```bash
npm test
npm run check
npm start
```

Open <http://localhost:3000>. The API includes:

- `GET /api/food-trucks?q=tacos&limit=100` — normalized listings.
- `GET /api/food-trucks/nearby?lat=37.77&lng=-122.42&radius=3&q=tacos` — radius-filtered, nearest-first discovery with distance metadata.
- `GET /health` — deployment health check.

The frontend also supports a static GitHub Pages deployment. Every push to `main` publishes `public/` through `.github/workflows/deploy-pages.yml`; on Pages, the browser queries the public DataSF endpoint directly.

The server proxies DataSF so the browser has a same-origin API, the upstream query is bounded, and the UI is not coupled to the provider’s raw schema. Responses are cached in memory for 60 seconds and stale cached data is served if DataSF briefly fails. The nearby endpoint caps the radius at 25 miles to protect the upstream and response size. DataSF availability is required for a cold start; no API key is needed.

## Production notes

Set `PORT` in the deployment environment. The service is stateless and can run on any Node 20 host or container. For a production deployment, add an upstream cache (for example, 30–60 seconds), structured request logging, and a Content Security Policy allowing the chosen tile/font providers.

## Experience

This prototype intentionally uses platform APIs and vanilla JavaScript to keep the runtime small and make the service boundary clear. The backend track would be a natural extension: publish an OpenAPI document, add rate limiting, and persist a normalized cache for resilience when DataSF is unavailable.
