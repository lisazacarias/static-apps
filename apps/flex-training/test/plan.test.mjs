import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeWeeks, normalizeWeek, emptyWeek, weekFromExample, copyWeek, isPlanned,
  occurrences, checkWeek, checklist, timerOptions, parseDuration, moveKey, movementIndex,
  normalizeLog, isEmptyEntry, describe, toIcs, foldLine, weekStart, ymd,
} from '../plan.js';
import ROUTINE from '../routine.js';

const IDS = ROUTINE.sessions.map((s) => s.id);
const MONDAY = new Date(2026, 9, 19);
const unfold = (ics) => ics.replace(/\r\n /g, '');
const weeksWith = (week, monday = MONDAY) => ({ version: 1, weeks: { [ymd(monday)]: normalizeWeek(week, IDS) } });
const plan = (days) => weeksWith({ days: Array.from({ length: 7 }, (_, i) => days[i] || {}) });
const flagsOf = (weeks) => checkWeek(ROUTINE, weeks, MONDAY).flags.map((f) => [f.day, f.session, f.level, f.rule]);

/* ── the plan data ── */

test('the routine has the seven sessions from the plan', () => {
  assert.deepEqual(IDS, ['splits-intensive', 'shoulder-hyperflexion', 'hips-backbend', 'shoulder-recovery', 'shoulder-reset', 'splits-snack', 'class-prep']);
  for (const s of ROUTINE.sessions) assert.ok(s.minutes > 0 && s.length, s.id);
});

test('every citation points at a reference', () => {
  const refs = new Set(ROUTINE.guide.references.map((r) => r.n));
  assert.equal(refs.size, 40);
  const cited = JSON.stringify(ROUTINE.sessions) + JSON.stringify({ ...ROUTINE.guide, references: [] });
  for (const [, n] of cited.matchAll(/\[(\d+)\]/g)) assert.ok(refs.has(+n), `[${n}]`);
});

test('every session has a checklist with unique ids and timeable items', () => {
  for (const s of ROUTINE.sessions) {
    for (const variant of ['full', 'short']) {
      const list = checklist(s, variant);
      assert.ok(list.length, `${s.id} ${variant}`);
      assert.equal(new Set(list.map((i) => i.id)).size, list.length, `${s.id} ${variant} ids`);
      for (const { item } of list) assert.ok(parseDuration(item.duration), `${s.id}: ${item.name} (${item.duration})`);
    }
  }
});

test('checklist ids: section / name, name alone, or the whole section', () => {
  const by = (id) => ROUTINE.sessions.find((s) => s.id === id);
  assert.ok(checklist(by('splits-intensive')).some((i) => i.id === 'Hip flexor block / Psoas lunge'));
  assert.ok(checklist(by('shoulder-hyperflexion')).some((i) => i.id === 'Lat stretch on roller'));
  assert.deepEqual(checklist(by('shoulder-reset')).map((i) => i.id), ['Foam roll lats', 'Shoulder CARs', 'Wall clocks']);
  assert.ok(checklist(by('splits-intensive'), 'short').every((i) => i.id.startsWith('Short / ')));
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
        { classes: ['pole', 'pole', 'yoga'], sessions: ['splits-snack', { id: 'shoulder-reset', time: '21:15' }, { id: 'nope' }, 'splits-snack'] },
        { classes: [{ id: 'rehearsal', time: '19:00', hours: 3 }, { id: 'dance', time: '7pm', hours: -1 }] },
      ] },
      'next week': { days: [] },
      '2026-10-26': null,
    },
  }, IDS);
  assert.deepEqual(Object.keys(w.weeks), ['2026-10-19']);
  const week = w.weeks['2026-10-19'];
  assert.equal(week.deload, true);
  assert.equal(week.days.length, 7);
  // A bare class id (how classes were first stored) reads as one with no time.
  assert.deepEqual(week.days[0], { classes: [{ id: 'pole', time: '', hours: 1.5 }], sessions: [{ id: 'splits-snack', time: '' }, { id: 'shoulder-reset', time: '21:15' }] });
  assert.deepEqual(week.days[1].classes, [{ id: 'rehearsal', time: '19:00', hours: 3 }, { id: 'dance', time: '', hours: 1.5 }]);
  assert.deepEqual(week.days[6], { classes: [], sessions: [] });
  assert.deepEqual(normalizeWeeks(null), { version: 1, weeks: {} });
  assert.ok(!isPlanned(emptyWeek()));
});

test('an example becomes a week, and copying a week drops deload', () => {
  const a = weekFromExample(ROUTINE.guide.examples[0]);
  assert.deepEqual(a.days[2], { classes: [{ id: 'pole', time: '', hours: 1.5 }], sessions: [{ id: 'shoulder-recovery', time: '' }] });
  assert.ok(isPlanned(a));
  const copy = copyWeek({ ...a, deload: true });
  assert.equal(copy.deload, false);
  assert.deepEqual(copy.days, a.days);
});

test('occurrences list planned sessions in day order, keyed by date', () => {
  const weeks = weeksWith(weekFromExample(ROUTINE.guide.examples[0]));
  const list = occurrences(ROUTINE, weeks, MONDAY, new Date(2026, 9, 26));
  assert.deepEqual(list.map((o) => o.key), [
    '2026-10-19|splits-snack', '2026-10-19|shoulder-reset', '2026-10-20|hips-backbend', '2026-10-21|shoulder-recovery',
    '2026-10-22|class-prep', '2026-10-24|splits-intensive', '2026-10-25|shoulder-hyperflexion',
  ]);
  assert.deepEqual(occurrences(ROUTINE, weeks, new Date(2026, 9, 24), new Date(2026, 9, 25)).map((o) => o.session.id), ['splits-intensive']);
  assert.equal(occurrences(ROUTINE, weeks, new Date(2026, 9, 26), new Date(2026, 10, 2)).length, 0);
});

/* ── rule checks ── */

test('example week A raises no warnings; week B’s Sunday rehearsal is too close to Saturday', () => {
  const warns = (n) => checkWeek(ROUTINE, weeksWith(weekFromExample(ROUTINE.guide.examples[n])), MONDAY).flags
    .filter((f) => f.level === 'warn').map((f) => [f.day, f.session, f.rule]);
  assert.deepEqual(warns(0), []);
  // Rehearsal counts as dance, so it's a hard class for rule 1.
  assert.deepEqual(warns(1), [[5, 'splits-intensive', 1]]);
});

test('example week A: pole tomorrow keeps backbend submaximal', () => {
  const flags = flagsOf(weeksWith(weekFromExample(ROUTINE.guide.examples[0])));
  assert.deepEqual(flags, [[1, 'hips-backbend', 'info', 3]]);
});

test('rule 2: shoulder hyperflexion on, before and after pole', () => {
  assert.deepEqual(flagsOf(plan({ 2: { classes: ['pole'], sessions: ['shoulder-hyperflexion'] } })), [[2, 'shoulder-hyperflexion', 'warn', 2]]);
  assert.deepEqual(flagsOf(plan({ 1: { sessions: ['shoulder-hyperflexion'] }, 2: { classes: ['pole-tricks'] } })), [[1, 'shoulder-hyperflexion', 'warn', 2]]);
  assert.deepEqual(flagsOf(plan({ 2: { classes: ['pole'] }, 3: { sessions: ['shoulder-hyperflexion'] } })), [[3, 'shoulder-hyperflexion', 'info', 2]]);
  assert.deepEqual(flagsOf(plan({ 2: { classes: ['dance'] }, 3: { sessions: ['shoulder-hyperflexion'] } })), []);
  // Pole dance counts as dance, not pole.
  assert.deepEqual(flagsOf(plan({ 2: { classes: ['pole-dance'], sessions: ['shoulder-hyperflexion'] } })), [[2, 'shoulder-hyperflexion', 'info', 5]]);
});

test('rule 1: splits intensive needs a free day and 48 hours before a hard class', () => {
  assert.deepEqual(flagsOf(plan({ 5: { classes: ['dance'], sessions: ['splits-intensive'] } })), [[5, 'splits-intensive', 'warn', 1]]);
  assert.deepEqual(flagsOf(plan({ 5: { sessions: ['splits-intensive'] }, 6: { classes: ['pole'] } })), [[5, 'splits-intensive', 'warn', 1]]);
  assert.deepEqual(flagsOf(plan({ 4: { sessions: ['splits-intensive'] }, 6: { classes: ['dance'] } })), [[4, 'splits-intensive', 'info', 1]]);
  assert.deepEqual(flagsOf(plan({ 5: { sessions: ['splits-intensive'] }, 6: { classes: ['rehearsal'] } })), [[5, 'splits-intensive', 'warn', 1]]);
  assert.deepEqual(flagsOf(plan({ 5: { sessions: ['splits-intensive'] }, 6: { classes: ['climbing'] } })), []);
});

test('rule 3: hips & backbend never on a pole day', () => {
  assert.deepEqual(flagsOf(plan({ 0: { classes: ['pole'], sessions: ['hips-backbend'] } })), [[0, 'hips-backbend', 'warn', 3]]);
  assert.deepEqual(flagsOf(plan({ 0: { classes: ['pole-dance'], sessions: ['hips-backbend'] } })), [[0, 'hips-backbend', 'info', 5]]);
  assert.deepEqual(flagsOf(plan({ 0: { classes: ['rehearsal'], sessions: ['hips-backbend'] } })), [[0, 'hips-backbend', 'info', 5]]);
});

test('rule 4: the same big session two days running', () => {
  assert.deepEqual(flagsOf(plan({ 2: { sessions: ['hips-backbend'] }, 3: { sessions: ['hips-backbend'] } })), [[2, 'hips-backbend', 'warn', 4]]);
  assert.deepEqual(flagsOf(plan({ 2: { sessions: ['splits-snack'] }, 3: { sessions: ['splits-snack'] } })), []);
});

const cls = (id, time, hours) => ({ id, time, ...(hours ? { hours } : {}) });
const ses = (id, time) => ({ id, time });
const textsOf = (weeks) => checkWeek(ROUTINE, weeks, MONDAY).flags.map((f) => `${f.level} ${f.rule}: ${f.text}`);

test('with times, rule 2 counts hours before pole', () => {
  // Monday 10:00–10:55, pole Tuesday 20:00: 33 hours.
  assert.deepEqual(textsOf(plan({ 0: { sessions: [ses('shoulder-hyperflexion', '10:00')] }, 1: { classes: [cls('pole', '20:00')] } })),
    ['warn 2: Only 33 hours before Tuesday’s pole. It needs at least 48.']);
  // Two days later is fine at noon, but not at 10:00 (47 hours) — whole days would miss this.
  assert.deepEqual(textsOf(plan({ 0: { sessions: [ses('shoulder-hyperflexion', '10:00')] }, 2: { classes: [cls('pole', '12:00')] } })), []);
  assert.deepEqual(textsOf(plan({ 0: { sessions: [ses('shoulder-hyperflexion', '10:00')] }, 2: { classes: [cls('pole', '10:00')] } })),
    ['warn 2: Only 47 hours before Wednesday’s pole. It needs at least 48.']);
  // Without times it falls back to whole days.
  assert.deepEqual(flagsOf(plan({ 0: { sessions: ['shoulder-hyperflexion'] }, 2: { classes: ['pole'] } })), []);
});

test('with times, rule 2 counts hours after pole', () => {
  // Pole Monday 20:00–21:30.
  assert.deepEqual(textsOf(plan({ 0: { classes: [cls('pole', '20:00')] }, 1: { sessions: [ses('shoulder-hyperflexion', '22:00')] } })), []);
  assert.deepEqual(textsOf(plan({ 0: { classes: [cls('pole', '20:00')] }, 1: { sessions: [ses('shoulder-hyperflexion', '18:00')] } })),
    ['warn 2: Only 21 hours after Monday’s pole. It needs at least 24.']);
});

test('with times, rule 1 counts hours to the next hard class', () => {
  // Saturday 09:00–10:30, rehearsal Sunday 19:00.
  assert.deepEqual(textsOf(plan({ 5: { sessions: [ses('splits-intensive', '09:00')] }, 6: { classes: [cls('rehearsal', '19:00')] } })),
    ['warn 1: Splits Intensive is 33 hours before Sunday’s rehearsal. Aim for 48, ideally 72.']);
});

test('with times, rule 5 wants big sessions done 3 hours before class', () => {
  const day = (time) => plan({ 3: { classes: [cls('rehearsal', time === 'after' ? '10:00' : '17:00')], sessions: [ses('hips-backbend', time === 'after' ? '14:00' : time)] } });
  assert.deepEqual(textsOf(day('14:00')), ['warn 5: Ends only 2 hours before rehearsal. Finish at least 3 to 4 hours before.']);
  assert.deepEqual(textsOf(day('12:00')), []);
  // Rehearsal 10:00–12:30, session at 14:00: rule 6, after class.
  assert.deepEqual(textsOf(day('after')), ['info 6: After class: stay at your usual depth and don’t chase new depth when tired.']);
});

test('rules look across the week boundary', () => {
  const weeks = plan({ 6: { sessions: ['shoulder-hyperflexion'] } });
  weeks.weeks['2026-10-26'] = normalizeWeek({ days: [{ classes: ['pole'] }] }, IDS);
  assert.deepEqual(flagsOf(weeks), [[6, 'shoulder-hyperflexion', 'warn', 2]]);
});

test('minimums count the days each session is planned', () => {
  const { minimums } = checkWeek(ROUTINE, weeksWith(weekFromExample(ROUTINE.guide.examples[1])), MONDAY);
  assert.ok(minimums.every((m) => m.planned >= m.count), JSON.stringify(minimums));
  const empty = checkWeek(ROUTINE, { version: 1, weeks: {} }, MONDAY).minimums;
  assert.ok(empty.every((m) => m.planned === 0));
});

/* ── timer, movements, log ── */

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
  assert.deepEqual(timerOptions({ name: 'Camel at pole', duration: '4 min', detail: '2 x 90 s holds.' }),
    [{ label: '90 s hold', seconds: 90 }, { label: '4 min', seconds: 240 }]);
  assert.deepEqual(timerOptions({ name: 'Bridge', duration: '8 min', detail: '3 reps x 45 s.' }),
    [{ label: '45 s hold', seconds: 45 }, { label: '8 min', seconds: 480 }]);
  assert.deepEqual(timerOptions({ name: 'Butterfly', duration: '2 min' }), [{ label: '2 min', seconds: 120 }]);
});

test('movement names match across spellings', () => {
  assert.equal(moveKey('Sphinx to cobra pulses'), moveKey('Sphinx → cobra pulses'));
  assert.equal(moveKey('Couch stretch, extended'), 'couch stretch');
  assert.equal(moveKey('Round 2, active'), 'shoulder hyperflexion on bench');
});

test('the reference gathers a movement from every session it is in', () => {
  const index = movementIndex(ROUTINE);
  const couch = index.find((m) => m.key === 'couch stretch');
  assert.equal(couch.name, 'Couch stretch');
  assert.deepEqual(couch.sessions, ['Splits Intensive', 'Hips & Backbend', 'Splits Snack']);
  const camel = index.find((m) => m.key === 'camel at pole');
  assert.ok(camel.writeups.some((w) => !w.current && w.cues.length > 10), 'earlier long-form cues are kept');
  assert.equal(new Set(index.map((m) => m.key)).size, index.length);
});

test('earlier write-ups whose loading changed are left out', () => {
  const index = movementIndex(ROUTINE);
  for (const key of ['shoulder hyperflexion on bench', 'full bridge']) {
    const m = index.find((x) => x.key === key);
    assert.ok(m.writeups.every((w) => w.current), key);
  }
  const keys = new Set(index.map((m) => m.key));
  for (const key of Object.keys(ROUTINE.library)) assert.ok(keys.has(key), key);
});

test('log normalizer keeps good entries and drops junk', () => {
  const log = normalizeLog({
    entries: {
      '2026-10-20|hips-backbend': { date: '2026-10-20', title: 'Hips & Backbend', checked: ['Warm-up / Cardio', 'Warm-up / Cardio', 3], notes: 'tight', done: true, updated: 5 },
      '2026-10-21|splits-snack': { checked: 'nope', variant: 'weird' },
      'garbage': { date: 'yesterday' },
      '2026-10-22|x': null,
    },
  });
  assert.deepEqual(Object.keys(log.entries), ['2026-10-20|hips-backbend', '2026-10-21|splits-snack']);
  assert.deepEqual(log.entries['2026-10-20|hips-backbend'].checked, ['Warm-up / Cardio']);
  assert.deepEqual(log.entries['2026-10-21|splits-snack'], { date: '2026-10-21', title: '', variant: 'full', checked: [], notes: '', done: false, updated: 0 });
  assert.deepEqual(normalizeLog(null), { version: 1, entries: {} });
  assert.ok(isEmptyEntry(log.entries['2026-10-21|splits-snack']));
});

/* ── export ── */

test('export writes the week’s planned sessions, timed or all-day', () => {
  const week = weekFromExample(ROUTINE.guide.examples[0]);
  week.days[5].sessions[0].time = '12:30';
  const ics = toIcs(ROUTINE, weeksWith(week), MONDAY, new Date(2026, 9, 26), new Date(2026, 9, 23, 12));
  const flat = unfold(ics);
  assert.equal((flat.match(/^BEGIN:VEVENT$/gm) || []).length, 7);
  assert.match(flat, /^DTSTART:20261024T123000$/m);
  assert.match(flat, /^DTEND:20261024T140000$/m); // ~90 min
  assert.match(flat, /^DTSTART;VALUE=DATE:20261019$/m);
  assert.match(flat, /^UID:2026-10-24-splits-intensive@flex-training$/m);
  assert.match(flat, /^SUMMARY:Hips & Backbend$/m);
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
});

test('export lines are folded at 75 bytes without splitting characters', () => {
  const ics = toIcs(ROUTINE, weeksWith(weekFromExample(ROUTINE.guide.examples[1])), MONDAY, new Date(2026, 9, 26));
  const enc = new TextEncoder();
  for (const line of ics.split('\r\n')) assert.ok(enc.encode(line).length <= 75, line);
  const long = '⏱'.repeat(40);
  assert.equal(foldLine(long).replace(/\r\n /g, ''), long);
});

test('export text escapes and keeps the session layout', () => {
  const s = ROUTINE.sessions.find((x) => x.id === 'splits-intensive');
  const text = describe(s);
  assert.match(text, /^⏱ ~90 min/);
  assert.match(text, /HIP FLEXOR BLOCK — 20 min\. Priority/);
  assert.match(text, /• Psoas lunge, 4 min: pelvis tucked, torso upright, 2 min per side/);
  assert.match(text, /18-MINUTE VERSION/);
  assert.match(text, /Deload week: /);
  const flat = unfold(toIcs(ROUTINE, weeksWith(weekFromExample(ROUTINE.guide.examples[0])), MONDAY, new Date(2026, 9, 26)));
  const desc = flat.split('\r\n').find((l) => l.startsWith('DESCRIPTION:⏱ ~90'));
  assert.ok(desc.includes('pelvis tucked\\, torso upright') && desc.includes('\\n') && !/[^\\],/.test(desc));
});

test('weeks start on Monday', () => {
  assert.equal(ymd(weekStart(new Date(2026, 9, 25, 23))), '2026-10-19');
  assert.equal(ymd(weekStart(new Date(2026, 9, 19))), '2026-10-19');
});
