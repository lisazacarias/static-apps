// ==========================================================================
// Shared CKAN / DataStore helpers
// Used by apps that query California open-data CKAN datastores
// (https://data.ca.gov, and other CKAN-powered portals).
// ==========================================================================

// The FHAB dataset migrated from data.cnra.ca.gov (dead — resources datastore_active:false,
// download URLs 404) to data.ca.gov (live — datastore_active:true). This one line
// was the root cause of "no data / everything stale".
export const CKAN = "https://data.ca.gov/api/3/action";   // was: https://data.cnra.ca.gov/api/3/action

export async function queryResource(id, limit = 20000) {
  try {
    const r = await fetch(`${CKAN}/datastore_search?resource_id=${id}&limit=${limit}`);
    const j = await r.json();
    return j.success ? j.result.records : [];
  } catch (e) {
    console.warn("Query failed for", id, e.message);
    return [];
  }
}

export function getField(rec, names) {
  const key = Object.keys(rec).find(k =>
    names.some(n => k.toLowerCase() === n.toLowerCase()));
  return key ? rec[key] : null;
}
