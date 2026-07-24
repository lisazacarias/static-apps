// ==========================================================================
// SUP Algae Advisory Tracker
// Data: CA FHAB (algae) + USGS (water temp) + Open-Meteo (weather) + OSRM (drive time)
// Origin resolved privately at runtime; never committed.
// ==========================================================================

import {CKAN, queryResource, getField} from "../../shared/ckan.js";
import {
    resolveOrigin, driveTimes, geocode,
    saveOrigin, getSavedOrigin, clearSavedOrigin
} from "../../shared/geo.js";
import {waterTempForCoords} from "../../shared/usgs.js";
import {forecast, wxLabel, windClass} from "../../shared/weather.js";

// ---- Config -------------------------------------------------------------
const DATASET = "surface-water-freshwater-harmful-algal-blooms";
const FALLBACK_RESOURCE_IDS = [
    "c6a36b91-ad38-4611-8750-87ee99e497dd", // FHABS BLOOM REPORTS
    "67648948-034f-4882-bbc0-c07c7d38daf9", // FHABS CASES
    "4283c060-c22f-48f5-a75c-8bccf0c54a99", // FHABS RESPONSES
    "9d4e1df4-0cd6-4165-9e63-effcafd9dccc", // FHABS RESULTS
];

const WATERBODY_FIELDS = ["Water_Body_Name", "Official_Water_Body_Name",
    "Case_Water_Body_Name"];

// Advisory_Date carries the true advisory date (routine-monitoring updates);
// Observation_Date / Bloom_Date_Created can lag by years.
const DATE_FIELDS = ["Advisory_Date", "Advisory_Date_of_Recommendation",
    "Observation_Date", "Bloom_Date_Created"];

// Advisory_Recommended holds the tier on rows where Reported_Advisory_Types is null.
const ADVISORY_TEXT_FIELDS = [
    "Reported_Advisory_Types",
    "Advisory_Recommended",
    "AdvisoryDetail",
    "Advisory_Detail_Description",
];
const ADVISORY_START = "AdvisoryStartDate";
const ADVISORY_END = "AdvisoryEndDate";

const TIERS = ["danger", "warning", "caution"];

const TEMP_CACHE_VERSION = "v2";
const DRIVE_CACHE_VERSION = "v3";   // bumped: invalidates old cached drive times after coord fixes

// Spots. coords=[lng,lat] launch point; parking=Apple Maps links;
// notes=manual metadata (mussel/quarantine/SUP rules — not in any feed).
// Flags: weekend=crowded on weekends (badge); noSup=SUP prohibited (badge).
const SPOTS = [

    {
        name: "Del Valle Reservoir",
        match: ["del valle"],
        coords: [-121.7130, 37.5860],
        weekend: true,
        parking: [{
            label: "Parking",
            url: "https://maps.apple/p/gJI.9nNyJAj.Qn"
        }],
        notes: [
            {
                text: "ℹ️ Golden mussel inspection program (EBRPD, since May 7 2025). Inflatables/float tubes may be exempt.",
                url: "https://www.ebparks.org/about-us/whats-new/news/new-watercraft-inspection-requirements"
            },
        ]
    },

    {
        name: "Lake Berryessa",
        match: ["berryessa"],
        coords: [-122.2320, 38.5130],
        weekend: true,
        parking: [
            {label: "Oak Shores", url: "https://maps.apple/p/7vUhK9yqJZxNPW"},
            {label: "Pope Creek", url: "https://maps.apple/p/KG2ebQzB.iSJ_i"},
        ]
    },

    {
        name: "Clear Lake",
        match: ["clear lake"],
        coords: [-122.6390, 39.0290],
        weekend: true,
        notes: [
            {text: "⚠️ Large lake — advisories vary by area and may lag actual bloom severity."},
        ]
    },

    {
        name: "Lake Natoma",
        match: ["natoma"],
        coords: [-121.1660, 38.6350],
        weekend: true
    },
    {
        name: "Folsom Lake",
        match: ["folsom"],
        coords: [-121.1560, 38.7080],
        weekend: true
    },
    {
        name: "Bass Lake",
        match: ["bass lake"],
        coords: [-119.5580, 37.3210],
        weekend: true
    },
    {
        name: "Millerton Lake",
        match: ["millerton"],
        coords: [-119.6910, 37.0250],
        weekend: true
    },
    {
        name: "Pyramid Lake",
        match: ["pyramid"],
        coords: [-118.7960, 34.6820],
        weekend: true
    },

    {
        name: "Quarry Lakes",
        match: ["quarry lakes", "horseshoe lake"],
        coords: [-121.9880, 37.5720],
        weekend: true,
        notes: [
            {
                text: "ℹ️ SUP allowed on Horseshoe Lake only.",
                url: "https://www.ebparks.org/recreation/boating"
            },
            {
                text: "⚠️ Crowded on weekends — swim beach has a capacity cap. Weekday paddling recommended.",
                url: "https://www.ebparks.org/recreation/swimming/niles-beach"
            },
            {
                text: "ℹ️ Golden mussel inspection program (EBRPD, since May 7 2025). Inflatables/float tubes may be exempt.",
                url: "https://www.ebparks.org/about-us/whats-new/news/new-watercraft-inspection-requirements"
            },
        ]
    },

    {
        name: "Shadow Cliffs",
        match: ["shadow cliff"],
        coords: [-121.8850, 37.6690],
        parking: [{
            label: "Parking",
            url: "https://maps.apple/p/2W0buqSHHFbGjF"
        }],
        notes: [
            {
                text: "ℹ️ Golden mussel inspection program (EBRPD, since May 7 2025). Inflatables/float tubes may be exempt.",
                url: "https://www.ebparks.org/about-us/whats-new/news/new-watercraft-inspection-requirements"
            },
        ]
    },

    {
        name: "Contra Loma Reservoir",
        match: ["contra loma"],
        coords: [-121.8460, 37.9760],
        notes: [
            {
                text: "⚠️ Golden mussels DETECTED. Launching here quarantines your boat 30 days from Del Valle, Shadow Cliffs, Chabot & Quarry Lakes.",
                url: "https://www.ebparks.org/recreation/boating/invasive-mussels"
            },
            {
                text: "ℹ️ Inflatable SUP likely exempt from inspection — verify before relying on it.",
                url: "https://www.ebparks.org/recreation/boating"
            },
        ]
    },

    {
        name: "Lake Merced",
        match: ["lake merced"],
        coords: [-122.49402, 37.71904],
        parking: [{
            label: "Boathouse (1 Harding Blvd)",
            url: "https://maps.apple/?address=1%20Harding%20Blvd,%20San%20Francisco"
        }],
        notes: [
            {
                text: "ℹ️ Public launch + boathouse; SUP allowed. Coastal/fog-belt — cooler water.",
                url: "https://sfrecpark.org/663/Lake-Merced-Boathouse"
            },
            {
                text: "⚠️ SFPUC monitors cyanobacteria monthly (not in FHAB feed). No live web dashboard — check the SFPUC page, posted signage, or call the boathouse (415) 831-2700 before going.",
                url: "https://www.sfpuc.gov/learning/come-visit/lake-merced"
            },
        ]
    },


// --- South Bay additions (close, warm valley/foothill water) ---
// NOTE: verify each spot's SUP-allowed status + Santa Clara County mussel/quarantine
// rules before a first visit — those gates are not in any feed.

    {
        name: "Vasona Lake",
        match: ["vasona"],
        coords: [-121.9690, 37.2400],
        weekend: true,
        notes: [
            {
                text: "ℹ️ County park; paddle boating/kayaking area. Small, calm — verify SUP launch rules.",
                url: "https://www.sccgov.org/sites/parks/parkfinder/Pages/Vasona.aspx"
            },
        ]
    },


    {
        name: "Calero Reservoir",
        match: ["calero"],
        coords: [-121.7640, 37.1790],
        notes: [
            {
                text: "ℹ️ Limited-power boating; non-powered SUP allowed. Public launch.",
                url: "https://parks.santaclaracounty.gov/things-do/aquatics/boating-county-parks"
            },
            {
                text: "⚠️ SCC vessel inspection required (new rules 6/15/2026; $7/inspection or $35 annual pass, no reciprocal banding).",
                url: "https://news.santaclaracounty.gov/new-vessel-inspection-rules-go-effect-june-15-boaters-all-santa-clara-county-reservoirs"
            },
        ]
    },

    {
        name: "Lexington Reservoir",
        match: ["lexington"],
        coords: [-121.9910, 37.1930],
        weekend: true,
        notes: [
            {
                text: "ℹ️ Non-motorized only; SUP allowed. Afternoon wind can pick up — check the forecast.",
                url: "https://parks.santaclaracounty.gov/things-do/aquatics/boating-county-parks"
            },
        ]
    },


    {
        name: "Stevens Creek Reservoir",
        match: ["stevens creek", "steven's creek"],
        coords: [-122.0740, 37.3010],
        parking: [{
            label: "Boat launch",
            url: "https://maps.apple/?address=Stevens%20Creek%20County%20Park,%20Cupertino"
        }],
        notes: [
            {
                text: "ℹ️ Limited-power boating; SUP allowed. Reservoir open mid-April–mid-October only — verify season.",
                url: "https://parks.santaclaracounty.gov/things-do/aquatics/boating-county-parks"
            },
            {
                text: "⚠️ SCC vessel inspection required (new rules 6/15/2026; $7/inspection or $35 annual pass, no reciprocal banding).",
                url: "https://news.santaclaracounty.gov/new-vessel-inspection-rules-go-effect-june-15-boaters-all-santa-clara-county-reservoirs"
            },
        ]
    },


    {
        name: "Don Pedro Reservoir",
        match: ["don pedro"],
        coords: [-120.4210, 37.7010],
        parking: [{
            label: "Fleming Meadows launch",
            url: "https://maps.apple/?address=11500%20Bonds%20Flat%20Rd,%20Jamestown,%20CA%2095329"
        }],
        notes: [
            {
                text: "ℹ️ Open for paddling. Complete the mussel self-inspection permit + arrive clean/drained/dry (dry-time rules aimed at trailered boats; hand-launched SUP usually clears easily).",
                url: "https://www.donpedrolake.com/wp-content/uploads/2021/08/Mussel-Self-Inspection-Permit.pdf"
            },
        ]
    },
    {
        name: "New Melones Reservoir",
        match: ["new melones", "melones"],
        coords: [-120.5270, 37.9480],
        parking: [{
            label: "Glory Hole",
            url: "https://maps.apple/p/FmIpWeN0wcPjyB"
        }]
    },
    {
        name: "Lake Nacimiento",
        match: ["nacimiento"],
        coords: [-120.8900, 35.7560]
    },
    {
        name: "Lake San Antonio",
        match: ["san antonio"],
        coords: [-120.8560, 35.8000]
    },

    {
        name: "Lake Chabot",
        match: ["chabot"],
        coords: [-122.1050, 37.7250],
        noSup: true,
        notes: [
            {text: "🚫 SUP prohibited — kayaks/canoes/float tubes only."},
            {
                text: "ℹ️ Golden mussel inspection program (EBRPD, since May 7 2025).",
                url: "https://www.ebparks.org/about-us/whats-new/news/new-watercraft-inspection-requirements"
            },
        ]
    },
];

// ---- HAB record fetch ---------------------------------------------------
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

// ---- Advisory helpers ---------------------------------------------------
function parseDate(v) {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d) ? null : d;
}

const ACTIVE_WINDOW_DAYS = 120;

function daysAgo(d) {
    return d ? (Date.now() - d) / 86400000 : Infinity;
}

function recentReportedAdvisory(rec) {
    const reported = (rec["Reported_Advisory_Types"]
        || rec["Advisory_Recommended"] || "").toString().trim();
    if (!reported) return false;
    const obs = DATE_FIELDS.map(f => parseDate(rec[f])).filter(Boolean);
    const mostRecent = obs.reduce((a, b) => (b > a ? b : a), null);
    return mostRecent && daysAgo(mostRecent) <= ACTIVE_WINDOW_DAYS;
}

function advisoryActive(rec) {
    const start = parseDate(rec[ADVISORY_START]);
    const end = parseDate(rec[ADVISORY_END]);
    const now = new Date();
    if (!start) return false;
    if (start > now) return false;
    if (end) return end >= now;
    const obs = DATE_FIELDS.map(f => parseDate(rec[f])).filter(Boolean);
    const mostRecent = [start, ...obs].reduce((a, b) => (b > a ? b : a), start);
    return daysAgo(mostRecent) <= ACTIVE_WINDOW_DAYS;
}

const NO_ADVISORY_PATTERNS = /below posting trigger|no advisory|routine monitoring|no bloom|below (the )?detection|rescinded|lifted|no action/i;

function tierFromText(rec) {
    const text = ADVISORY_TEXT_FIELDS
        .map(f => (rec[f] || "").toString().toLowerCase())
        .join(" ");

    let presentTier = null;
    for (const t of TIERS) {
        if (text.includes(t)) {
            presentTier = t;
            break;
        }
    }

    const hasNegation = NO_ADVISORY_PATTERNS.test(text);

    if (presentTier) {
        const onlyOneTier = TIERS.filter(t => text.includes(t)).length === 1;
        if (hasNegation && onlyOneTier) {
            const clearlyCleared =
                /(rescinded|lifted|removed|no longer)/i.test(text) &&
                !/(remains|still|continues|in effect|active)/i.test(text);
            if (clearlyCleared) return "none";
        }
        return presentTier;
    }

    if (hasNegation) return "none";
    return null;
}

// Boilerplate that carries no real signal — badge + date say it all.
const DETAIL_BOILERPLATE = /^\s*(lake-wide advisory;?\s*)?(updates?\s+(are\s+)?(provided\s+by|from)\s+.*routine\s+(water\s+)?monitoring[^.]*\.?)\s*$/i;

function advisoryDetailText(rec) {
    let detail = (rec["AdvisoryDetail"]
        || rec["Advisory_Detail_Description"]
        || "").toString().trim();

    if (DETAIL_BOILERPLATE.test(detail)) detail = "";

    const adate = parseDate(rec["Advisory_Date"])
        || parseDate(rec["Advisory_Date_of_Recommendation"])
        || parseDate(rec[ADVISORY_START]);
    const end = parseDate(rec[ADVISORY_END]);

    let dates = "";
    if (adate) {
        dates = "updated " + adate.toISOString().slice(0, 10)
            + (end ? ", ends " + end.toISOString().slice(0, 10) : ", ongoing");
    }

    if (detail && dates) return `${detail} (${dates})`;
    if (detail) return detail;
    if (dates) return dates;
    return "";
}

const STALE_CLEAR_DAYS = 365;

function classify(records) {
    let worst = null, latest = null, hasRealAdvisory = false,
        detail = "";
    let hasHistory = false;

    for (const rec of records) {
        for (const f of DATE_FIELDS) {
            const d = parseDate(rec[f]);
            if (d && (!latest || d > latest)) latest = d;
        }

        const histTier = tierFromText(rec);
        if (histTier && histTier !== "none") hasHistory = true;

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

    if (!records.length) return {
        tier: "nodata",
        latest: null,
        detail: "",
        stale: false,
        hasHistory: false
    };
    if (hasRealAdvisory) return {
        tier: worst,
        latest,
        detail,
        stale: false,
        hasHistory
    };
    const stale = latest ? daysAgo(latest) > STALE_CLEAR_DAYS : true;
    return {tier: "clear", latest, detail: "", stale, hasHistory};
}

function matchesSpot(rec, spot) {
    const wb = (getField(rec, WATERBODY_FIELDS) || "").toString().toLowerCase();
    return spot.match.some(m => wb.includes(m));
}

// ---- Sorting & filtering ------------------------------------------------
let SORT_MODE = localStorage.getItem("sortMode") || "tier";
let FILTER_RANGE = (localStorage.getItem("filterRange") ?? "true") === "true";
const MAX_DRIVE_SECS = 2 * 3600 + 15 * 60;   // 2h15m — slack past a hard 2h

function paddleScore(r) {
    const cur = r.forecast?.current, today = r.forecast?.days?.[0];
    const wind = cur?.windMph ?? today?.wind ?? 99;
    const rain = today?.rain ?? 0;
    const hi = today?.hi ?? cur?.airF ?? 0;
    return wind * 3 + rain * 0.5 + Math.max(0, 75 - hi) * 0.8;
}

const TIER_SAFEST_FIRST = ["clear", "nodata", "caution", "warning", "danger"];

function safestRank(r) {
    if (r.tier === "clear") return r.stale ? 0.5 : 0;
    return TIER_SAFEST_FIRST.indexOf(r.tier);
}

function sortComparator(mode) {
    switch (mode) {
        case "drive":
            return (a, b) => (a.driveSecs ?? Infinity) - (b.driveSecs ?? Infinity);
        case "weather":
            return (a, b) => paddleScore(a) - paddleScore(b);
        default:
            return (a, b) =>
                safestRank(a) - safestRank(b)
                || (a.driveSecs ?? Infinity) - (b.driveSecs ?? Infinity);
    }
}

function withSafetyFloor(cmp) {
    const rank = r =>
        (r.tier === "danger" || r.tier === "warning" ? 4 : 0) +
        (r.tier === "caution" ? 2 : 0) +
        (r.noSup ? 1 : 0);
    return (a, b) => rank(a) - rank(b) || cmp(a, b);
}

// ---- Drive-time helpers -------------------------------------------------
function fmtDrive(secs) {
    if (secs == null || !isFinite(secs)) return "—";
    const m = Math.round(secs / 60);
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)} hr ${m % 60} min`;
}

function driveCacheKey() {
    return `driveCache_${DRIVE_CACHE_VERSION}_${new Date().toISOString().slice(0, 10)}`;
}

function invalidateDriveCache() {
    localStorage.removeItem(driveCacheKey());
}

async function getCachedDriveTimes(origin, spots) {
    const key = driveCacheKey();
    const cached = localStorage.getItem(key);
    if (cached) return JSON.parse(cached);
    const secs = await driveTimes(origin, spots.map(s => s.coords));
    localStorage.setItem(key, JSON.stringify(secs));
    return secs;
}

// ---- Temp helper --------------------------------------------------------
async function getWaterTemp(spot) {
    const day = new Date().toISOString().slice(0, 10);
    const key = `temp_${TEMP_CACHE_VERSION}_${spot.name}_${day}`;
    const cached = localStorage.getItem(key);
    if (cached !== null) return cached === "null" ? null : JSON.parse(cached);
    const result = await waterTempForCoords(spot.coords);
    localStorage.setItem(key, result ? JSON.stringify(result) : "null");
    return result;
}

// ---- Render -------------------------------------------------------------
function monthsAgo(d) {
    return d ? Math.round((Date.now() - d) / (86400000 * 30.44)) : null;
}

function shortDay(dateStr) {
    return new Date(dateStr + "T12:00").toLocaleDateString(undefined,
        {weekday: "short"});
}

function render(results) {
    const el = document.getElementById("spots");

    let list = results;
    if (FILTER_RANGE) {
        list = list.filter(r => r.driveSecs == null || r.driveSecs <= MAX_DRIVE_SECS);
    }

    const sorted = [...list].sort(withSafetyFloor(sortComparator(SORT_MODE)));

    if (!sorted.length) {
        el.innerHTML = `<div class="loading">No spots within range. Uncheck the filter to see all.</div>`;
        return;
    }

    el.innerHTML = sorted.map(r => {
        const badgeClass = (r.tier === "clear" && r.stale) ? "clear stale" : r.tier;
        const badgeLabel = (r.tier === "clear" && r.stale) ? "CLEAR*" : r.tier.toUpperCase();

        const weekendBadge = r.weekend ? `<span class="badge weekend">📅 WEEKEND CROWDS</span>` : "";
        const noSupBadge = r.noSup ? `<span class="badge nosup">🚫 NO SUP</span>` : "";

        const ageNote = (r.tier === "clear" && r.stale && r.latest)
            ? `<div class="detail muted">ℹ️ Data is ~${monthsAgo(r.latest)} months old — not a fresh all-clear.</div>` : "";
        const historyNote = (r.hasHistory && (r.tier === "clear" || r.tier === "nodata"))
            ? `<div class="detail muted">🕓 Prior bloom advisory on record — recurring-bloom water, worth a fresh check.</div>` : "";

        const cur = r.forecast?.current;
        const curLine = cur
            ? `<div class="meta wx">${wxLabel(cur.code)} ${cur.airF}°F · <span class="${windClass(cur.windMph)}">💨 ${cur.windMph} mph</span></div>`
            : "";

        const fcLine = (r.forecast?.days?.length)
            ? `<div class="forecast">${r.forecast.days.map(d => `
          <span class="fc-day" title="${d.date}">
            ${shortDay(d.date)} ${wxLabel(d.code).split(" ")[0]} ${d.hi}°/${d.lo}°
            ${d.rain > 20 ? ` ☔${d.rain}%` : ""}
            <span class="${windClass(d.wind)}">💨${d.wind}</span>
          </span>`).join("")}</div>`
            : "";

        const notesLines = (r.notes && r.notes.length)
            ? r.notes.map(n => {
                const txt = typeof n === "string" ? n : n.text;
                const link = (typeof n === "object" && n.url)
                    ? ` <a href="${n.url}" target="_blank" rel="noopener">↗</a>` : "";
                return `<div class="detail note">${txt}${link}</div>`;
            }).join("")
            : "";

        const parkingLine = (r.parking && r.parking.length)
            ? `<div class="parking">📍 ${r.parking.map(p =>
                `<a href="${p.url}" target="_blank" rel="noopener">${p.label}</a>`).join(" · ")}</div>` : "";

        return `
    <div class="spot">
      <span class="badge ${badgeClass}">${badgeLabel}</span>
      <span class="name">
        <strong>${r.name}</strong> <span class="dist">— ${r.dist}</span>
        ${weekendBadge} ${noSupBadge}
        ${r.tempLabel ? `<span class="warmth">${r.tempLabel}</span>` : ""}
        <div class="meta">${r.latest ? "Latest report: " + r.latest.toISOString().slice(0, 10) : "No reports found"}</div>
        ${r.detail ? `<div class="detail">⚠️ ${r.detail}</div>` : ""}
        ${ageNote}
        ${historyNote}
        ${notesLines}
        ${curLine}
        ${fcLine}
        ${parkingLine}
      </span>
    </div>`;
    }).join("");
}

// ---- Main ---------------------------------------------------------------
let ALL_RECORDS = null;
let LAST_RESULTS = null;

async function computeAndRender() {
    const origin = await resolveOrigin();

    const [driveSecs, temps, forecasts] = await Promise.all([
        getCachedDriveTimes(origin, SPOTS).catch(() => SPOTS.map(() => null)),
        Promise.allSettled(SPOTS.map(getWaterTemp)).then(rs => rs.map(r => r.value ?? null)),
        Promise.allSettled(SPOTS.map(s => forecast(s.coords))).then(rs => rs.map(r => r.value ?? null)),
    ]);

    const results = SPOTS.map((spot, i) => {
        const recs = ALL_RECORDS.filter(rec => matchesSpot(rec, spot));
        const t = temps[i];
        return {
            ...spot,
            ...classify(recs),
            driveSecs: driveSecs[i],
            dist: fmtDrive(driveSecs[i]),
            tempLabel: t ? `🌡️ ${t.tempF}°F` + (t.miles > 3 ? ` (~${t.miles} mi away)` : "") : "",
            forecast: forecasts[i],
        };
    });

    LAST_RESULTS = results;
    render(results);
    document.getElementById("updated").textContent = "Checked " + new Date().toLocaleString();

    const status = document.getElementById("location-status");
    if (status) {
        status.textContent = getSavedOrigin()
            ? "Using your saved location (this browser only)."
            : "Using generic Hayward location — click to set yours.";
    }
}

function parseLatLng(str) {
    const s = str.trim();
    const dir = s.match(/(-?\d+(?:\.\d+)?)\s*°?\s*([NS])\s*,\s*(-?\d+(?:\.\d+)?)\s*°?\s*([EW])/i);
    if (dir) {
        let lat = parseFloat(dir[1]);
        if (/s/i.test(dir[2])) lat = -lat;
        let lng = parseFloat(dir[3]);
        if (/w/i.test(dir[4])) lng = -lng;
        if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return [lng, lat];
        return null;
    }
    const plain = s.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (plain) {
        const lat = parseFloat(plain[1]), lng = parseFloat(plain[2]);
        if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return [lng, lat];
    }
    return null;
}

function wireLocationButton() {
    const btn = document.getElementById("set-location");
    if (!btn) return;
    btn.addEventListener("click", async () => {
        const addr = prompt(
            "Enter an address OR paste coordinates as \"lat, lng\".\n\n" +
            "Stored ONLY in this browser (localStorage) — never uploaded or committed.\n\n" +
            "Leave blank and press OK to clear a saved location."
        );
        if (addr === null) return;
        if (addr.trim() === "") {
            clearSavedOrigin();
            invalidateDriveCache();
            await computeAndRender();
            return;
        }
        const direct = parseLatLng(addr);
        if (direct) {
            saveOrigin(direct[0], direct[1]);
            invalidateDriveCache();
            await computeAndRender();
            return;
        }
        btn.disabled = true;
        btn.textContent = "Locating…";
        const coords = await geocode(addr.trim());
        btn.disabled = false;
        btn.textContent = "📍 Set my location";
        if (!coords) {
            alert("Couldn't find that address. Try pasting coordinates as \"lat, lng\" instead.");
            return;
        }
        saveOrigin(coords[0], coords[1]);
        invalidateDriveCache();
        await computeAndRender();
    });
}

function wireSortControl() {
    const sel = document.getElementById("sort-select");
    if (!sel) return;
    sel.value = SORT_MODE;
    sel.addEventListener("change", () => {
        SORT_MODE = sel.value;
        localStorage.setItem("sortMode", SORT_MODE);
        if (LAST_RESULTS) render(LAST_RESULTS);
    });
}

function wireFilterControl() {
    const cb = document.getElementById("filter-range");
    if (!cb) return;
    cb.checked = FILTER_RANGE;
    cb.addEventListener("change", () => {
        FILTER_RANGE = cb.checked;
        localStorage.setItem("filterRange", FILTER_RANGE);
        if (LAST_RESULTS) render(LAST_RESULTS);
    });
}

async function main() {
    try {
        const ids = await getResourceIds();
        ALL_RECORDS = (await Promise.all(ids.map(id => queryResource(id).catch(() => [])))).flat();
        console.log("Total records fetched:", ALL_RECORDS.length);
        await computeAndRender();
        wireLocationButton();
        wireSortControl();
        wireFilterControl();
    } catch (e) {
        console.error("main() failed:", e);
        document.getElementById("spots").innerHTML = `<div class="error">Couldn't load: ${e.message}</div>`;
    }
}

main();
