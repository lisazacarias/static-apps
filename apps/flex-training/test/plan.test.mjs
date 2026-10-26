import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeWeeks, normalizeWeek, emptyWeek, deloadInfo, weekFromExample, copyWeek, isPlanned,
  occurrences, checkWeek, suggestWeek, checklist, playPhases, pressCycle, resumeStep, RESUME_LAYOUT, nextToDo, READY_SECONDS, SWITCH_SECONDS, versionOf, timerOptions, parseDuration, moveKey, movementIndex,
  normalizeLog, isEmptyEntry, describe, toIcs, foldLine, weekStart, ymd, fromYmd,
} from '../plan.js';
import ROUTINE from '../routine.js';
import FORM from '../form.js';

const IDS = ROUTINE.sessions.map((s) => s.id);
const MONDAY = new Date(2026, 9, 19);
const [WEEK_A, WEEK_B] = ROUTINE.guide.examples;
const unfold = (ics) => ics.replace(/\r\n /g, '');
const weeksWith = (week, monday = MONDAY) => ({ version: 1, weeks: { [ymd(monday)]: normalizeWeek(week, IDS) } });
const plan = (days) => weeksWith({ days: Array.from({ length: 7 }, (_, i) => days[i] || {}) });
const check = (weeks) => checkWeek(ROUTINE, weeks, MONDAY).flags;
const flagsOf = (weeks) => check(weeks).map((f) => [f.day, f.session, f.level, f.rule]);
const textsOf = (weeks) => check(weeks).map((f) => `${f.level} ${f.rule}: ${f.text}`);
const cls = (id, time = '', more = {}) => ({ id, time, ...more });
const ses = (id, time) => ({ id, time });

/* ── the plan data ── */

test('the routine has the seven sessions from version 3', () => {
  assert.equal(ROUTINE.guide.version, 3);
  assert.deepEqual(IDS, ['splits-intensive', 'shoulders-bridge', 'hips-thoracic', 'shoulder-recovery', 'shoulder-reset', 'splits-snack', 'class-prep']);
  for (const s of ROUTINE.sessions) assert.ok(s.minutes > 0 && s.length, s.id);
  assert.deepEqual(ROUTINE.guide.minimums.map((m) => m.session), ['splits-intensive', 'shoulders-bridge', 'hips-thoracic', 'splits-snack', 'shoulder-recovery', 'shoulder-reset']);
});

test('every citation points at a reference', () => {
  const refs = new Set(ROUTINE.guide.references.map((r) => r.n));
  assert.equal(refs.size, 40);
  const cited = JSON.stringify(ROUTINE.sessions) + JSON.stringify({ ...ROUTINE.guide, references: [] });
  for (const [, n] of cited.matchAll(/\[(\d+)\]/g)) assert.ok(refs.has(+n), `[${n}]`);
});

test('every session and version has a checklist with unique ids and timeable items', () => {
  for (const s of ROUTINE.sessions) {
    for (const variant of ['full', ...(s.versions || []).map((v) => v.id)]) {
      const list = checklist(s, variant);
      assert.ok(list.length, `${s.id} ${variant}`);
      assert.equal(new Set(list.map((i) => i.id)).size, list.length, `${s.id} ${variant} ids`);
      for (const { item } of list) assert.ok(parseDuration(item.duration), `${s.id}: ${item.name} (${item.duration})`);
    }
  }
});

test('Shoulders & Bridge has an 18-minute, an 8-minute bridge and a deload version', () => {
  const s = ROUTINE.sessions.find((x) => x.id === 'shoulders-bridge');
  assert.deepEqual(s.versions.map((v) => [v.id, v.minutes, !!v.deloadOnly]), [['short', 18, false], ['bridge', 8, false], ['deload', 13, true]]);
  // The deload version follows the plan's deload rule: passive round only.
  const bench = s.versions[2].items.find((i) => i.name === 'Shoulder hyperflexion on bench');
  assert.equal(bench.duration, '3 min');
  assert.doesNotMatch(bench.detail, /active lift-off round \(/);
  assert.equal(s.versions[2].items.reduce((n, i) => n + parseDuration(i.duration), 0) / 60, 13);
  assert.ok(checklist(s, 'bridge').every((i) => i.id.startsWith('Bridge / ')));
  assert.ok(checklist(s, 'short').every((i) => i.id.startsWith('Short / ')));
  assert.equal(versionOf(s, 'nope'), null);
  assert.ok(checklist(s).some((i) => i.id === 'Bridge block / Camel at pole'));
});

test('checklist ids: section / name, name alone, or the whole section', () => {
  const by = (id) => ROUTINE.sessions.find((s) => s.id === id);
  assert.ok(checklist(by('splits-intensive')).some((i) => i.id === 'Hip flexor block / Psoas lunge'));
  assert.ok(checklist(by('shoulders-bridge')).some((i) => i.id === 'Lat stretch on roller'));
  assert.ok(checklist(by('hips-thoracic')).some((i) => i.id === 'Hip extension end-range strength'));
  assert.deepEqual(checklist(by('shoulder-reset')).map((i) => i.id), ['Foam roll lats', 'Shoulder CARs', 'Wall clocks']);
});

test('the example weeks name real sessions on all seven days', () => {
  for (const ex of ROUTINE.guide.examples) {
    assert.deepEqual(ex.days.map((d) => d.day), [0, 1, 2, 3, 4, 5, 6]);
    for (const d of ex.days) for (const id of d.sessions) assert.ok(IDS.includes(id), id);
  }
});

/* ── stored weeks ── */

test('weeks normalizer keeps good days and drops junk', () => {
  const w = normalizeWeeks({
    weeks: {
      '2026-10-19': { deload: true, days: [
        { classes: ['pole', 'pole-tricks', 'yoga'], sessions: ['splits-snack', { id: 'shoulder-reset', time: '21:15' }, { id: 'nope' }, 'splits-snack'] },
        { classes: [{ id: 'rehearsal', time: '19:00', hours: 3, load: 'lower', double: true }, { id: 'dance', time: '7pm', hours: -1, load: 'extreme' }] },
      ] },
      'next week': { days: [] },
      '2026-10-26': null,
    },
  }, IDS);
  assert.deepEqual(Object.keys(w.weeks), ['2026-10-19']);
  const week = w.weeks['2026-10-19'];
  assert.equal(week.deload, 'on'); // an older save's true
  assert.equal(week.days.length, 7);
  // A bare id string (how classes were first stored) reads as one with no
  // time; the old plain "pole" class is pole tricks.
  assert.deepEqual(week.days[0], {
    classes: [{ id: 'pole-tricks', time: '', hours: 1.5, load: 'upper', double: false }],
    sessions: [{ id: 'splits-snack', time: '' }, { id: 'shoulder-reset', time: '21:15' }],
  });
  assert.deepEqual(week.days[1].classes, [
    { id: 'rehearsal', time: '19:00', hours: 3, load: 'lower', double: true },
    { id: 'dance', time: '', hours: 1.5, load: 'light', double: false },
  ]);
  assert.deepEqual(week.days[6], { classes: [], sessions: [] });
  assert.deepEqual(normalizeWeeks(null), { version: 1, weeks: {} });
  assert.ok(!isPlanned(emptyWeek()));
});

test('an example becomes a week, and copying a week drops deload', () => {
  const a = weekFromExample(WEEK_A);
  assert.deepEqual(a.days[2], { classes: [{ id: 'pole-tricks', time: '', hours: 1.5, load: 'upper', double: false }], sessions: [{ id: 'shoulder-recovery', time: '' }] });
  assert.ok(isPlanned(a));
  const copy = copyWeek({ ...a, deload: 'on' });
  assert.equal(copy.deload, '');
  assert.deepEqual(copy.days, a.days);
});

/* ── deload weeks ── */

const mondays = (n) => Array.from({ length: n }, (_, i) => ymd(new Date(2026, 9, 5 + 7 * i)));
const W = mondays(12); // Oct 5, 12, 19, 26, Nov 2, …
const planned = { days: [{ classes: ['dance'] }] };
const weeksOf = (settings) => normalizeWeeks({ weeks: Object.fromEntries(Object.entries(settings).map(([k, v]) => [k, { ...planned, ...v }])) });
const deloadList = (weeks) => W.filter((k) => deloadInfo(weeks, fromYmd(k)).deload);

test('every 4th week is a deload, counted from the first planned week', () => {
  const weeks = weeksOf({ [W[0]]: {} });
  assert.deepEqual(deloadList(weeks), [W[3], W[7], W[11]]);
  assert.deepEqual(deloadInfo(weeks, fromYmd(W[0])), { deload: false, setting: '', next: W[3] });
  assert.deepEqual(deloadInfo(weeks, fromYmd(W[3])), { deload: true, setting: '', next: W[7] });
});

test('marking a deload restarts the count; "not this week" pushes it on', () => {
  // Ill in week 2: deload then, and the next one moves rather than stacking.
  assert.deepEqual(deloadList(weeksOf({ [W[0]]: {}, [W[1]]: { deload: 'on' } })), [W[1], W[5], W[9]]);
  // Performance in the deload week: push it to the week after.
  assert.deepEqual(deloadList(weeksOf({ [W[0]]: {}, [W[3]]: { deload: 'off' } })), [W[4], W[8]]);
});

test('older saves read as automatic, except a deload that was ticked', () => {
  const weeks = normalizeWeeks({ weeks: { [W[0]]: { ...planned, deload: false }, [W[2]]: { ...planned, deload: true } } });
  assert.equal(weeks.weeks[W[0]].deload, '');
  assert.equal(weeks.weeks[W[2]].deload, 'on');
  assert.deepEqual(deloadList(weeks), [W[2], W[6], W[10]]);
});

test('with nothing planned, the count starts at the week asked about', () => {
  assert.deepEqual(deloadInfo({ version: 1, weeks: {} }, fromYmd(W[4])), { deload: false, setting: '', next: W[7] });
});

test('occurrences list planned sessions in day order, keyed by date', () => {
  const weeks = weeksWith(weekFromExample(WEEK_A));
  const list = occurrences(ROUTINE, weeks, MONDAY, new Date(2026, 9, 26));
  assert.deepEqual(list.map((o) => o.key), [
    '2026-10-19|splits-snack', '2026-10-19|shoulder-reset', '2026-10-20|hips-thoracic', '2026-10-21|shoulder-recovery',
    '2026-10-22|class-prep', '2026-10-24|splits-intensive', '2026-10-25|shoulders-bridge',
  ]);
  assert.deepEqual(occurrences(ROUTINE, weeks, new Date(2026, 9, 24), new Date(2026, 9, 25)).map((o) => o.session.id), ['splits-intensive']);
  assert.equal(occurrences(ROUTINE, weeks, new Date(2026, 9, 26), new Date(2026, 10, 2)).length, 0);
});

/* ── rule checks ── */

test('the plan’s example weeks raise no warnings, only its own notes', () => {
  assert.deepEqual(textsOf(weeksWith(weekFromExample(WEEK_A))), []);
  assert.deepEqual(textsOf(weeksWith(weekFromExample(WEEK_B))), [
    'info 5: The day after pole tricks: skip the thoracic roll and arch-backs if your upper back is sore.',
    'info 3: Less than 48 hours before Sunday’s rehearsal. Fine unless big splits or kicks matter in that class.',
  ]);
});

test('rule 1: Shoulders & Bridge 48 hours before tricks, and after its soreness', () => {
  assert.deepEqual(flagsOf(plan({ 2: { classes: ['pole-tricks'], sessions: ['shoulders-bridge'] } })), [[2, 'shoulders-bridge', 'warn', 1]]);
  assert.deepEqual(flagsOf(plan({ 1: { sessions: ['shoulders-bridge'] }, 2: { classes: ['pole-tricks'] } })), [[1, 'shoulders-bridge', 'warn', 1]]);
  // Two days before, without times, could be either side of 48 hours.
  assert.deepEqual(textsOf(plan({ 0: { sessions: ['shoulders-bridge'] }, 2: { classes: ['pole-tricks'] } })),
    ['info 1: Two days before Wednesday’s pole tricks: fine if it’s 48 hours from the end of this session to the start of class. Add times to check.']);
  assert.deepEqual(flagsOf(plan({ 0: { sessions: ['shoulders-bridge'] }, 3: { classes: ['pole-tricks'] } })), []);
  // After tricks: the day after is a warning, two days after a reminder.
  assert.deepEqual(flagsOf(plan({ 2: { classes: ['pole-tricks'] }, 3: { sessions: ['shoulders-bridge'] } })), [[3, 'shoulders-bridge', 'warn', 1]]);
  assert.deepEqual(flagsOf(plan({ 2: { classes: ['pole-tricks'] }, 4: { sessions: ['shoulders-bridge'] } })), [[4, 'shoulders-bridge', 'info', 1]]);
  assert.deepEqual(flagsOf(plan({ 2: { classes: ['pole-tricks'] }, 5: { sessions: ['shoulders-bridge'] } })), []);
});

test('rule 1: light classes are fine, unless you mark them hard', () => {
  assert.deepEqual(flagsOf(plan({ 1: { sessions: ['shoulders-bridge'] }, 2: { classes: ['dance'] } })), []);
  assert.deepEqual(flagsOf(plan({ 1: { sessions: ['shoulders-bridge'] }, 2: { classes: [cls('climbing', '', { load: 'upper' })] } })), [[1, 'shoulders-bridge', 'warn', 1]]);
});

test('rule 1 with times counts hours', () => {
  // Monday 10:00–11:07, tricks Wednesday 10:00: 47 hours.
  assert.deepEqual(textsOf(plan({ 0: { sessions: [ses('shoulders-bridge', '10:00')] }, 2: { classes: [cls('pole-tricks', '10:00')] } })),
    ['warn 1: Only 47 hours before Wednesday’s pole tricks. It needs at least 48 hours.']);
  assert.deepEqual(textsOf(plan({ 0: { sessions: [ses('shoulders-bridge', '10:00')] }, 2: { classes: [cls('pole-tricks', '19:00')] } })), []);
});

test('rule 6: a double tricks night', () => {
  const night = plan({ 2: { classes: [cls('pole-tricks', '', { double: true })], sessions: ['shoulder-recovery'] }, 4: { sessions: ['shoulders-bridge'] } });
  // Skip any session that night, and the soreness window grows by a day.
  assert.deepEqual(flagsOf(night), [[2, 'shoulder-recovery', 'warn', 6], [4, 'shoulders-bridge', 'warn', 1]]);
  assert.deepEqual(flagsOf(plan({ 2: { classes: [cls('pole-tricks', '', { double: true })], sessions: ['class-prep'] } })), []);
});

test('rule 2: the same loaded session two days running', () => {
  assert.deepEqual(flagsOf(plan({ 4: { sessions: ['splits-intensive'] }, 5: { sessions: ['splits-intensive'] } })), [[4, 'splits-intensive', 'warn', 2]]);
  assert.deepEqual(flagsOf(plan({ 2: { sessions: ['splits-snack'] }, 3: { sessions: ['splits-snack'] } })), []);
});

test('rule 3: lower-body sessions can go the day after tricks', () => {
  assert.deepEqual(flagsOf(plan({ 2: { classes: ['pole-tricks'] }, 3: { sessions: ['splits-intensive'] } })), []);
  // Splits Intensive before a class marked hard for the lower body warns;
  // before a light class that uses the legs it's a reminder.
  assert.deepEqual(flagsOf(plan({ 4: { sessions: ['splits-intensive'] }, 5: { classes: [cls('dance', '', { load: 'lower' })] } })), [[4, 'splits-intensive', 'warn', 3]]);
  assert.deepEqual(flagsOf(plan({ 4: { sessions: ['splits-intensive'] }, 5: { classes: ['dance'] } })), [[4, 'splits-intensive', 'info', 3]]);
  assert.deepEqual(flagsOf(plan({ 4: { sessions: ['splits-intensive'] }, 6: { classes: ['dance'] } })), []);
});

test('rule 3 counts a hard class later the same day', () => {
  // Splits Intensive 10:00–11:30, dance marked hard for the lower body at 18:00.
  assert.deepEqual(textsOf(plan({ 2: { classes: [cls('dance', '18:00', { load: 'lower' })], sessions: [ses('splits-intensive', '10:00')] } })),
    ['warn 3: Only 7 hours before Wednesday’s dance, marked hard for the lower body. Keep Splits Intensive 48 hours before it.']);
  // After that class it's fine.
  assert.deepEqual(textsOf(plan({ 2: { classes: [cls('dance', '08:00', { load: 'lower' })], sessions: [ses('splits-intensive', '14:00')] } })), []);
});

test('rule 4: long holds stay off the hour or two before a class that uses them', () => {
  const day = (sessionTime, classId = 'dance', session = 'hips-thoracic') => plan({ 3: { classes: [cls(classId, '18:00')], sessions: [ses(session, sessionTime)] } });
  // Hips & Thoracic 16:30–17:16, dance 18:00.
  assert.deepEqual(textsOf(day('16:30')), ['warn 4: Ends 44 minutes before dance. Keep long hip and hamstring holds off the hour or two before class.']);
  assert.deepEqual(textsOf(day('14:00')), []);
  assert.deepEqual(textsOf(day('20:00')), []);
  // Pole dance and rehearsal count as dance. Shoulders & Bridge before
  // dance is fine, and climbing and skating have no hold rule.
  assert.deepEqual(flagsOf(day('16:30', 'pole-dance')), [[3, 'hips-thoracic', 'warn', 4]]);
  assert.deepEqual(flagsOf(day('16:30', 'rehearsal')), [[3, 'hips-thoracic', 'warn', 4]]);
  assert.deepEqual(textsOf(day('16:30', 'dance', 'shoulders-bridge')), []);
  assert.deepEqual(textsOf(day('16:30', 'climbing', 'shoulders-bridge')), []);
  assert.deepEqual(textsOf(day('16:30', 'skating')), []);
  // Without times it's a reminder.
  assert.deepEqual(flagsOf(plan({ 3: { classes: ['dance'], sessions: ['splits-snack'] } })), [[3, 'splits-snack', 'info', 4]]);
});

test('rule 4: Shoulder Recovery’s chest holds stay off the hour before tricks', () => {
  const day = (time) => plan({ 1: { classes: [cls('pole-tricks', '18:00')], sessions: [ses('shoulder-recovery', time)] } });
  assert.deepEqual(textsOf(day('17:00')), ['warn 4: Ends 40 minutes before pole tricks. Keep long shoulder, lat and chest holds off the hour or two before class.']);
  assert.deepEqual(textsOf(day('19:45')), []); // after class, as intended
  assert.deepEqual(textsOf(day('')), []); // untimed: assumed after class
});

test('rule 5: the day after tricks is gentle for the upper body', () => {
  assert.deepEqual(flagsOf(plan({ 1: { classes: ['pole-tricks'] }, 2: { sessions: ['shoulder-reset'] } })), [[2, 'shoulder-reset', 'info', 5]]);
  assert.deepEqual(flagsOf(plan({ 1: { classes: ['pole-tricks'] }, 2: { sessions: ['shoulder-recovery'] } })), []);
});

test('rule 7: late big sessions are maintenance only', () => {
  assert.deepEqual(flagsOf(plan({ 0: { sessions: [ses('hips-thoracic', '21:30')] } })), [[0, 'hips-thoracic', 'info', 7]]);
  assert.deepEqual(flagsOf(plan({ 0: { sessions: [ses('hips-thoracic', '19:30'), ses('splits-snack', '22:00')] } })), []);
});

/* ── suggested week ── */

const suggested = (days, opts) => {
  const weeks = plan(days);
  const w = suggestWeek(ROUTINE, weeks, MONDAY, opts);
  weeks.weeks[ymd(MONDAY)] = w;
  return { w, weeks, byDay: w.days.map((d) => d.sessions.map((x) => x.id)), flags: check(weeks) };
};
const MINIMUMS = ROUTINE.guide.minimums.map((m) => m.session);

test('a suggested week meets the minimums with no warnings', () => {
  const weeks = [
    { 1: { classes: [cls('pole-tricks', '20:50', { hours: 1.25 })] }, 3: { classes: [cls('dance', '18:00', { hours: 4 })] } },
    ...ROUTINE.guide.examples.map((ex) => Object.fromEntries(ex.days.map((d) => [d.day, { classes: d.classes }]))),
    {},
  ];
  for (const days of weeks) {
    const { byDay, flags } = suggested(days);
    for (const id of MINIMUMS) assert.ok(byDay.some((d) => d.includes(id)), `${id} in ${JSON.stringify(byDay)}`);
    assert.deepEqual(flags.filter((f) => f.level === 'warn'), [], JSON.stringify(byDay));
  }
});

test('the suggestion keeps classes and follows the plan’s placement', () => {
  const { w, byDay } = suggested({ 1: { classes: ['pole-tricks'] }, 3: { classes: ['dance'] } });
  assert.deepEqual(w.days[1].classes.map((c) => c.id), ['pole-tricks']);
  assert.ok(byDay[1].includes('shoulder-recovery'), 'Shoulder Recovery after tricks');
  assert.deepEqual(byDay[3], ['class-prep'], 'class-day prep on an otherwise empty class day');
  const sb = byDay.findIndex((d) => d.includes('shoulders-bridge'));
  assert.ok(![0, 1, 2].includes(sb), `Shoulders & Bridge on day ${sb}`);
  // Separate exposures: never two splits or two shoulder sessions on a day.
  for (const d of byDay) {
    assert.ok(d.filter((x) => ['splits-intensive', 'hips-thoracic', 'splits-snack'].includes(x)).length <= 1, JSON.stringify(d));
    assert.ok(d.filter((x) => ['shoulders-bridge', 'shoulder-recovery', 'shoulder-reset'].includes(x)).length <= 1, JSON.stringify(d));
  }
});

test('the suggestion skips a double tricks night', () => {
  const { byDay } = suggested({ 2: { classes: [cls('pole-tricks', '', { double: true })] } });
  assert.deepEqual(byDay[2], ['class-prep']);
  assert.ok(byDay[3].includes('shoulder-recovery'), 'Shoulder Recovery moves to the next day');
});

test('sessions you’ve done stay put and aren’t placed again', () => {
  const keep = [[{ id: 'splits-intensive', time: '19:00' }], [], [{ id: 'shoulder-reset', time: '' }]];
  const { w, byDay, flags } = suggested({ 1: { classes: ['pole-tricks'] } }, { keep });
  assert.deepEqual(w.days[0].sessions[0], { id: 'splits-intensive', time: '19:00' });
  assert.equal(byDay.flat().filter((x) => x === 'splits-intensive').length, 1);
  assert.equal(byDay.flat().filter((x) => x === 'shoulder-reset').length, 1);
  assert.ok(byDay[2].includes('shoulder-reset'));
  for (const id of MINIMUMS) assert.ok(byDay.some((d) => d.includes(id)), id);
  assert.deepEqual(flags.filter((f) => f.level === 'warn'), []);
});

test('nothing new goes on days that have passed', () => {
  // Thursday, with tricks on Tuesday already gone: everything left fits in
  // Thursday to Sunday, and Recovery is placed like a short session.
  const { byDay } = suggested({ 1: { classes: ['pole-tricks'] }, 3: { classes: ['dance'] } }, { from: 3 });
  assert.deepEqual(byDay.slice(0, 3), [[], [], []]);
  for (const id of MINIMUMS) assert.ok(byDay.some((d) => d.includes(id)), `${id} in ${JSON.stringify(byDay)}`);
  // Sunday only: two sessions, not a pile-up. The rest go unplanned.
  const sunday = suggested({}, { from: 6 }).byDay;
  assert.deepEqual(sunday.slice(0, 6), [[], [], [], [], [], []]);
  assert.equal(sunday[6].length, 2, JSON.stringify(sunday[6]));
});

test('rules look across the week boundary', () => {
  const weeks = plan({ 6: { sessions: ['shoulders-bridge'] } });
  weeks.weeks['2026-10-26'] = normalizeWeek({ days: [{ classes: ['pole-tricks'] }] }, IDS);
  assert.deepEqual(flagsOf(weeks), [[6, 'shoulders-bridge', 'warn', 1]]);
});

test('minimums count the days each session is planned', () => {
  for (const ex of ROUTINE.guide.examples) {
    const { minimums } = checkWeek(ROUTINE, weeksWith(weekFromExample(ex)), MONDAY);
    assert.ok(minimums.every((m) => m.planned >= m.count), `${ex.title}: ${JSON.stringify(minimums)}`);
  }
  assert.ok(checkWeek(ROUTINE, { version: 1, weeks: {} }, MONDAY).minimums.every((m) => m.planned === 0));
});

/* ── timer, movements, log ── */

/* ── guided player ── */

test('the player counts in, then splits per-side blocks with a switch between', () => {
  const steps = (item) => playPhases(item).map((p) => [p.kind, p.label, p.seconds, !!p.wait]);
  assert.deepEqual(steps({ name: 'Psoas lunge', duration: '4 min', detail: 'pelvis tucked, torso upright, 2 min per side.' }), [
    ['ready', 'Get ready', READY_SECONDS, false], ['work', 'First side', 120, false],
    ['switch', 'Switch sides', SWITCH_SECONDS, true], ['work', 'Second side', 120, false],
  ]);
  assert.deepEqual(steps({ name: '90/90', duration: '2 min', detail: '1 min each direction.' }).map((s) => s[1]),
    ['Get ready', 'One direction', 'Change direction', 'Other direction']);
  // 60 s per leg inside a 4-minute block doesn't add up, so it stays whole.
  assert.deepEqual(steps({ name: 'Standing splits', duration: '4 min', detail: 'hips square, 60 s per leg.' }),
    [['ready', 'Get ready', READY_SECONDS, false], ['work', '', 240, false]]);
  assert.deepEqual(steps({ name: 'Butterfly', duration: '2 min' }), [['ready', 'Get ready', READY_SECONDS, false], ['work', '', 120, false]]);
});

test('contract-relax runs press and relax rounds on each side', () => {
  const cr = ROUTINE.sessions.find((s) => s.id === 'splits-intensive').sections.flatMap((x) => x.items).find((i) => i.name === 'Contract-relax hip flexor');
  assert.deepEqual(pressCycle(cr), { press: 10, relax: 20, verb: 'Relax and sink deeper' });
  const p = playPhases(cr);
  assert.deepEqual(p.map((x) => x.kind).join(' '), 'ready press relax press relax press relax press relax switch press relax press relax press relax press relax');
  assert.equal(p[1].label, 'First side · Press · 1 of 4');
  assert.equal(p[2].label, 'First side · Relax and sink deeper · 1 of 4');
  assert.equal(p.filter((x) => x.kind === 'press' || x.kind === 'relax').reduce((n, x) => n + x.seconds, 0), 240);
  // PNF hamstring folds rather than sinks; the 18-minute version's is 1 min a side.
  const pnf = { name: 'PNF hamstring', duration: '4 min', detail: 'press at about 30 to 50% effort for 5 to 10 s, fold deeper for 20 s, 2 min per side.' };
  assert.equal(pressCycle(pnf).verb, 'Relax and fold deeper');
  const short = { name: 'Contract-relax hip flexor', duration: '2 min', detail: 'press the back shin down 5 to 10 s, relax deeper for 20 s, 1 min per side.' };
  assert.equal(playPhases(short).filter((x) => x.kind === 'press').length, 4);
  assert.equal(pressCycle({ name: 'Couch stretch', duration: '4 min', detail: '2 min per side.' }), null);
});

test('every movement in every session gets player steps', () => {
  for (const s of ROUTINE.sessions) {
    for (const variant of ['full', ...(s.versions || []).map((v) => v.id)]) {
      for (const { item } of checklist(s, variant)) {
        const p = playPhases(item);
        assert.ok(p.length >= 2 && p.every((x) => x.seconds > 0), `${s.id}: ${item.name}`);
      }
    }
  }
});

test('the player moves on to the next movement not yet ticked', () => {
  const items = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
  assert.equal(nextToDo(items, new Set(), -1), 0);
  assert.equal(nextToDo(items, new Set(['b', 'c']), 0), 3);
  assert.equal(nextToDo(items, new Set(['d']), 2), -1);
});

test('a resume point saved before switch and press steps lands on the same spot', () => {
  const cr = ROUTINE.sessions.find((s) => s.id === 'splits-intensive').sections.flatMap((x) => x.items).find((i) => i.name === 'Contract-relax hip flexor');
  const p = playPhases(cr);
  // Old layout: 0 ready, 1 first side, 2 second side; 83 s left of 120 is
  // 37 s in, which is the second press with 3 s to go.
  assert.deepEqual(resumeStep(p, { phase: 1, left: 83 }), { phase: 3, left: 3 });
  assert.deepEqual(resumeStep(p, { phase: 1, left: 120 }), { phase: 1, left: 10 });
  // Second side starts after the switch, without waiting at it.
  assert.deepEqual(resumeStep(p, { phase: 2, left: 120 }), { phase: 10, left: 10 });
  assert.deepEqual(resumeStep(p, { phase: 0, left: 4 }), { phase: 0, left: READY_SECONDS });
  const lunge = playPhases({ name: 'Psoas lunge', duration: '4 min', detail: '2 min per side.' });
  assert.deepEqual(resumeStep(lunge, { phase: 2, left: 50 }), { phase: 3, left: 50 });
  assert.deepEqual(resumeStep(lunge, { phase: 1, left: 50 }), { phase: 1, left: 50 });
  // New layout reads the phase as is; a switch waits again from its start.
  assert.deepEqual(resumeStep(p, { phase: 4, left: 7, layout: RESUME_LAYOUT }), { phase: 4, left: 7 });
  assert.deepEqual(resumeStep(lunge, { phase: 2, left: 1, layout: RESUME_LAYOUT }), { phase: 2, left: SWITCH_SECONDS });
  // The log keeps the layout mark.
  const log = normalizeLog({ entries: { '2026-10-27|hips-thoracic': { date: '2026-10-27', resume: { index: 1, phase: 4, left: 7, layout: RESUME_LAYOUT } } } });
  assert.equal(log.entries['2026-10-27|hips-thoracic'].resume.layout, RESUME_LAYOUT);
});

test('the log keeps a valid resume point and drops a broken one', () => {
  const log = normalizeLog({ entries: {
    '2026-10-27|hips-thoracic': { date: '2026-10-27', resume: { index: 4, phase: 1, left: 83 } },
    '2026-10-28|splits-snack': { date: '2026-10-28', resume: { index: -1, phase: 'x' } },
  } });
  assert.deepEqual(log.entries['2026-10-27|hips-thoracic'].resume, { index: 4, phase: 1, left: 83 });
  assert.ok(!isEmptyEntry(log.entries['2026-10-27|hips-thoracic']), 'a resume point counts as started');
  assert.equal(log.entries['2026-10-28|splits-snack'].resume, undefined);
});

test('durations read minutes, seconds and ranges', () => {
  assert.equal(parseDuration('4 min'), 240);
  assert.equal(parseDuration('90 s'), 90);
  assert.equal(parseDuration('3.5 min'), 210);
  assert.equal(parseDuration('5 to 10 min'), 300);
  assert.equal(parseDuration('slowly'), null);
});

test('timer offers a per-side or single hold before the whole block', () => {
  assert.deepEqual(timerOptions({ name: 'Psoas lunge', duration: '4 min', detail: 'pelvis tucked, torso upright, 2 min per side.' }),
    [{ label: '2 min/side', seconds: 120 }, { label: '4 min', seconds: 240 }]);
  assert.deepEqual(timerOptions({ name: 'Camel at pole', duration: '2 min', detail: '1 x 90 s hold.' }),
    [{ label: '90 s hold', seconds: 90 }, { label: '2 min', seconds: 120 }]);
  assert.deepEqual(timerOptions({ name: 'Bridge', duration: '6 min', detail: '3 reps x 45 s at about 80 to 90% of your best depth.' }),
    [{ label: '45 s hold', seconds: 45 }, { label: '6 min', seconds: 360 }]);
  assert.deepEqual(timerOptions({ name: 'Butterfly', duration: '2 min' }), [{ label: '2 min', seconds: 120 }]);
});

test('movement names match across spellings', () => {
  assert.equal(moveKey('Sphinx to cobra pulses'), moveKey('Sphinx → cobra pulses'));
  assert.equal(moveKey('Couch stretch, extended'), 'couch stretch');
  assert.equal(moveKey('Round 2, active'), 'shoulder hyperflexion on bench');
  assert.equal(moveKey('Full bridge, depth focus'), 'full bridge');
});

test('the reference lists each place a movement is used', () => {
  const index = movementIndex(ROUTINE);
  const couch = index.find((m) => m.key === 'couch stretch');
  assert.equal(couch.name, 'Couch stretch');
  assert.deepEqual(couch.sessions, ['Splits Intensive', 'Hips & Thoracic', 'Splits Snack']);
  assert.ok(couch.uses.some((u) => u.session === 'Splits Intensive' && u.version === '18-minute version'));
  assert.equal(new Set(index.map((m) => m.key)).size, index.length);
});

test('a combined plan item counts as each of its movements', () => {
  const index = movementIndex(ROUTINE);
  for (const key of ['thread the needle', 'arm circles']) {
    const m = index.find((x) => x.key === key);
    assert.ok(m.uses.some((u) => u.name === 'Thread-the-needle and arm circles'), key);
  }
  assert.equal(index.find((x) => x.key === 'arm circles').name, 'Arm circles');
  assert.equal(index.find((x) => x.key === 'foam roller arch backs').name, 'Foam roller arch-backs');
  assert.equal(moveKey('Thoracic roll and arch-backs'), 'foam roller arch backs');
});

test('every movement has one form description, and every description a movement', () => {
  const keys = movementIndex(ROUTINE).map((m) => m.key);
  for (const key of keys) {
    const f = FORM[key];
    assert.ok(f, `no form notes for ${key}`);
    assert.ok(Array.isArray(f.steps) && f.steps.length, key);
    for (const k of Object.keys(f)) assert.ok(['guess', 'note', 'fromPlan', 'intro', 'setup', 'steps', 'cues', 'avoid'].includes(k), `${key}.${k}`);
  }
  for (const key of Object.keys(FORM)) assert.ok(keys.includes(key), `form notes for unknown movement ${key}`);
});

test('log normalizer keeps good entries and drops junk', () => {
  const log = normalizeLog({
    entries: {
      '2026-10-20|hips-thoracic': { date: '2026-10-20', title: 'Hips & Thoracic', checked: ['Warm-up / Cardio', 'Warm-up / Cardio', 3], notes: 'tight', done: true, updated: 5 },
      '2026-10-21|shoulders-bridge': { variant: 'bridge' },
      '2026-10-22|splits-snack': { checked: 'nope', variant: 'Weird Thing!' },
      'garbage': { date: 'yesterday' },
      '2026-10-23|x': null,
    },
  });
  assert.deepEqual(Object.keys(log.entries), ['2026-10-20|hips-thoracic', '2026-10-21|shoulders-bridge', '2026-10-22|splits-snack']);
  assert.deepEqual(log.entries['2026-10-20|hips-thoracic'].checked, ['Warm-up / Cardio']);
  assert.equal(log.entries['2026-10-21|shoulders-bridge'].variant, 'bridge');
  assert.deepEqual(log.entries['2026-10-22|splits-snack'], { date: '2026-10-22', title: '', variant: 'full', checked: [], notes: '', done: false, updated: 0 });
  assert.deepEqual(normalizeLog(null), { version: 1, entries: {} });
  assert.ok(isEmptyEntry(log.entries['2026-10-22|splits-snack']));
});

/* ── export ── */

test('export writes the week’s planned sessions, timed or all-day', () => {
  const week = weekFromExample(WEEK_A);
  week.days[5].sessions[0].time = '12:30';
  const ics = toIcs(ROUTINE, weeksWith(week), MONDAY, new Date(2026, 9, 26), new Date(2026, 9, 23, 12));
  const flat = unfold(ics);
  assert.equal((flat.match(/^BEGIN:VEVENT$/gm) || []).length, 7);
  assert.match(flat, /^DTSTART:20261024T123000$/m);
  assert.match(flat, /^DTEND:20261024T140000$/m); // ~90 min
  assert.match(flat, /^DTSTART;VALUE=DATE:20261019$/m);
  assert.match(flat, /^UID:2026-10-24-splits-intensive@flex-training$/m);
  assert.match(flat, /^SUMMARY:Shoulders & Bridge$/m);
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
});

test('export lines are folded at 75 bytes without splitting characters', () => {
  const ics = toIcs(ROUTINE, weeksWith(weekFromExample(WEEK_B)), MONDAY, new Date(2026, 9, 26));
  const enc = new TextEncoder();
  for (const line of ics.split('\r\n')) assert.ok(enc.encode(line).length <= 75, line);
  const long = '⏱'.repeat(40);
  assert.equal(foldLine(long).replace(/\r\n /g, ''), long);
});

test('export text escapes and keeps the session layout', () => {
  const s = ROUTINE.sessions.find((x) => x.id === 'shoulders-bridge');
  const text = describe(s);
  assert.match(text, /^⏱ ~67 min/);
  assert.match(text, /BRIDGE BLOCK — 12 min\. While your shoulders are fresh/);
  assert.match(text, /18-MINUTE VERSION \(NO BRIDGES\)/);
  assert.match(text, /8-MINUTE BRIDGE VERSION/);
  assert.match(text, /Deload week: /);
  // Drills kept only as cues make it into the export too.
  const hips = describe(ROUTINE.sessions.find((x) => x.id === 'hips-thoracic'));
  assert.match(hips, /HIP EXTENSION END-RANGE STRENGTH — 4 min\n• Kneeling lunge with the back knee down/);
  assert.match(hips, /• Front-split back-leg lifts at the pole, 2 x 8 per side/);
  const flat = unfold(toIcs(ROUTINE, weeksWith(weekFromExample(WEEK_A)), MONDAY, new Date(2026, 9, 26)));
  const desc = flat.split('\r\n').find((l) => l.startsWith('DESCRIPTION:⏱ ~90'));
  assert.ok(desc.includes('pelvis tucked\\, torso upright') && desc.includes('\\n') && !/[^\\],/.test(desc));
});

test('weeks start on Monday', () => {
  assert.equal(ymd(weekStart(new Date(2026, 9, 25, 23))), '2026-10-19');
  assert.equal(ymd(weekStart(new Date(2026, 9, 19))), '2026-10-19');
});
