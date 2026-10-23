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

// From the plan's "What counts as hard". `load` is a class's default load:
// pole tricks is hard for the upper body, the rest are light. You can mark
// any class hard on the day ("call it hard if you are sore the next day").
// `uses` is which holds to keep off the hour or two before it (rule 4):
// before tricks no long shoulder, lat or chest holds; before dance no long
// hip or hamstring holds. Pole dance and rehearsal count as dance. Climbing
// and skating have none: you're not usually sore after them, so the plan's
// muscle-group rules aren't applied. `hours` is the length when you haven't
// given one.
export const CLASS_TYPES = [
  { id: 'pole-tricks', label: 'Pole tricks', load: 'upper', uses: 'upper', hours: 1.5 },
  { id: 'pole-dance', label: 'Pole dance', load: 'light', uses: 'lower', hours: 1.5 },
  { id: 'dance', label: 'Dance', load: 'light', uses: 'lower', hours: 1.5 },
  { id: 'rehearsal', label: 'Rehearsal', load: 'light', uses: 'lower', hours: 2.5 },
  { id: 'climbing', label: 'Climbing', load: 'light', uses: null, hours: 2 },
  { id: 'skating', label: 'Skating', load: 'light', uses: null, hours: 1.5 },
];
const CLASS = Object.fromEntries(CLASS_TYPES.map((c) => [c.id, c]));
export const LOADS = { light: 'Light', upper: 'Hard · upper body', lower: 'Hard · lower body', both: 'Hard · whole body' };
// Earlier versions of the app stored a plain "pole" class.
const RENAMED = { pole: 'pole-tricks' };

// Which body region a session loads. Only upper and lower sessions have long
// holds that rules 1–5 are about.
export const SESSION_REGION = {
  'splits-intensive': 'lower', 'hips-thoracic': 'lower', 'splits-snack': 'lower',
  'shoulders-bridge': 'upper', 'shoulder-recovery': 'gentle', 'shoulder-reset': 'gentle', 'class-prep': 'prep',
};

/* ── stored weeks ────────────────────────────────────────────────────── */

// { version: 1, weeks: { ['YYYY-MM-DD' of the Monday]: week } }
//   week:    { deload, days: [7 × { classes, sessions }] }
//            deload: '' automatic (see deloadInfo), 'on' or 'off'. Older
//            saves have true (kept as 'on') or false, which was written
//            on every week, so it reads as automatic
//   class:   { id, time 'HH:MM'|'', hours, load, double }; a bare id string
//            is read as one with no time and the type's defaults
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
      .filter((c) => c && typeof c.id === 'string')
      .map((c) => ({ ...c, id: RENAMED[c.id] || c.id }))
      .filter((c) => CLASS[c.id] && !seenClass.has(c.id) && seenClass.add(c.id))
      .map((c) => ({
        id: c.id,
        time: isTime(c.time) ? c.time : '',
        hours: Number.isFinite(c.hours) && c.hours > 0 && c.hours <= 12 ? c.hours : CLASS[c.id].hours,
        load: LOADS[c.load] ? c.load : CLASS[c.id].load,
        double: c.double === true,
      }));
    const seen = new Set();
    const sessions = (Array.isArray(d.sessions) ? d.sessions : [])
      .map((s) => (typeof s === 'string' ? { id: s, time: '' } : s))
      .filter((s) => s && typeof s.id === 'string' && (!sessionIds || sessionIds.includes(s.id)) && !seen.has(s.id) && seen.add(s.id))
      .map((s) => ({ id: s.id, time: isTime(s.time) ? s.time : '' }));
    return { classes, sessions };
  });
  const deload = w?.deload === true || w?.deload === 'on' ? 'on' : w?.deload === 'off' ? 'off' : '';
  return { deload, days };
}

export const emptyWeek = () => normalizeWeek({});

export const weekFromExample = (example) => normalizeWeek({
  days: Array.from({ length: 7 }, (_, i) => example.days.find((d) => d.day === i) || {}),
});

// A copy of a week's classes and sessions for another week; deload doesn't
// carry over.
export const copyWeek = (w) => normalizeWeek({ days: w.days });

export const isPlanned = (w) => !!w && w.days.some((d) => d.classes.length || d.sessions.length);

/* ── deload weeks ────────────────────────────────────────────────────── */

// The plan deloads every 4th week, and in any week with illness, poor
// sleep or a performance, "moving the fixed deload rather than stacking
// two". So weeks are counted from the first one you planned: after three
// weeks without one, the next is a deload. A week you mark as a deload
// restarts the count; one you mark "not this week" pushes it on a week.
//   → { deload, setting '' | 'on' | 'off', next: Monday 'YYYY-MM-DD' of the
//       next deload after this week }
export function deloadInfo(weeks, monday) {
  const target = ymd(weekStart(monday));
  const known = Object.entries(weeks.weeks).filter(([, w]) => isPlanned(w) || w.deload).map(([k]) => k).sort();
  let day = fromYmd(known[0] && known[0] < target ? known[0] : target);
  let since = 0; // weeks since the last deload
  let result = null;
  for (let n = 0; n < 1000; n++, day = addDays(day, 7)) {
    const key = ymd(day);
    const setting = weeks.weeks[key]?.deload || '';
    const deload = setting === 'on' || (setting !== 'off' && since >= 3);
    since = deload ? 0 : since + 1;
    if (key === target) result = { deload, setting };
    else if (result && deload) return { ...result, next: key };
  }
  return { ...result, next: null };
}

/* ── suggested week ──────────────────────────────────────────────────── */

const BIG = ['shoulders-bridge', 'splits-intensive', 'hips-thoracic'];
const LOWER = ['splits-intensive', 'hips-thoracic', 'splits-snack'];
const SHOULDER = ['shoulders-bridge', 'shoulder-recovery', 'shoulder-reset'];
const DAYS7 = [0, 1, 2, 3, 4, 5, 6];

// Places the weekly minimums around the week's classes: every arrangement
// of the three big sessions (one per day), then the Splits Snack and
// Shoulder Reset around the best few, scored by checkWeek's flags. The
// upper-body session goes first, as the plan's "how to build your week"
// says. Shoulder Recovery goes after the first tricks class (the day after
// a double night, which skips any session), or after pole dance if there's
// no tricks. Class-day prep goes on any class day left empty. New sessions
// get no times.
//   keep: per day, sessions that stay where they are (ones you've done or
//         started); they count toward the minimums and aren't placed again
//   from: first day sessions can go on (today, in the current week)
//   score: a warning costs 1000, a reminder 10, or 100 for a rule 1
//   reminder: without times, two days either side of tricks could be under
//   48 hours, so the suggestion leans towards three. A third session on one day
//   costs 300, more than leaving a session out (250 for a big one, 150 for
//   a short one), so a week with few days left gets fewer sessions rather
//   than a pile-up; the plan says a skipped week costs little. Two splits
//   or two shoulder sessions on one day cost 30, since the minimums are
//   meant as separate exposures. Then small nudges against a session on a
//   class day (rule 4), two sessions on one day, and lower-body sessions on
//   back-to-back days.
export function suggestWeek(routine, weeks, monday, { keep = [], from = 0 } = {}) {
  const key = ymd(monday);
  const base = normalizeWeek(weeks.weeks[key] || {});
  const kept = DAYS7.map((i) => (keep[i] || []).map((s) => ({ id: s.id, time: s.time || '' })));
  const keptIds = new Set(kept.flat().map((s) => s.id));
  const ids = new Set(routine.sessions.map((s) => s.id).filter((id) => !keptIds.has(id)));
  const days = base.days.map((d) => d.classes);
  const doubleNight = (i) => days[i].some((c) => c.double && hardFor(c, 'upper'));
  const open = DAYS7.filter((i) => i >= from && !doubleNight(i));

  const fixed = DAYS7.map(() => []);
  const tricks = DAYS7.find((i) => days[i].some((c) => hardFor(c, 'upper')) && (doubleNight(i) ? i + 1 : i) >= from);
  const poleDance = DAYS7.find((i) => i >= from && days[i].some((c) => c.id === 'pole-dance'));
  let recoveryDay = tricks != null ? (doubleNight(tricks) ? tricks + 1 : tricks) : poleDance;
  if (recoveryDay > 6) recoveryDay = null;
  if (ids.has('shoulder-recovery') && recoveryDay != null) fixed[recoveryDay].push('shoulder-recovery');

  const SKIP = -1;
  const skipCost = (placed) => (placed[SKIP] || []).reduce((n, id) => n + (BIG.includes(id) ? 250 : 150), 0);
  const build = (placed) => {
    const w = normalizeWeek(base);
    w.days.forEach((d, i) => {
      d.sessions = [...kept[i], ...[...fixed[i], ...(placed[i] || [])].map((id) => ({ id, time: '' }))];
    });
    return w;
  };
  const score = (w) => {
    const all = { ...weeks, weeks: { ...weeks.weeks, [key]: w } };
    let n = 0;
    for (const f of checkWeek(routine, all, monday).flags) n += f.level === 'warn' ? 1000 : f.rule === 1 ? 100 : 10;
    w.days.forEach((d, i) => {
      const own = d.sessions.filter((s) => s.id !== 'class-prep' && !(s.id === 'shoulder-recovery' && i === recoveryDay));
      if (own.length && d.classes.length) n += 3 * own.length;
      if (d.sessions.length > 1) n += 2 * (d.sessions.length - 1);
      if (d.sessions.length > 2) n += 300 * (d.sessions.length - 2);
      for (const group of [LOWER, SHOULDER]) n += 30 * Math.max(0, d.sessions.filter((s) => group.includes(s.id)).length - 1);
      if (i < 6 && own.some((s) => LOWER.includes(s.id)) && w.days[i + 1].sessions.some((s) => LOWER.includes(s.id))) n += 1;
    });
    return n;
  };
  if (!open.length) return build({});

  // Each session goes on an open day, or is left out (SKIP) at a cost.
  const bigIds = BIG.filter((id) => ids.has(id));
  const bigPlans = [];
  const place = (k, used, placed) => {
    if (k === bigIds.length) { bigPlans.push({ placed, score: score(build(placed)) + skipCost(placed) }); return; }
    for (const i of [...open, SKIP]) {
      if (i !== SKIP && used.has(i)) continue;
      place(k + 1, new Set([...used, i]), { ...placed, [i]: [...(placed[i] || []), bigIds[k]] });
    }
  };
  place(0, new Set(), {});
  bigPlans.sort((a, b) => a.score - b.score);

  // With no tricks or pole dance to follow, Shoulder Recovery is placed
  // like the other short sessions.
  const extras = ['splits-snack', 'shoulder-reset', ...(recoveryDay == null ? ['shoulder-recovery'] : [])].filter((id) => ids.has(id));
  let best = null;
  for (const { placed } of bigPlans.slice(0, 8)) {
    const tryExtras = (k, p) => {
      if (k === extras.length) {
        const w = build(p);
        const sc = score(w) + skipCost(p);
        if (!best || sc < best.score) best = { w, score: sc };
        return;
      }
      for (const i of [...open, SKIP]) tryExtras(k + 1, { ...p, [i]: [...(p[i] || []), extras[k]] });
    };
    tryExtras(0, placed);
  }
  const w = best.w;
  if (ids.has('class-prep')) w.days.forEach((d, i) => { if (i >= from && d.classes.length && !d.sessions.length) d.sessions.push({ id: 'class-prep', time: '' }); });
  return w;
}

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
const hardFor = (c, region) => c.load === region || c.load === 'both';
const usesRegion = (c, region) => c.uses === region || c.uses === 'both';
const HOLDS = { upper: 'shoulder, lat and chest', lower: 'hip and hamstring' };
// "Late" for rule 7: the plan's evidence is about 9 to 10 PM.
const LATE = '21:00';

// Checks a week against the plan's weekly minimums and placement rules.
// When a session and a class both have times, gaps are exact hours from the
// end of one to the start of the other. When either has no time it falls
// back to whole days, 24 hours per day apart. Neighbouring weeks are looked
// at across the Monday/Sunday boundary.
//   minimums: [{ session, count, load, serves, planned }]
//   flags:    [{ day, session, level 'warn'|'info', rule, text }]
export function checkWeek(routine, weeks, monday) {
  const week = weeks.weeks[ymd(monday)] || emptyWeek();
  const dayAt = (i) => {
    if (i >= 0 && i < 7) return week.days[i];
    const other = weeks.weeks[ymd(addDays(monday, Math.floor(i / 7) * 7))];
    return other ? other.days[((i % 7) + 7) % 7] : { classes: [], sessions: [] };
  };
  const classesNear = (d) => {
    const out = [];
    for (let i = d - 3; i <= d + 3; i++) {
      for (const c of dayAt(i).classes) {
        const start = c.time ? at(addDays(monday, i), c.time) : null;
        out.push({ ...CLASS[c.id], ...c, day: i, start, end: start && new Date(start.getTime() + c.hours * HOUR) });
      }
    }
    return out;
  };
  const named = (c) => `${DAY_NAMES[((c.day % 7) + 7) % 7]}’s ${c.label.toLowerCase()}`;
  const listed = (cs) => cs.map((c) => c.label.toLowerCase()).join(' and ');
  const title = (id) => routine.sessions.find((s) => s.id === id)?.title || id;
  const minutes = (id) => routine.sessions.find((s) => s.id === id)?.minutes || 0;

  const flags = [];
  const flag = (day, session, level, rule, text) => flags.push({ day, session, level, rule, text });
  for (let d = 0; d < 7; d++) {
    for (const { id, time } of week.days[d].sessions) {
      const region = SESSION_REGION[id];
      const start = time ? at(addDays(monday, d), time) : null;
      const end = start && new Date(start.getTime() + minutes(id) * HOUR / 60);
      const near = classesNear(d);
      const today = near.filter((c) => c.day === d);
      // Hours from this session's end to a later class's start, or from an
      // earlier class's end to this session's start. Whole days if untimed.
      const until = (c) => (end && c.start ? (c.start - end) / HOUR : (c.day - d) * 24);
      const since = (c) => (start && c.end ? (start - c.end) / HOUR : (d - c.day) * 24);
      const timed = (c) => !!(start && c.start);
      const after = near.filter((c) => c.day > d).sort((a, b) => until(a) - until(b));
      const before = near.filter((c) => c.day < d).sort((a, b) => since(a) - since(b));
      // A class later the same day, and whether every class today is done.
      const laterToday = today.filter((c) => timed(c) && until(c) >= 0);
      const afterAllToday = today.length > 0 && today.every((c) => timed(c) && since(c) >= 0);

      // Rule 6: a double tricks night.
      const double = today.find((c) => c.double && hardFor(c, 'upper'));
      if (double && id !== 'class-prep') flag(d, id, 'warn', 6, `Double ${double.label.toLowerCase()} night: skip any session tonight.`);

      if (id === 'shoulders-bridge') {
        const hardToday = today.find((c) => hardFor(c, 'upper'));
        const next = after.find((c) => hardFor(c, 'upper'));
        const last = before.find((c) => hardFor(c, 'upper'));
        if (hardToday) flag(d, id, 'warn', 1, `Not on a ${hardToday.label.toLowerCase()} day. It goes at least 48 hours before the next one and after soreness from the last has gone.`);
        else {
          if (next && until(next) < 48) flag(d, id, 'warn', 1, `Only ${timed(next) ? fmtHours(until(next)) : 'a day'} before ${named(next)}. It needs at least 48 hours.`);
          // Two days apart without times could be either side of 48 hours.
          else if (next && !timed(next) && until(next) < 72) flag(d, id, 'info', 1, `Two days before ${named(next)}: fine if it’s 48 hours from the end of this session to the start of class. Add times to check.`);
          if (last) {
            // Soreness typically peaks 24 to 72 hours after hard loaded work;
            // a double night adds a day (rule 6).
            const window = last.double ? 72 : 48;
            const h = since(last);
            if (h < window) flag(d, id, 'warn', 1, `${timed(last) ? `Only ${fmtHours(h)}` : `${Math.round(h / 24)} day${h > 24 ? 's' : ''}`} after ${named(last)}${last.double ? ' (a double)' : ''}. Wait until the soreness has gone, usually ${last.double ? '3 to 4' : '2 to 3'} days.`);
            else if (h < window + 24) flag(d, id, 'info', 1, `${DAY_NAMES[((last.day % 7) + 7) % 7]} was ${last.label.toLowerCase()}. Only do this once that soreness has gone.`);
          }
        }
      }

      if (['shoulders-bridge', 'splits-intensive'].includes(id) && dayAt(d + 1).sessions.some((s) => s.id === id)) {
        flag(d, id, 'warn', 2, `${title(id)} two days running. Loaded end-range work for the same region needs a day between.`);
      }

      if (id === 'splits-intensive') {
        // A class later the same day counts too, as does one on the same
        // day with no time to say it's already over.
        const ahead = [...today.filter((c) => !timed(c) || until(c) >= 0), ...after];
        const hard = ahead.find((c) => hardFor(c, 'lower') && until(c) < 48);
        const kicks = after.find((c) => !hardFor(c, 'lower') && usesRegion(c, 'lower') && until(c) < 48);
        if (hard) flag(d, id, 'warn', 3, `Only ${timed(hard) ? fmtHours(until(hard)) : 'a day'} before ${named(hard)}, marked hard for the lower body. Keep Splits Intensive 48 hours before it.`);
        else if (kicks) flag(d, id, 'info', 3, `${timed(kicks) ? fmtHours(until(kicks)) : 'Less than 48 hours'} before ${named(kicks)}. Fine unless big splits or kicks matter in that class.`);
      }

      // Rule 4: long holds for a region stay off the hour or two before a
      // class that uses it. Shoulder Recovery is gentle but has 2-minute
      // chest holds, so it counts as upper body here; it's meant for after
      // class, so it's only flagged when timed shortly before one.
      // Shoulders & Bridge on a tricks day is rule 1's to flag.
      const holds = id === 'shoulder-recovery' ? 'upper' : region;
      if (holds === 'upper' || holds === 'lower') {
        const users = today.filter((c) => usesRegion(c, holds) && !(id === 'shoulders-bridge' && hardFor(c, 'upper')));
        if (users.length) {
          const soon = users.filter((c) => laterToday.includes(c) && until(c) < 2);
          if (soon.length) flag(d, id, 'warn', 4, `Ends ${until(soon[0]) < 1 ? `${Math.max(0, Math.round(until(soon[0]) * 60))} minutes` : `${until(soon[0]).toFixed(1).replace(/\.0$/, '')} hours`} before ${listed(soon)}. Keep long ${HOLDS[holds]} holds off the hour or two before class.`);
          else if (id !== 'shoulder-recovery' && users.some((c) => !timed(c))) flag(d, id, 'info', 4, `Class day: keep long ${HOLDS[holds]} holds off the hour or two before ${listed(users)}.`);
        }
      }

      // Rule 5: the day after tricks is gentle for the upper body.
      const yesterday = before.find((c) => hardFor(c, 'upper') && (c.day === d - 1 || (c.double && c.day === d - 2)));
      if (yesterday && id === 'shoulder-reset') flag(d, id, 'info', 5, `The day after ${yesterday.label.toLowerCase()}: Shoulder Recovery or nothing for the upper body while you’re sore.`);
      if (yesterday && id === 'hips-thoracic') flag(d, id, 'info', 5, `The day after ${yesterday.label.toLowerCase()}: skip the thoracic roll and arch-backs if your upper back is sore.`);

      // Rule 7: late sessions are maintenance only.
      if (time && time >= LATE && ['splits-intensive', 'shoulders-bridge', 'hips-thoracic'].includes(id)) {
        flag(d, id, 'info', 7, 'Late session: maintenance only. Usual depth, no chasing new depth.');
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

// A session's shorter versions, by id ('short', 'bridge').
export const versionOf = (session, variant) => (session.versions || []).find((v) => v.id === variant) || null;

// What gets ticked off for a session, keyed 'Section / Name', or just the
// name in a session with one unnamed section, or just the section for an
// item that is the whole section. A shorter version's items are keyed by
// the version: 'Short / Name', 'Bridge / Name'.
export function checklist(session, variant = 'full') {
  const v = versionOf(session, variant);
  if (v) {
    const prefix = v.id[0].toUpperCase() + v.id.slice(1);
    return v.items.map((item) => ({ id: `${prefix} / ${item.name}`, section: null, item }));
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

/* ── guided player ───────────────────────────────────────────────────── */

export const READY_SECONDS = 10;
const HALVES = {
  side: ['First side', 'Second side'],
  leg: ['First leg', 'Second leg'],
  arm: ['First arm', 'Second arm'],
  direction: ['One direction', 'Other direction'],
};

// The timer steps for one movement in the guided player: a short "Get
// ready", then the block. When the notes give a per-side (or per-leg…)
// time that adds up to the block, the block is split into the two halves
// so there's a cue to switch.
//   → [{ label, seconds, ready? }]
export function playPhases(item) {
  const total = parseDuration(item.duration) || 60;
  const phases = [{ label: 'Get ready', seconds: READY_SECONDS, ready: true }];
  const half = timerOptions(item).find((o) => o.label.includes('/'));
  const names = half && HALVES[half.label.split('/')[1]];
  if (names && Math.abs(half.seconds * 2 - total) <= total * 0.25) {
    phases.push({ label: names[0], seconds: half.seconds }, { label: names[1], seconds: half.seconds });
  } else {
    phases.push({ label: '', seconds: total });
  }
  return phases;
}

// Where the player goes after index `from`: the next movement not yet
// ticked, or -1 when there isn't one.
export function nextToDo(items, checked, from) {
  for (let i = from + 1; i < items.length; i++) if (!checked.has(items[i].id)) return i;
  return -1;
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
  'glute bridge': 'bridge prep',
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

// One entry per movement in the plan: the sessions it's in, and each
// place it's used there (session, which version, the plan's time and
// dose). How to do it lives in form.js.
//   { key, name, sessions: [title], uses: [{ session, version, name,
//     duration, detail, cues }] }
export function movementIndex(routine) {
  const index = new Map();
  const add = (item, session, version) => {
    const key = moveKey(item.name);
    if (!index.has(key)) index.set(key, { key, name: item.name, sessions: [], uses: [] });
    const entry = index.get(key);
    // Prefer the movement's own name over a variant ("Couch stretch", not
    // "Couch stretch, extended").
    if (rawKey(item.name) === key && rawKey(entry.name) !== key) entry.name = item.name;
    if (!entry.sessions.includes(session)) entry.sessions.push(session);
    const use = { session, version, name: item.name, duration: item.duration, detail: item.detail || '', cues: item.cues || [] };
    if (!entry.uses.some((u) => JSON.stringify(u) === JSON.stringify(use))) entry.uses.push(use);
  };
  for (const s of routine.sessions) {
    for (const item of s.sections.flatMap((sec) => sec.items)) add(item, s.title, '');
    for (const v of s.versions || []) for (const item of v.items) add(item, s.title, v.label);
  }
  return [...index.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/* ── practice log ────────────────────────────────────────────────────── */

// { version: 1, entries: { ['YYYY-MM-DD|session id']: entry } }
//   entry: { date 'YYYY-MM-DD', title, variant 'full' or a version id,
//            checked: ['Section / Movement', …], notes, done, updated,
//            resume? { index, phase, left } — where the guided player
//            stopped: checklist index, timer step, seconds left }
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
      variant: typeof e.variant === 'string' && /^[a-z-]+$/.test(e.variant) ? e.variant : 'full',
      checked: Array.isArray(e.checked) ? [...new Set(e.checked.filter((c) => typeof c === 'string'))] : [],
      notes: typeof e.notes === 'string' ? e.notes : '',
      done: e.done === true,
      updated: Number.isFinite(e.updated) ? e.updated : 0,
    };
    const r = e.resume;
    if (r && Number.isInteger(r.index) && r.index >= 0 && Number.isInteger(r.phase) && r.phase >= 0 && Number.isFinite(r.left) && r.left >= 0) {
      entries[key].resume = { index: r.index, phase: r.phase, left: r.left };
    }
  }
  return { version: 1, entries };
}

export function isEmptyEntry(e) {
  return !e.done && !e.checked.length && !e.notes.trim() && !e.resume;
}

/* ── .ics export ─────────────────────────────────────────────────────── */

// The session as calendar notes: length, what it's for, the sections and
// movements, the short version and the deload note.
export function describe(s) {
  const out = [`⏱ ${s.length}`];
  for (const p of s.about || []) out.push(p);
  for (const n of s.notes || []) out.push(`${n.label}: ${n.text}`);
  const cueLines = (it, indent) => (it.cues || []).map((c) => `${indent}${cueSub(c) ? '- ' : ''}${cueText(c)}`);
  const itemLines = (it) => [`• ${it.name}, ${it.duration}${it.detail ? `: ${it.detail}` : ''}`, ...cueLines(it, '   ')];
  for (const sec of s.sections) {
    out.push('');
    if (sec.title) out.push(`${sec.title.toUpperCase()}${sec.minutes ? ` — ${sec.minutes} min` : ''}${sec.note ? `. ${sec.note}` : ''}`);
    for (const it of sec.items) {
      if (it.whole) out.push(...(it.detail ? [it.detail] : []), ...cueLines(it, '• '));
      else out.push(...itemLines(it));
    }
  }
  for (const p of s.after || []) out.push('', p);
  if (s.deload) out.push('', `Deload week: ${s.deload}`);
  for (const v of s.versions || []) {
    out.push('', v.label.toUpperCase(), ...v.items.flatMap(itemLines));
    if (v.skip) out.push(`Skip ${v.skip}.`);
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
