// ==========================================================================
// SUP Algae Advisory Tracker
// Data: California FHAB (Freshwater Harmful Algal Bloom) open dataset
// Source: https://data.ca.gov/dataset/surface-water-freshwater-harmful-algal-blooms
// ==========================================================================

import { CKAN, queryResource, getField } from "../../shared/ckan.js";

// ---- Config -------------------------------------------------------------
const DATASET = "surface-water-freshwater-harmful-algal-blooms";

// Confirmed resource IDs (used as fallback if package_show fails).
const FALLBACK_RESOURCE_IDS = [
  "c6a36b91-ad38-4611-8750-87ee99e497dd", // FHABS BLOOM REPORTS (active, primary)
  "67648948-034f-4882-bbc0-c07c7d38daf9", // FHABS CASES
  "4283c060-c22f-48f5-a75c-8bccf0c54a99", // FHABS RESPONSES
];

// Real column names (confirmed from the API schema).
const WATERBODY_FIELDS = ["Water_Body_Name", "Official_Water_Body_Name", "Case_Water_Body_Name"];
const DATE_FIELDS      = ["Observation_Date", "Bloom_Date_Created"];
const ADVISORY_TEXT_FIELDS = ["Reported_Advisory_Types", "AdvisoryDetail", "Advisory_Detail_Description"];
const ADVISORY_START = "AdvisoryStartDate";
const ADVISORY_END   = "AdvisoryEndDate";

// Advisory tiers, worst-first.
const TIERS = ["danger", "warning", "caution"];

// Distance tiers mirror the original spot list.
const TIER_WEEKDAY  = "📅 Weekday Only (crowded on weekends)";
const TIER_ANYDAY   = "✅ Good Any Day";
const TIER_NOTALLOW = "🚫 Not Allowed";
const GROUP_ORDER = [TIER_ANYDAY, TIER_WEEKDAY, TIER_NOTALLOW];

// Candidate spots. `match` = substrings to look for in the waterbody name.
const SPOTS = [
  { name: "Del Valle Reservoir",   match: ["del valle"],            dist: "1 hr",        group: TIER_WEEKDAY },
  { name: "Lake Berryessa",        match: ["berryessa"],            dist: "2 hrs",       group: TIER_WEEKDAY },
  { name: "Clear Lake",            match: ["clear lake"],           dist: "3 hrs",       group: TIER_WEEKDAY },
  { name: "Lake Natoma",           match: ["natoma"],               dist: "2.5-3.5 hrs", group: TIER_WEEKDAY },
  { name: "Folsom Lake",           match: ["folsom"],               dist: "2.5-3.5 hrs", group: TIER_WEEKDAY },
  { name: "Bass Lake",             match: ["bass lake"],            dist: "3 hrs",       group: TIER_WEEKDAY },
  { name: "Millerton Lake",        match: ["millerton"],            dist: "3.5 hrs",     group: TIER_WEEKDAY },
  { name: "Pyramid Lake",          match: ["pyramid"],              dist: "4 hrs",       group: TIER_WEEKDAY },
  { name: "Shadow Cliffs",         match: ["shadow cliff"],         dist: "40 min",      group: TIER_ANYDAY },
  { name: "Contra Loma Reservoir", match: ["contra loma"],          dist: "1.5 hrs",     group: TIER_ANYDAY },
  { name: "Don Pedro Reservoir",   match: ["don pedro"],            dist: "2.5 hrs",     group: TIER_ANYDAY },
  { name: "New Melones Reservoir", match: ["new melones","melones"],dist: "2.5 hrs",     group: TIER_ANYDAY },
  { name: "Lake Nacimiento",       match: ["nacimiento"],           dist: "3.5 hrs",     group: TIER_ANYDAY },
  { name: "Lake San Antonio",      match: ["san antonio"],          dist: "3.5 hrs",     group: TIER_ANYDAY },
  { name: "Lake Chabot",           match: ["chabot"],               dist: "15-20 min",   group: TIER_NOTALLOW },
];

// ---- Fetch --------------------------------------------------------------
async function getResourceIds() {
  try {
    const r = await fetch(`${CKAN}/package_show?id=${DATASET}`);
    const j = await r.json();
    if (!j.success) throw new Error("package_show unsuccessful");
    const ids = j.result.resources.filter(x => x.datastore_active).map(x => x.id);
    return ids.length ? ids : FALLBACK_RESOURCE_IDS;
  } catch (e) {
    console.warn("Using fallback resource IDs:", e.message);
    return FALLBACK_RESOURCE_IDS;
  }
}

// ---- Helpers ------------------------------------------------------------
function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

const ACTIVE_WINDOW_DAYS = 120; // an "ongoing" advisory is only trusted if recent activity exists

function daysAgo(d) {
  return d ? (Date.now() - d) / 86400000 : Infinity;
}

function recentReportedAdvisory(rec) {
  const reported = (rec["Reported_Advisory_Types"] || "").toString().trim();
  if (!reported) return false;
  const obs = DATE_FIELDS.map(f => parseDate(rec[f])).filter(Boolean);
  const mostRecent = obs.reduce((a, b) => (b > a ? b : a), null);
  return mostRecent && daysAgo(mostRecent) <= ACTIVE_WINDOW_DAYS;
}

function advisoryActive(rec) {
  const start = parseDate(rec[ADVISORY_START]);
  const end   = parseDate(rec[ADVISORY_END]);
  const now = new Date();

  if (!start) return false;
  if (start > now) return false;

  // If there's an explicit end date, honor it strictly.
  if (end) return end >= now;

  // Open-ended ("ongoing") advisory: only trust it if there's RECENT activity.
  // Use the most recent of advisory start or any observation date on this record.
  const obs = DATE_FIELDS.map(f => parseDate(rec[f])).filter(Boolean);
  const mostRecent = [start, ...obs].reduce((a, b) => (b > a ? b : a), start);
  return daysAgo(mostRecent) <= ACTIVE_WINDOW_DAYS;
}

// Phrases that explicitly indicate NO active health advisory.
const NO_ADVISORY_PATTERNS = /below posting trigger|no advisory|routine monitoring|no bloom|below (the )?detection|rescinded|lifted|no action/i;

function tierFromText(rec) {
  const text = ADVISORY_TEXT_FIELDS
    .map(f => (rec[f] || "").toString().toLowerCase())
    .join(" ");
  if (NO_ADVISORY_PATTERNS.test(text)) return "none"; // explicitly not an advisory
  for (const t of TIERS) if (text.includes(t)) return t;
  return null; // active record but no recognizable tier
}

function advisoryDetailText(rec) {
  const detail = (rec["AdvisoryDetail"] || rec["Advisory_Detail_Description"]
                  || rec["Reported_Advisory_Types"] || "").toString().trim();
  const start = parseDate(rec[ADVISORY_START]);
  const end   = parseDate(rec[ADVISORY_END]);
  let dates = "";
  if (start) {
    dates = " (" + start.toISOString().slice(0,10) +
            (end ? "–" + end.toISOString().slice(0,10) : "–ongoing") + ")";
  }
  return detail ? detail + dates : "";
}

const STALE_CLEAR_DAYS = 365; // CLEAR older than this is shown as "stale"
function classify(records) {
  let worst = null, latest = null, hasRealAdvisory = false, detail = "";

  for (const rec of records) {
    for (const f of DATE_FIELDS) {
      const d = parseDate(rec[f]);
      if (d && (!latest || d > latest)) latest = d;
    }
    if (advisoryActive(rec) || recentReportedAdvisory(rec)) {
      const t = tierFromText(rec);
      if (t && t !== "none") {
        hasRealAdvisory = true;
        if (!worst || TIERS.indexOf(t) < TIERS.indexOf(worst)) {
          worst = t;
          detail = advisoryDetailText(rec);
        }
      }
    }
  }

  if (!records.length) return { tier: "nodata", latest: null, detail: "", stale: false };
  if (hasRealAdvisory) return { tier: worst, latest, detail, stale: false };

  // CLEAR — flag as stale if the newest report is old.
  const stale = latest ? daysAgo(latest) > STALE_CLEAR_DAYS : true;
  return { tier: "clear", latest, detail: "", stale };
}

function matchesSpot(rec, spot) {
  const wb = (getField(rec, WATERBODY_FIELDS) || "").toString().toLowerCase();
  return spot.match.some(m => wb.includes(m));
}

// ---- Render -------------------------------------------------------------
function monthsAgo(d) {
  return d ? Math.round((Date.now() - d) / (86400000 * 30.44)) : null;
}

function render(results) {
  const el = document.getElementById("spots");
  const order = ["danger","warning","caution","clear","nodata"];
  let html = "";

  for (const group of GROUP_ORDER) {
    const inGroup = results.filter(r => r.group === group);
    if (!inGroup.length) continue;
    inGroup.sort((a,b) => order.indexOf(a.tier) - order.indexOf(b.tier));
    html += `<h2>${group}</h2>`;
    html += inGroup.map(r => {
      const badgeClass = (r.tier === "clear" && r.stale) ? "clear stale" : r.tier;
      const badgeLabel = (r.tier === "clear" && r.stale) ? "CLEAR*" : r.tier.toUpperCase();
      const ageNote = (r.tier === "clear" && r.stale && r.latest)
        ? `<div class="detail muted">ℹ️ Data is ~${monthsAgo(r.latest)} months old — not a fresh all-clear.</div>`
        : "";
      return `
      <div class="spot">
        <span class="badge ${badgeClass}">${badgeLabel}</span>
        <span class="name">
          <strong>${r.name}</strong> <span class="dist">— ${r.dist}</span>
          <div class="meta">${r.latest
            ? "Latest report: " + r.latest.toISOString().slice(0,10)
            : "No reports found"}</div>
          ${r.detail ? `<div class="detail">⚠️ ${r.detail}</div>` : ""}
          ${ageNote}
        </span>
      </div>`;
    }).join("");
  }
  el.innerHTML = html;
}

// ---- Main ---------------------------------------------------------------
(async function main() {
  try {
    const ids = await getResourceIds();
    const all = (await Promise.all(ids.map(id => queryResource(id)))).flat();
    console.log("Total records fetched:", all.length);

    const results = SPOTS.map(spot => {
      const recs = all.filter(rec => matchesSpot(rec, spot));
      return { ...spot, ...classify(recs) };
    });

    render(results);
    document.getElementById("updated").textContent =
      "Checked " + new Date().toLocaleString();
  } catch (e) {
    document.getElementById("spots").textContent = "Error loading data: " + e;
  }
})();
