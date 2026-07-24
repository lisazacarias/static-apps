// shared/geo.js — routing + origin helpers (no personal data committed)
const OSRM = "https://router.project-osrm.org";

// Generic public fallback: Hayward city centroid. NOT your home.
export const HAYWARD_FALLBACK = [-122.0808, 37.6688];

export function getSavedOrigin() {
  const s = localStorage.getItem("myOrigin");
  return s ? JSON.parse(s) : null;
}

export function saveOrigin(lng, lat) {
  localStorage.setItem("myOrigin", JSON.stringify([lng, lat]));
}

function browserGeolocate() {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      p => resolve([p.coords.longitude, p.coords.latitude]),
      () => resolve(null),
      { maximumAge: 600000, timeout: 8000 }
    );
  });
}

// Resolve origin privately: saved → live geolocation → generic fallback.
export async function resolveOrigin() {
  return getSavedOrigin()
      || await browserGeolocate()
      || HAYWARD_FALLBACK;
}

// One origin → many destinations, driving seconds via OSRM Table service.
export async function driveTimes(origin, destinations) {
  const coords = [origin, ...destinations].map(c => c.join(",")).join(";");
  const url = `${OSRM}/table/v1/driving/${coords}?sources=0&annotations=duration`;
  const r = await fetch(url);
  const j = await r.json();
  const secs = j.durations?.[0] || [];
  return destinations.map((_, i) => secs[i + 1]); // seconds, aligned to destinations
}

// Geocode an address to [lng, lat] via Nominatim (keyless).
export async function geocode(address) {
  const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&q="
            + encodeURIComponent(address);
  const r = await fetch(url);
  const j = await r.json();
  if (!j.length) return null;
  return [parseFloat(j[0].lon), parseFloat(j[0].lat)];
}

export function clearSavedOrigin() {
  localStorage.removeItem("myOrigin");
}