// Pure routine logic: the week planner and its rule checks, what gets
// ticked off, hold timer presets, the movement reference, the stored log
// and weeks, and the .ics export. No DOM in here, so the Node tests
// exercise exactly what the page runs. The plan itself lives in routine.js.

/* ── dates ───────────────────────────────────────────────────────────── */

const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes(), d.getSeconds());
// Weeks run Monday to Sunday; day 0 is Monday.
export const weekStart = (d) => { const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return addDays(day, -((day.getDay() + 6) % 7)); };
export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/* ── classes ─────────────────────────────────────────────────────────── */

// `pole` is what rules 2 and 3 mean by a pole day: pole and pole tricks.
// Pole dance and rehearsal count as dance. `hard` is what rule 1 means by a
// hard class. `hours` is a class's length when you haven't given one.
export const CLASS_TYPES = [
  { id: 'pole', label: 'Pole', pole: true, hard: true, hours: 1.5 },
  { id: 'pole-tricks', label: 'Pole tricks', pole: true, hard: true, hours: 1.5 },
  { id: 'pole-dance', label: 'Pole dance', pole: false, hard: true, hours: 1.5 },
  { id: 'dance', label: 'Dance', pole: false, hard: true, hours: 1.5 },
  { id: 'rehearsal', label: 'Rehearsal', pole: false, hard: true, hours: 2.5 },
  { id: 'climbing', label: 'Climbing', pole: false, hard: false, hours: 2 },
  { id: 'skating', label: 'Skating', pole: false, hard: false, hours: 1.5 },
];
const CLASS = Object.fromEntries(CLASS_TYPES.map((c) => [c.id, c]));

/* ── stored weeks ────────────────────────────────────────────────────── */

// { version: 1, weeks: { ['YYYY-MM-DD' of the Monday]: week } }
//   week:  { deload, days: [7 × { classes, sessions }] }
//   class: { id, time 'HH:MM'|'', hours }; a bare id string is read as one
//          with no time
//   session: { id, time 'HH:MM'|'' }
export function normalizeWeeks(raw, sessionIds = null) {
  const weeks = {};
  const src = raw && typeof raw === 'object' && raw.weeks && typeof raw.weeks === 'object' ? raw.weeks : {};
  for (const [monday, w] of Object.entries(src)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(monday) || !w || typeof w !== 'object') continue;
    weeks[monday] = normalizeWeek(w, sessionIds);
  }
  return { version: 1, weeks };
}

const isTime = (t) => typeof t === 'string' && /^\d{2}:\d{2}$/.test(t);

export function normalizeWeek(w, sessionIds = null) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = Array.isArray(w?.days) && w.days[i] && typeof w.days[i] === 'object' ? w.days[i] : {};
    const seenClass = new Set();
    const classes = (Array.isArray(d.classes) ? d.classes : [])
      .map((c) => (typeof c === 'string' ? { id: c } : c))
      .filter((c) => c && CLASS[c.id] && !seenClass.has(c.id) && seenClass.add(c.id))
      .map((c) => ({
        id: c.id,
        time: isTime(c.time) ? c.time : '',
        hours: Number.isFinite(c.hours) && c.hours > 0 && c.hours <= 12 ? c.hours : CLASS[c.id].hours,
      }));
    const seen = new Set();
    const sessions = (Array.isArray(d.sessions) ? d.sessions : [])
      .map((s) => (typeof s === 'string' ? { id: s, time: '' } : s))
      .filter((s) => s && typeof s.id === 'string' && (!sessionIds || sessionIds.includes(s.id)) && !seen.has(s.id) && seen.add(s.id))
      .map((s) => ({ id: s.id, time: isTime(s.time) ? s.time : '' }));
    return { classes, sessions };
  });
  return { deload: w?.deload === true, days };
}

export const emptyWeek = () => normalizeWeek({});

export const weekFromExample = (example) => normalizeWeek({
  days: Array.from({ length: 7 }, (_, i) => example.days.find((d) => d.day === i) || {}),
});

// A copy of a week's classes and sessions for another week; deload doesn't
// carry over.
export const copyWeek = (w) => normalizeWeek({ days: w.days });

export const isPlanned = (w) => !!w && w.days.some((d) => d.classes.length || d.sessions.length);

/* ── schedule ────────────────────────────────────────────────────────── */

// Every planned session in [from, to), in day order. The key —
// 'YYYY-MM-DD|session id' — is what the log is stored under.
export function occurrences(routine, weeks, from, to) {
  const byId = Object.fromEntries(routine.sessions.map((s) => [s.id, s]));
  const out = [];
  for (let monday = weekStart(from); monday < to; monday = addDays(monday, 7)) {
    const week = weeks.weeks[ymd(monday)];
    if (!week) continue;
    week.days.forEach((d, i) => {
      const date = addDays(monday, i);
      if (date < new Date(from.getFullYear(), from.getMonth(), from.getDate()) || date >= to) return;
      for (const p of d.sessions) {
        if (byId[p.id]) out.push({ key: `${ymd(date)}|${p.id}`, session: byId[p.id], date, time: p.time, classes: d.classes });
      }
    });
  }
  return out;
}

/* ── rule checks ─────────────────────────────────────────────────────── */

const at = (day, hhmm) => { const [h, m] = hhmm.split(':').map(Number); return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m); };
const HOUR = 3600000;
const fmtHours = (h) => `${Math.round(h)} hours`;

// Checks a week against the plan's weekly minimums and placement rules 1–5.
// When a session and a class both have times, gaps are exact hours from the
// end of one to the start of the other. When either has no time it falls
// back to whole days: "48 hours before pole" reads as "not the day before".
// Neighbouring weeks are looked at across the Monday/Sunday boundary.
//   minimums: [{ session, count, planned }]
//   flags:    [{ day, session, level 'warn'|'info', rule, text }]
export function checkWeek(routine, weeks, monday) {
  const week = weeks.weeks[ymd(monday)] || emptyWeek();
  const dayAt = (i) => {
    if (i >= 0 && i < 7) return week.days[i];
    const other = weeks.weeks[ymd(addDays(monday, Math.floor(i / 7) * 7))];
    return other ? other.days[((i % 7) + 7) % 7] : { classes: [], sessions: [] };
  };
  // Classes from 3 days before to 3 days after day d, with real start/end
  // times where known.
  const classesNear = (d) => {
    const out = [];
    for (let i = d - 3; i <= d + 3; i++) {
      for (const c of dayAt(i).classes) {
        const date = addDays(monday, i);
        const start = c.time ? at(date, c.time) : null;
        out.push({ ...CLASS[c.id], day: i, start, end: start && new Date(start.getTime() + c.hours * HOUR) });
      }
    }
    return out;
  };
  const named = (c) => `${DAY_NAMES[((c.day % 7) + 7) % 7]}’s ${c.label.toLowerCase()}`;
  const title = (id) => routine.sessions.find((s) => s.id === id)?.title || id;
  const minutes = (id) => routine.sessions.find((s) => s.id === id)?.minutes || 0;

  const flags = [];
  const flag = (day, session, level, rule, text) => flags.push({ day, session, level, rule, text });
  for (let d = 0; d < 7; d++) {
    const today = dayAt(d).classes.map((c) => CLASS[c.id]);
    const dayLabel = today.map((c) => c.label.toLowerCase()).join(' and ');
    for (const { id, time } of week.days[d].sessions) {
      const start = time ? at(addDays(monday, d), time) : null;
      const end = start && new Date(start.getTime() + minutes(id) * HOUR / 60);
      const near = classesNear(d);
      // Hours from this session to a later class, or from an earlier class
      // to this session; null when either has no time.
      const until = (c) => (end && c.start ? (c.start - end) / HOUR : null);
      const since = (c) => (start && c.end ? (start - c.end) / HOUR : null);
      const next = (pred) => near.filter((c) => c.day > d && pred(c)).sort((a, b) => a.day - b.day || (a.start || 0) - (b.start || 0))[0];
      const prev = (pred) => near.filter((c) => c.day < d && pred(c)).sort((a, b) => b.day - a.day || (b.end || 0) - (a.end || 0))[0];
      const sameDay = near.filter((c) => c.day === d);
      // Same-day classes: before this session or after it.
      const laterToday = sameDay.filter((c) => (until(c) ?? -1) >= 0);
      const minGapToday = Math.min(...laterToday.map(until));
      const afterClassToday = sameDay.length && sameDay.every((c) => (since(c) ?? -1) >= 0);

      // Whole-day fallback when a time is missing: 24 hours per day apart.
      const hours = (c, f, fallback) => f(c) ?? fallback;

      if (id === 'splits-intensive') {
        const c = next((x) => x.hard);
        if (today.length) flag(d, id, 'warn', 1, `Splits Intensive goes on a free day, not a ${dayLabel} day.`);
        else if (c) {
          const h = hours(c, until, c.day - d === 1 ? 24 : c.day - d === 2 ? 48 : 72);
          if (h < 48) flag(d, id, 'warn', 1, `Splits Intensive is ${until(c) == null ? 'less than 48 hours' : `${fmtHours(h)}`} before ${named(c)}. Aim for 48, ideally 72.`);
          else if (h < 72) flag(d, id, 'info', 1, `${named(c)} is ${until(c) == null ? 'about 48 hours' : fmtHours(h)} away. 72 is better if another day allows it.`);
        }
      }

      if (id === 'shoulder-hyperflexion') {
        if (today.some((c) => c.pole)) flag(d, id, 'warn', 2, 'Never on a pole or pole-tricks day.');
        else {
          const c = next((x) => x.pole);
          if (c) {
            const h = hours(c, until, c.day - d === 1 ? 24 : 48);
            if (h < 48) flag(d, id, 'warn', 2, until(c) == null ? 'Pole is tomorrow. Shoulder Hyperflexion needs at least 48 hours before pole.' : `Only ${fmtHours(h)} before ${named(c)}. It needs at least 48.`);
          }
          const p = prev((x) => x.pole);
          if (p) {
            const h = since(p);
            if (h != null && h < 24) flag(d, id, 'warn', 2, `Only ${fmtHours(h)} after ${named(p)}. It needs at least 24.`);
            else if (h == null && p.day === d - 1) flag(d, id, 'info', 2, 'Pole was yesterday. Make sure it’s at least 24 hours after class.');
          }
        }
      }

      if (id === 'hips-backbend') {
        if (today.some((c) => c.pole)) flag(d, id, 'warn', 3, 'Hips & Backbend never goes on a pole day.');
        else if (next((x) => x.pole)?.day === d + 1) flag(d, id, 'info', 3, 'Pole is tomorrow: stop bridging at 2 reps and about 80% of your usual depth.');
      }

      // Rule 5: long passive work on a class day should finish at least a
      // few hours before class. The plan's examples say 3 to 4.
      const big = ['splits-intensive', 'shoulder-hyperflexion', 'hips-backbend'].includes(id);
      if (big && id !== 'splits-intensive' && today.length && !today.some((c) => c.pole)) {
        if (laterToday.length && minGapToday < 3) flag(d, id, 'warn', 5, `Ends only ${minGapToday < 1 ? `${Math.max(0, Math.round(minGapToday * 60))} minutes` : `${minGapToday.toFixed(1).replace(/\.0$/, '')} hours`} before ${dayLabel}. Finish at least 3 to 4 hours before.`);
        else if (afterClassToday) flag(d, id, 'info', 6, 'After class: stay at your usual depth and don’t chase new depth when tired.');
        else if (!laterToday.length) flag(d, id, 'info', 5, `Finish at least a few hours before ${dayLabel}.`);
      }
      if (id === 'splits-snack' && today.length) {
        if (afterClassToday) flag(d, id, 'info', 6, 'After class: stay at your usual depth.');
        else flag(d, id, 'info', 5, laterToday.length ? 'Before class: keep holds under 60 seconds.' : 'Class day: before class keep holds under 60 seconds; after class stay at your usual depth.');
      }

      if (big && dayAt(d + 1).sessions.some((s) => s.id === id)) {
        flag(d, id, 'warn', 4, `${title(id)} two days running. Loaded end-range work for the same region needs a day between.`);
      }
    }
  }

  const minimums = routine.guide.minimums.map((m) => ({
    ...m,
    planned: week.days.filter((d) => d.sessions.some((s) => s.id === m.session)).length,
  }));
  return { minimums, flags };
}

/* ── checklist ───────────────────────────────────────────────────────── */

export const cueText = (c) => (typeof c === 'string' ? c : c.text);
export const cueSub = (c) => typeof c === 'object' && c.sub === true;

// What gets ticked off for a session, keyed 'Section / Name', or just the
// name in a session with one unnamed section, or just the section for an
// item that is the whole section.
export function checklist(session, variant = 'full') {
  if (variant === 'short' && session.short) {
    return session.short.items.map((item) => ({ id: `Short / ${item.name}`, section: null, item }));
  }
  return session.sections.flatMap((section) => section.items.map((item) => ({
    id: item.whole ? section.title : section.title ? `${section.title} / ${item.name}` : item.name, section, item,
  })));
}

/* ── durations and timer presets ─────────────────────────────────────── */

export function parseDuration(text) {
  const m = /(\d+(?:\.\d+)?)\s*(?:(?:[-–]|to)\s*\d+(?:\.\d+)?\s*)?(min|sec|s)\b/i.exec(text || '');
  if (!m) return null;
  return Math.round(parseFloat(m[1]) * (m[2].toLowerCase() === 'min' ? 60 : 1));
}

// Offers a single hold or a per-side time when the notes give one, then the
// whole block.
export function timerOptions(item) {
  const opts = [];
  const add = (label, seconds) => { if (seconds && !opts.some((o) => o.seconds === seconds)) opts.push({ label, seconds }); };
  for (const t of [item.duration, item.detail, ...(item.cues || []).map(cueText)]) {
    const side = /(\d+(?:\.\d+)?\s*(?:min|sec|s))\s*(?:\/\s*|each\s+|per\s+)(side|leg|direction|arm)\b/i.exec(t || '');
    if (side) add(`${side[1]}/${side[2]}`, parseDuration(side[1]));
    const hold = /\b\d+\s*(?:reps?\s*)?x\s*(\d+(?:\.\d+)?\s*(?:min|s))\b/i.exec(t || '');
    if (hold) add(`${hold[1]} hold`, parseDuration(hold[1]));
  }
  add(item.duration, parseDuration(item.duration));
  return opts;
}

/* ── movement reference ──────────────────────────────────────────────── */

// Names the plan uses for the same movement in different sessions. A
// judgement call from reading the notes, so only clear matches are listed.
const ALIASES = {
  'couch stretch extended': 'couch stretch',
  'couch or kneeling hip flexor': 'couch stretch',
  'contract relax': 'contract relax hip flexor',
  'thoracic spine roll': 'thoracic roll',
  'thoracic roll and arch backs': 'thoracic roll',
  'lats roll': 'foam roll lats',
  'standing splits at pole': 'standing splits',
  'bridge prep or glute bridge': 'bridge prep',
  'bridge prep glute bridge': 'bridge prep',
  'thoracic bridge with block squeeze': 'thoracic bridge with block',
  'full bridge depth focus': 'full bridge',
  'full bridge work': 'full bridge',
  'theragun prep': 'theragun',
  'theragun recovery': 'theragun',
  'final cool down': 'cool down',
  'pole chest stretch': 'pole chest stretches',
  'pole chest stretch middle position': 'pole chest stretches',
  'pole chest stretch middle position only': 'pole chest stretches',
  'high position': 'pole chest stretches',
  'middle position': 'pole chest stretches',
  'low position': 'pole chest stretches',
  'round 1 passive': 'shoulder hyperflexion on bench',
  'round 2 active': 'shoulder hyperflexion on bench',
  'round 3 unweighted': 'shoulder hyperflexion on bench',
  'thread the needle and arm circles': 'thread the needle',
  'childs pose and deep breathing': 'childs pose',
};

const rawKey = (name) => name.toLowerCase().replace(/→/g, ' to ').replace(/&/g, ' and ').replace(/['’]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();

export function moveKey(name) {
  const k = rawKey(name);
  return ALIASES[k] || k;
}

// One entry per movement in the plan: the sessions it's in, and every
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

// The session as calendar notes: length, what it's for, the sections and
// movements, the short version and the deload note.
export function describe(s) {
  const out = [`⏱ ${s.length}`];
  for (const p of s.about || []) out.push(p);
  for (const n of s.notes || []) out.push(`${n.label}: ${n.text}`);
  const itemLine = (it) => `• ${it.name}, ${it.duration}${it.detail ? `: ${it.detail}` : ''}`;
  for (const sec of s.sections) {
    out.push('');
    if (sec.title) out.push(`${sec.title.toUpperCase()}${sec.minutes ? ` — ${sec.minutes} min` : ''}${sec.note ? `. ${sec.note}` : ''}`);
    for (const it of sec.items) out.push(it.whole ? (it.detail || '') : itemLine(it));
  }
  for (const p of s.after || []) out.push('', p);
  if (s.deload) out.push('', `Deload week: ${s.deload}`);
  if (s.short) {
    out.push('', `${s.short.minutes}-MINUTE VERSION`, ...s.short.items.map(itemLine));
    if (s.short.skip) out.push(`Skip ${s.short.skip}.`);
  }
  return out.join('\n').trim();
}

const icsText = (s) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const icsDate = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const icsLocal = (d) => `${icsDate(d)}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
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

// One event per planned session in [from, to). A session with a time runs
// for the session's length from then; one without is an all-day event.
// Timed events are written without a time zone ("floating"), so they land
// at the same clock time wherever the calendar is.
// CHECK: does Apple Calendar import floating times as local, or shift them?
// CHECK: re-importing reuses each session's UID — does Calendar update the
// existing events, or add duplicates next to them?
export function toIcs(routine, weeks, from, to, now = new Date()) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//static-apps//flex-training//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Flex Training'];
  for (const o of occurrences(routine, weeks, from, to)) {
    lines.push('BEGIN:VEVENT', `UID:${ymd(o.date)}-${o.session.id}@flex-training`, `DTSTAMP:${icsUtc(now)}`);
    if (o.time) {
      const [h, m] = o.time.split(':').map(Number);
      const start = new Date(o.date.getFullYear(), o.date.getMonth(), o.date.getDate(), h, m);
      lines.push(`DTSTART:${icsLocal(start)}`, `DTEND:${icsLocal(new Date(start.getTime() + o.session.minutes * 60000))}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${icsDate(o.date)}`, `DTEND;VALUE=DATE:${icsDate(addDays(o.date, 1))}`);
    }
    lines.push(`SUMMARY:${icsText(o.session.title)}`, `DESCRIPTION:${icsText(describe(o.session))}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
