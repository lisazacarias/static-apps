import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  occurrences, checklist, timerOptions, parseDuration, moveKey, movementIndex,
  normalizeLog, isEmptyEntry, describe, toIcs, foldLine, weekStart, ymd,
} from '../plan.js';
import ROUTINE from '../routine.js';

const unfold = (ics) => ics.replace(/\r\n /g, '');

test('a week has each session on its own day, Monday first', () => {
  const monday = new Date(2026, 9, 19);
  const week = occurrences(ROUTINE, monday, new Date(2026, 9, 26));
  assert.deepEqual(week.map((o) => [o.start.getDay(), o.session.id]), [
    [1, 'shoulder-maintenance'], [2, 'backbend-intensive'], [3, 'splits-shoulder'],
    [5, 'shoulder-hyperflexion'], [6, 'splits-intensive'], [0, 'splits-maintenance'],
  ]);
  assert.equal(week[0].key, '2026-10-19|shoulder-maintenance');
  assert.equal(week.at(-1).start.getHours(), 22);
  assert.ok(week.every((o) => o.end > o.start));
});

test('occurrences respect the range, mid-week included', () => {
  const fri = occurrences(ROUTINE, new Date(2026, 9, 23), new Date(2026, 9, 24));
  assert.deepEqual(fri.map((o) => o.session.id), ['shoulder-hyperflexion']);
  assert.equal(occurrences(ROUTINE, new Date(2026, 9, 22), new Date(2026, 9, 23)).length, 0); // Thursday
  assert.equal(occurrences(ROUTINE, new Date(2026, 9, 1), new Date(2026, 10, 1)).length, 26); // 5 Fridays and Saturdays, 4 of the rest
});

test('weeks start on Monday', () => {
  assert.equal(ymd(weekStart(new Date(2026, 9, 25, 23))), '2026-10-19'); // Sunday night
  assert.equal(ymd(weekStart(new Date(2026, 9, 19))), '2026-10-19');
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

test('the short version is ticked off separately from the full one', () => {
  const s = ROUTINE.sessions.find((x) => x.id === 'splits-intensive');
  assert.ok(checklist(s, 'short').every((i) => i.id.startsWith('Short / ')));
  assert.ok(checklist(s, 'full').some((i) => i.id === 'Hip flexor intensive / Psoas lunge'));
});

test('a section with no named movements is one item', () => {
  const s = ROUTINE.sessions.find((x) => x.id === 'shoulder-maintenance');
  assert.deepEqual(checklist(s).map((i) => i.id), ['Foam roll lats', 'Shoulder CARs', 'Wall clocks']);
});

test('durations read minutes, seconds and ranges', () => {
  assert.equal(parseDuration('4 min'), 240);
  assert.equal(parseDuration('90s'), 90);
  assert.equal(parseDuration('30s/side'), 30);
  assert.equal(parseDuration('2.5 min'), 150);
  assert.equal(parseDuration('3-4 min'), 180);
  assert.equal(parseDuration('slowly'), null);
});

test('timer offers the per-side hold before the whole block', () => {
  assert.deepEqual(timerOptions({ name: 'Psoas lunge', duration: '4 min', detail: 'pelvis tucked, 2 min/side' }),
    [{ label: '2 min/side', seconds: 120 }, { label: '4 min', seconds: 240 }]);
  assert.deepEqual(timerOptions({ name: 'Twists', duration: '60 sec', cues: ['30 sec each side'] }),
    [{ label: '30 sec/side', seconds: 30 }, { label: '60 sec', seconds: 60 }]);
  assert.deepEqual(timerOptions({ name: 'Butterfly', duration: '2 min' }), [{ label: '2 min', seconds: 120 }]);
});

test('movement names match across spellings', () => {
  assert.equal(moveKey('Sphinx → cobra pulses'), moveKey('SPHINX TO COBRA PULSES'));
  assert.equal(moveKey('Couch stretch, extended'), 'couch stretch');
  assert.equal(moveKey("Child's pose"), 'childs pose');
});

test('the reference gathers a movement from every session it is in', () => {
  const index = movementIndex(ROUTINE);
  const couch = index.find((m) => m.key === 'couch stretch');
  assert.equal(couch.name, 'Couch stretch');
  assert.ok(couch.sessions.includes('Splits Intensive') && couch.sessions.includes('Splits Maintenance'));
  const camel = index.find((m) => m.key === 'camel at pole');
  assert.ok(camel.writeups.some((w) => !w.current && w.cues.length > 10), 'older long-form cues are kept');
  assert.equal(new Set(index.map((m) => m.key)).size, index.length);
});

test('every library entry belongs to a movement in the routine', () => {
  const keys = new Set(movementIndex(ROUTINE).map((m) => m.key));
  for (const key of Object.keys(ROUTINE.library)) assert.ok(keys.has(key), key);
});

test('log normalizer keeps good entries and drops junk', () => {
  const log = normalizeLog({
    entries: {
      '2026-10-20|backbend-intensive': { date: '2026-10-20', title: 'Backbend Intensive', checked: ['Warm-up / Cardio', 'Warm-up / Cardio', 3], notes: 'tight', done: true, updated: 5 },
      '2026-10-21|splits-shoulder': { checked: 'nope', variant: 'weird' },
      'garbage': { date: 'yesterday' },
      '2026-10-22|x': null,
    },
  });
  assert.deepEqual(Object.keys(log.entries), ['2026-10-20|backbend-intensive', '2026-10-21|splits-shoulder']);
  assert.deepEqual(log.entries['2026-10-20|backbend-intensive'].checked, ['Warm-up / Cardio']);
  assert.deepEqual(log.entries['2026-10-21|splits-shoulder'], { date: '2026-10-21', title: '', variant: 'full', checked: [], notes: '', done: false, updated: 0 });
  assert.deepEqual(normalizeLog(null), { version: 1, entries: {} });
  assert.deepEqual(normalizeLog('[]'), { version: 1, entries: {} });
  assert.ok(isEmptyEntry(log.entries['2026-10-21|splits-shoulder']));
});

test('export writes one weekly event per session', () => {
  const ics = toIcs(ROUTINE, new Date(2026, 9, 23, 12));
  const flat = unfold(ics);
  assert.equal((flat.match(/^BEGIN:VEVENT$/gm) || []).length, ROUTINE.sessions.length);
  assert.match(flat, /^DTSTART:20261019T211500$/m);
  assert.match(flat, /^DTSTART:20261025T220000$/m);
  assert.match(flat, /^RRULE:FREQ=WEEKLY;BYDAY=SA$/m);
  assert.match(flat, /^UID:splits-intensive@flex-training$/m);
  assert.match(flat, /^SUMMARY:Splits & Shoulder Maintenance$/m);
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
});

test('export lines are folded at 75 bytes without splitting characters', () => {
  const ics = toIcs(ROUTINE, new Date(2026, 9, 23));
  const enc = new TextEncoder();
  for (const line of ics.split('\r\n')) assert.ok(enc.encode(line).length <= 75, line);
  assert.ok(!ics.includes('�'));
  const long = '1️⃣'.repeat(40);
  assert.equal(foldLine(long).replace(/\r\n /g, ''), long);
});

test('export escapes text and keeps the session layout', () => {
  const s = ROUTINE.sessions.find((x) => x.id === 'splits-intensive');
  const text = describe(s);
  assert.match(text, /^⏱ 103 MIN TOTAL/);
  assert.match(text, /⏩ SHORT ON TIME\? ~18-MIN VERSION/);
  assert.match(text, /4️⃣ HIP FLEXOR INTENSIVE — 22 min ⚡ PRIORITY/);
  assert.match(text, /• Psoas lunge \(4 min\): pelvis tucked, torso upright, 2 min\/side/);
  assert.match(text, /📌 EVERY 4TH WEEK/);
  const flat = unfold(toIcs(ROUTINE));
  const desc = flat.split('\r\n').find((l) => l.startsWith('DESCRIPTION:⏱ 103'));
  assert.ok(desc.includes('pelvis tucked\\, torso upright') && desc.includes('\\n') && !/[^\\],/.test(desc));
});
