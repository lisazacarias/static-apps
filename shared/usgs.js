// ==========================================================================
// Shared USGS water-data helper.
// Auto-discovers a nearby real-time water-temperature station (param 00010)
// for a given coordinate, then fetches its current temperature.
// CORS-enabled, keyless.
// ==========================================================================

const SITE   = "https://waterservices.usgs.gov/nwis/site/";
const VALUES = "https://waterservices.usgs.gov/nwis/iv/";

// Build a bounding box (degrees) around [lng, lat]. ~0.2° ≈ 12–14 miles.
function bbox([lng, lat], pad = 0.2) {
  const w = (lng - pad).toFixed(6), s = (lat - pad).toFixed(6);
  const e = (lng + pad).toFixed(6), n = (lat + pad).toFixed(6);
  return `${w},${s},${e},${n}`;
}

function haversine(aLng, aLat, bLng, bLat) {
  const R = 3959, toR = d => d * Math.PI / 180;
  const dLat = toR(bLat - aLat), dLng = toR(bLng - aLng);
  const x = Math.sin(dLat/2)**2 +
            Math.cos(toR(aLat)) * Math.cos(toR(bLat)) * Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Find the nearest site to `coords` that has real-time water temperature.
// Returns { siteId, miles } or null. Uses RDB (tab-delimited) output.
export async function findTempSite(coords) {
  try {
    const url = `${SITE}?format=rdb&bBox=${bbox(coords, 0.05)}`   // ~3.5 mi box
              + `&parameterCd=00010&hasDataTypeCd=iv`
              + `&siteType=LK`                                     // lakes/reservoirs ONLY
              + `&siteStatus=active`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const text = await r.text();
    const lines = text.split("\n").filter(l => l && !l.startsWith("#"));
    if (lines.length < 3) return null;
    const header = lines[0].split("\t");
    const iNo  = header.indexOf("site_no");
    const iLat = header.indexOf("dec_lat_va");
    const iLng = header.indexOf("dec_long_va");

    let best = null;
    for (const line of lines.slice(2)) {
      const c = line.split("\t");
      const siteId = c[iNo];
      const lat = parseFloat(c[iLat]), lng = parseFloat(c[iLng]);
      if (!siteId || isNaN(lat) || isNaN(lng)) continue;
      const miles = haversine(coords[0], coords[1], lng, lat);
      if (miles > 5) continue;                    // reject far sensors
      if (!best || miles < best.miles) best = { siteId, miles };
    }
    return best;
  } catch (e) {
    console.warn("USGS site discovery failed:", e.message);
    return null;
  }
}

// Current water temp (°F) for a site, or null.
export async function waterTempF(siteId) {
  try {
    const url = `${VALUES}?format=rdb&sites=${siteId}&parameterCd=00010&siteStatus=active`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const text = await r.text();
    const lines = text.split("\n").filter(l => l && !l.startsWith("#"));
    if (lines.length < 3) return null;
    const header = lines[0].split("\t");
    // temp column ends with "_00010_00003" (daily mean) or "_00010" variants
    const iTemp = header.findIndex(h => /_00010(_|$)/.test(h));
    if (iTemp === -1) return null;
    // last data row = most recent
    const last = lines[lines.length - 1].split("\t");
    const c = parseFloat(last[iTemp]);
    if (isNaN(c) || c <= 0 || c > 40) return null;   // clamp implausible values
    return Math.round(c * 9 / 5 + 32);
  } catch (e) {
    console.warn("USGS temp fetch failed for", siteId, e.message);
    return null;
  }
}

// One-shot: discover nearest temp station for coords, return current °F or null.
export async function waterTempForCoords(coords) {
  const site = await findTempSite(coords);
  if (!site) return null;
  const tempF = await waterTempF(site.siteId);
  return tempF == null ? null : { tempF, siteId: site.siteId, miles: Math.round(site.miles) };
}