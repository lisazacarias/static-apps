// Pure routine logic: which session falls when, what gets ticked off, hold
// timer presets, the movement reference, the practice log and the .ics
// export. No DOM in here, so the Node tests exercise exactly what the page
// runs. The routine itself lives in routine.js.

/* ── dates ───────────────────────────────────────────────────────────── */

const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes(), d.getSeconds());
// Weeks run Monday to Sunday, matching session.day (0 = Monday).
export const weekStart = (d) => { const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return addDays(day, -((day.getDay() + 6) % 7)); };

const at = (day, hhmm) => { const [h, m] = hhmm.split(':').map(Number); return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m); };

/* ── schedule ────────────────────────────────────────────────────────── */

// Every session in [from, to), sorted by start. Each carries a key —
// 'YYYY-MM-DD|session id' — that the log is stored under.
export function occurrences(routine, from, to) {
  const out = [];
  for (let monday = weekStart(from); monday < to; monday = addDays(monday, 7)) {
    for (const s of routine.sessions) {
      const day = addDays(monday, s.day);
      const start = at(day, s.start);
      let end = at(day, s.end);
      if (end <= start) end = addDays(end, 1); // runs past midnight
      if (start >= from && start < to) out.push({ key: `${ymd(day)}|${s.id}`, session: s, start, end });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/* ── checklist ───────────────────────────────────────────────────────── */

export const cueText = (c) => (typeof c === 'string' ? c : c.text);
export const cueSub = (c) => typeof c === 'object' && c.sub === true;

// What gets ticked off for a session, keyed 'Section / Name' (or just the
// section for an item that is the whole section).
export function checklist(session, variant = 'full') {
  if (variant === 'short' && session.short) {
    return session.short.items.map((item) => ({ id: `Short / ${item.name}`, section: null, item }));
  }
  return session.sections.flatMap((section) => section.items.map((item) => ({
    id: item.whole ? section.title : `${section.title} / ${item.name}`, section, item,
  })));
}

/* ── durations and timer presets ─────────────────────────────────────── */

export function parseDuration(text) {
  const m = /(\d+(?:\.\d+)?)\s*(?:[-–]\s*\d+(?:\.\d+)?\s*)?(min|sec|s)\b/i.exec(text || '');
  if (!m) return null;
  return Math.round(parseFloat(m[1]) * (m[2].toLowerCase() === 'min' ? 60 : 1));
}

// Offers the per-side hold when the notes give one, then the whole block.
export function timerOptions(item) {
  const opts = [];
  const add = (label, seconds) => { if (seconds && !opts.some((o) => o.seconds === seconds)) opts.push({ label, seconds }); };
  for (const t of [item.duration, item.detail, ...(item.cues || []).map(cueText)]) {
    const side = /(\d+(?:\.\d+)?\s*(?:min|sec|s))\s*(?:\/\s*|each\s+|per\s+)(side|leg|direction|arm)\b/i.exec(t || '');
    if (side) add(`${side[1]}/${side[2]}`, parseDuration(side[1]));
  }
  add(item.duration, parseDuration(item.duration));
  return opts;
}

/* ── movement reference ──────────────────────────────────────────────── */

// Names the plan uses for the same movement in different sessions. A
// judgement call from reading the notes, so only clear matches are listed.
const ALIASES = {
  'couch stretch extended': 'couch stretch',
  'contract relax': 'contract relax hip flexor',
  'thoracic spine roll': 'thoracic roll',
  'lats roll': 'foam roll lats',
  'standing splits at pole': 'standing splits',
  'bridge prep glute bridge': 'bridge prep',
  'thoracic bridge w block squeeze': 'thoracic bridge with block',
  'full bridge depth focus': 'full bridge',
  'full bridge work': 'full bridge',
  'theragun prep': 'theragun',
  'theragun recovery': 'theragun',
  'final cool down': 'cool down',
  'pole chest stretch middle position only': 'pole chest stretches',
  'high position': 'pole chest stretches',
  'middle position': 'pole chest stretches',
  'low position': 'pole chest stretches',
};

const rawKey = (name) => name.toLowerCase().replace(/→/g, ' to ').replace(/&/g, ' and ').replace(/['’]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();

export function moveKey(name) {
  const k = rawKey(name);
  return ALIASES[k] || k;
}

// One entry per movement in the routine: the sessions it's in, and every
// write-up of it — from each session, then the library's older ones.
export function movementIndex(routine) {
  const index = new Map();
  const add = (key, item, session, current) => {
    if (!index.has(key)) index.set(key, { key, name: item.name, sessions: [], writeups: [] });
    const entry = index.get(key);
    // Prefer the movement's own name over a variant ("Couch stretch", not
    // "Couch stretch, extended").
    if (rawKey(item.name) === key && rawKey(entry.name) !== key) entry.name = item.name;
    if (current && !entry.sessions.includes(session)) entry.sessions.push(session);
    const sig = JSON.stringify([item.name, item.duration, item.detail, item.cues]);
    if (!entry.writeups.some((w) => w.sig === sig)) {
      entry.writeups.push({ sig, session, current, name: item.name, duration: item.duration, detail: item.detail || '', cues: item.cues || [] });
    }
  };
  for (const s of routine.sessions) {
    for (const item of [...s.sections.flatMap((sec) => sec.items), ...(s.short?.items || [])]) add(moveKey(item.name), item, s.title, true);
  }
  for (const [key, list] of Object.entries(routine.library || {})) {
    if (!index.has(key)) continue;
    for (const w of list) add(key, w, w.session, false);
  }
  return [...index.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/* ── practice log ────────────────────────────────────────────────────── */

// { version: 1, entries: { ['YYYY-MM-DD|session id']: entry } }
//   entry: { date 'YYYY-MM-DD', title, variant 'full'|'short',
//            checked: ['Section / Movement', …], notes, done, updated }
export function normalizeLog(raw) {
  const entries = {};
  const src = raw && typeof raw === 'object' && raw.entries && typeof raw.entries === 'object' ? raw.entries : {};
  for (const [key, e] of Object.entries(src)) {
    if (!e || typeof e !== 'object') continue;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : key.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    entries[key] = {
      date,
      title: typeof e.title === 'string' ? e.title : '',
      variant: e.variant === 'short' ? 'short' : 'full',
      checked: Array.isArray(e.checked) ? [...new Set(e.checked.filter((c) => typeof c === 'string'))] : [],
      notes: typeof e.notes === 'string' ? e.notes : '',
      done: e.done === true,
      updated: Number.isFinite(e.updated) ? e.updated : 0,
    };
  }
  return { version: 1, entries };
}

export function isEmptyEntry(e) {
  return !e.done && !e.checked.length && !e.notes.trim();
}

/* ── .ics export ─────────────────────────────────────────────────────── */

const DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const NUMBERS = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

// The session's notes as calendar text, laid out the way the calendar had
// them: total, short version, numbered sections, notes prompts, 📌 lines.
export function describe(s) {
  const out = [];
  if (s.total) out.push(`⏱ ${s.total} MIN TOTAL`);
  out.push(...(s.intro || []));
  const itemLines = (it) => [
    `• ${it.name} (${it.duration})${it.detail ? `: ${it.detail}` : ''}`,
    ...(it.cues || []).map((c) => `   ${cueSub(c) ? '- ' : ''}${cueText(c)}`),
  ];
  if (s.short) {
    out.push('', `⏩ SHORT ON TIME?${s.short.minutes ? ` ~${s.short.minutes}-MIN VERSION` : ''}`, ...s.short.items.flatMap(itemLines));
    if (s.short.skip) out.push(`Skip: ${s.short.skip}`);
  }
  s.sections.forEach((sec, i) => {
    out.push('', `${NUMBERS[i + 1] || `${i + 1}.`} ${sec.title.toUpperCase()} — ${sec.minutes} min${sec.note ? ` ${sec.note}` : ''}`);
    for (const it of sec.items) {
      if (it.whole) out.push(...(it.cues || []).map((c) => `${cueSub(c) ? '   - ' : '• '}${cueText(c)}`));
      else out.push(...itemLines(it));
    }
  });
  if (s.notes?.length) out.push('', '📝 NOTES', ...s.notes.map((n) => `• ${n}`));
  if (s.footer?.length) out.push('', ...s.footer.map((f) => `📌 ${f}`));
  return out.join('\n').trim();
}

const icsText = (s) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const icsLocal = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const icsUtc = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

// Lines longer than 75 bytes continue on the next line after a space, cut
// between characters so an emoji is never split.
export function foldLine(line) {
  const enc = new TextEncoder();
  const parts = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > (parts.length ? 74 : 75)) { parts.push(cur); cur = ''; bytes = 0; }
    cur += ch;
    bytes += n;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

// A calendar with one weekly repeating event per session, starting the week
// of `now`. Times are written without a time zone ("floating"), so they land
// at the same clock time wherever the calendar is.
// CHECK: does Apple Calendar import floating times as local, or shift them?
// CHECK: re-importing reuses each session's UID — does Calendar update the
// existing events, or add duplicates next to them?
export function toIcs(routine, now = new Date()) {
  const monday = weekStart(now);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//static-apps//flex-training//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Flex Training'];
  for (const s of routine.sessions) {
    const day = addDays(monday, s.day);
    const start = at(day, s.start);
    let end = at(day, s.end);
    if (end <= start) end = addDays(end, 1);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${s.id}@flex-training`,
      `DTSTAMP:${icsUtc(now)}`,
      `DTSTART:${icsLocal(start)}`,
      `DTEND:${icsLocal(end)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${DAYS[s.day]}`,
      `SUMMARY:${icsText(s.title)}`,
      `DESCRIPTION:${icsText(describe(s))}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
