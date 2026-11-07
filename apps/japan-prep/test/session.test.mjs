import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeState, normalizeSettings, nextCard, rate, summary, choices, gradeFor, streak, mergeStates, exportBlob, looksLikeExport,
  cardId, splitCardId, sweepOn, daysLeft, dayIndex, addDrill, DRILL_KEEP, SLOW_MS,
} from '../session.js';
import { ITEM, DECKS } from '../content.js';
import { AGAIN, GOOD, EASY, DAY } from '../srs.js';

const day = (y, m, d, h = 9) => new Date(y, m - 1, d, h).getTime();
const START = day(2026, 11, 9);
const fresh = (settings = {}) => normalizeState({ settings: { startDate: '2026-11-09', tripDate: '2027-01-10', ...settings } }, START);
const rng = (seed = 5) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// Answer everything the queue gives, Good, until it's empty or n cards.
function studyAll(state, now, n = 1000, rating = GOOD) {
  let t = now;
  for (let i = 0; i < n; i++) {
    const id = nextCard(state, t);
    if (!id) break;
    state = rate(state, id, rating, { now: t });
    t += 1000;
  }
  return state;
}

test('settings fall back to defaults for anything missing or out of range', () => {
  const s = normalizeSettings({ tripDate: 'soon', retention: { core: 2 }, newPerDay: { hira: -3, phrase: 9 } }, START);
  assert.equal(s.tripDate, '2027-01-10');
  assert.equal(s.startDate, '2026-11-09');
  assert.equal(s.retention.core, 0.92);
  assert.equal(s.retention.rest, 0.9);
  assert.equal(s.newPerDay.hira, DECKS.hira.newPerDay);
  assert.equal(s.newPerDay.phrase, 9);
});

test('a damaged state loads as an empty one, keeping what still makes sense', () => {
  assert.deepEqual(normalizeState(null, START).cards, {});
  const s = normalizeState({ cards: { 'hira:あ|recognize': { state: 'review', s: 3, d: 5, due: 1, last: 1 }, bad: { state: 'nope' } }, logs: [{ c: 'x', r: 9, t: 1 }, { c: 'x', r: 3, t: 1 }], drills: 'no' }, START);
  assert.deepEqual(Object.keys(s.cards), ['hira:あ|recognize']);
  assert.equal(s.logs.length, 1);
  assert.deepEqual(s.drills, []);
});

test('day one: hiragana first, capped at 15 new kana, plus the week-1 starred phrases', () => {
  const s = studyAll(fresh(), START);
  const items = new Set(Object.keys(s.cards).map((id) => splitCardId(id).itemId));
  const hira = [...items].filter((i) => ITEM[i].deck === 'hira');
  assert.equal(hira.length, 15);
  assert.ok(hira.includes('hira:あ') && hira.includes('hira:こ'), 'a/ka group first');
  assert.ok(![...items].some((i) => ITEM[i].deck === 'kata'), 'no katakana before day 6');
  assert.ok(![...items].some((i) => ITEM[i].deck === 'sign'), 'no signs in week 1');
  const phrases = [...items].filter((i) => ITEM[i].deck === 'phrase');
  assert.equal(phrases.length, 6);
  assert.ok(phrases.every((i) => ITEM[i].star));
  // Both directions of each kana were shown.
  assert.ok(s.cards['hira:あ|listen'] && s.cards['hira:あ|recognize']);
});

test('the next day brings reviews back first, kana before phrases', () => {
  let s = studyAll(fresh(), START);
  const t = START + 4 * DAY; // first graduated interval is about 4 days
  const first = nextCard(s, t);
  assert.equal(ITEM[splitCardId(first).itemId].deck, 'hira');
  assert.equal(s.cards[first].state, 'review');
  s = studyAll(s, t);
  assert.equal(nextCard(s, t + 30 * 60000), null, 'day is done');
});

test('katakana unlocks on day 6, signs in week 4, or everything with unlockAll', () => {
  const s = fresh();
  const kata = (st, t) => [...new Set(Object.keys(studyAll(st, t).cards))].some((id) => id.startsWith('kata:'));
  assert.ok(!kata(s, START + 4 * DAY));
  assert.ok(kata(s, START + 5 * DAY));
  assert.ok(kata(fresh({ unlockAll: true }), START));
  assert.equal(dayIndex(s.settings, START + 21 * DAY), 21);
});

test('learning cards come back within the sitting', () => {
  let s = fresh();
  const id = nextCard(s, START);
  s = rate(s, id, AGAIN, { now: START });
  assert.equal(nextCard(s, START + 61000), id);
});

test('sweep mode: on at 5 days left, no new cards, shaky cards weakest first, each once', () => {
  let s = studyAll(fresh(), START);
  const late = day(2027, 1, 5);
  assert.equal(daysLeft(s.settings, late), 5);
  assert.ok(sweepOn(s.settings, late));
  assert.ok(!sweepOn(s.settings, day(2027, 1, 4)));
  const seen = new Set();
  const order = [];
  for (let id; (id = nextCard(s, late, seen));) {
    assert.ok(s.cards[id], 'never a new card');
    order.push(id); seen.add(id);
    s = rate(s, id, GOOD, { now: late });
  }
  assert.ok(order.length > 0);
  assert.equal(new Set(order).size, order.length);
});

test('rating stamps intro once and logs every answer', () => {
  let s = fresh();
  const id = cardId('hira:あ', 'recognize');
  s = rate(s, id, GOOD, { now: START, ms: 1200 });
  s = rate(s, id, GOOD, { now: START + 600000 });
  assert.equal(s.cards[id].intro, START);
  assert.equal(s.logs.length, 2);
  assert.deepEqual(s.logs[0], { c: id, r: GOOD, t: START, ms: 1200 });
});

test('auto-grading: wrong is Again, slow is Hard, otherwise Good', () => {
  assert.equal(gradeFor(false, 100), 1);
  assert.equal(gradeFor(true, SLOW_MS + 1), 2);
  assert.equal(gradeFor(true, 1000), 3);
});

test('multiple choice: four distinct options, one right, look-alikes first', () => {
  const g = rng();
  for (const id of ['hira:ぬ', 'kata:シ', 'kata:ビール', 'menu:ラーメン', 'sign:入口', 'hira:きゃ']) {
    for (const dir of ['recognize', 'listen']) {
      const opts = choices(ITEM[id], dir, g);
      assert.equal(opts.length, 4, id);
      assert.equal(new Set(opts.map((o) => o.label)).size, 4, id);
      assert.equal(opts.filter((o) => o.correct).length, 1, id);
    }
  }
  const shi = choices(ITEM['kata:シ'], 'recognize', g).map((o) => o.label);
  assert.ok(shi.includes('tsu'), `シ offers tsu: ${shi}`);
  const nu = choices(ITEM['hira:ぬ'], 'listen', g).map((o) => o.label);
  assert.ok(nu.includes('め'), `ぬ offers め: ${nu}`);
});

test('streak counts back from today, or from yesterday before you start', () => {
  let s = fresh();
  for (const d of [9, 10, 11]) s = rate(s, cardId('hira:あ', 'recognize'), GOOD, { now: day(2026, 11, d) });
  assert.equal(streak(s, day(2026, 11, 11, 20)), 3);
  assert.equal(streak(s, day(2026, 11, 12, 8)), 3);
  assert.equal(streak(s, day(2026, 11, 13)), 0);
});

test('drill history is capped', () => {
  let s = fresh();
  for (let i = 0; i < DRILL_KEEP + 5; i++) s = addDrill(s, { m: 'price', p: '¥1', a: '1', g: '1', ok: true, ms: 1, t: i });
  assert.equal(s.drills.length, DRILL_KEEP);
  assert.equal(s.drills[0].t, 5);
});

test('merging two devices: newer card wins, logs union, earlier start date kept', () => {
  const id = cardId('hira:あ', 'recognize');
  let phone = rate(fresh(), id, GOOD, { now: START });
  let laptop = normalizeState({ ...fresh(), settings: { ...fresh().settings, startDate: '2026-11-01', tripDate: '2027-02-01' } }, START);
  laptop = rate(laptop, id, EASY, { now: START + 1000 });
  laptop = rate(laptop, cardId('hira:い', 'recognize'), GOOD, { now: START + 2000 });
  const m = mergeStates(phone, exportBlob(laptop));
  assert.equal(m.cards[id].updatedAt, START + 1000);
  assert.ok(m.cards[cardId('hira:い', 'recognize')]);
  assert.equal(m.logs.length, 3);
  assert.equal(m.settings.startDate, '2026-11-01');
  assert.equal(m.settings.tripDate, '2027-01-10', "this device's trip date stays");
  // Merging the same export twice changes nothing.
  assert.deepEqual(mergeStates(m, exportBlob(laptop)), m);
});

test('only our own exports are accepted for import', () => {
  assert.ok(looksLikeExport(exportBlob(fresh())));
  assert.ok(!looksLikeExport({ cards: {} }));
  assert.ok(!looksLikeExport(null));
});

test('summary counts what is due and what is new', () => {
  const s0 = fresh();
  const sum0 = summary(s0, START);
  assert.equal(sum0.decks.hira.fresh, 15);
  assert.equal(sum0.decks.kata.fresh, 0);
  assert.equal(sum0.week, 1);
  assert.equal(sum0.daysLeft, 62);
  const s1 = studyAll(s0, START);
  assert.equal(summary(s1, START).decks.hira.fresh, 0);
  assert.equal(summary(s1, START + DAY).decks.hira.due, 0);
  assert.ok(summary(s1, START + 4 * DAY).decks.hira.due > 0);
});
