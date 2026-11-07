import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeState, normalizeSettings, nextCard, rate, summary, choices, gradeFor, streak, mergeStates, exportBlob, looksLikeExport,
  cardId, splitCardId, sweepOn, daysLeft, dayIndex, addDrill, DRILL_KEEP, SLOW_MS, teach, isTaught, TEACH_BATCH,
} from '../session.js';
import { ITEM, DECKS } from '../content.js';
import { AGAIN, GOOD, EASY, DAY } from '../srs.js';

const day = (y, m, d, h = 9) => new Date(y, m - 1, d, h).getTime();
const START = day(2026, 11, 9);
const fresh = (settings = {}) => normalizeState({ settings: { startDate: '2026-11-09', tripDate: '2027-01-25', ...settings } }, START);
const rng = (seed = 5) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// Work through the queue the way the app does: teach anything not yet
// taught, answer the rest Good, until it's empty or n cards.
function studyAll(state, now, n = 1000, rating = GOOD) {
  let t = now;
  for (let i = 0; i < n; i++) {
    const id = nextCard(state, t);
    if (!id) break;
    const { itemId } = splitCardId(id);
    state = isTaught(state, itemId) ? rate(state, id, rating, { now: t }) : teach(state, itemId, t);
    t += 1000;
  }
  return state;
}

test('settings fall back to defaults for anything missing or out of range', () => {
  const s = normalizeSettings({ tripDate: 'soon', retention: { core: 2 }, newPerDay: { hira: -3, phrase: 9 } }, START);
  assert.equal(s.tripDate, '2027-01-25');
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

test('day one: hiragana first, capped at 15 new kana, plus starred phrases up to the phrase cap', () => {
  const s = studyAll(fresh(), START);
  const items = new Set(Object.keys(s.cards).map((id) => splitCardId(id).itemId));
  const hira = [...items].filter((i) => ITEM[i].deck === 'hira');
  assert.equal(hira.length, 15);
  assert.ok(hira.includes('hira:あ') && hira.includes('hira:こ'), 'a/ka group first');
  assert.ok(![...items].some((i) => ITEM[i].deck === 'kata'), 'no katakana before day 6');
  assert.ok(![...items].some((i) => ITEM[i].deck === 'sign'), 'no signs in week 1');
  const phrases = [...items].filter((i) => ITEM[i].deck === 'phrase');
  assert.equal(phrases.length, DECKS.phrase.newPerDay);
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
  let s = teach(fresh({ newPerDay: { hira: 1, kata: 0, menu: 0, num: 0, phrase: 0, sign: 0 } }), 'hira:あ', START);
  const id = nextCard(s, START);
  assert.equal(id, 'hira:あ|recognize');
  s = rate(s, id, AGAIN, { now: START });
  assert.equal(nextCard(s, START + 61000), id);
});

test('sweep mode: on at 5 days left, no new cards, shaky cards weakest first, each once', () => {
  let s = studyAll(fresh(), START);
  const late = day(2027, 1, 20);
  assert.equal(daysLeft(s.settings, late), 5);
  assert.ok(sweepOn(s.settings, late));
  assert.ok(!sweepOn(s.settings, day(2027, 1, 19)));
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

test('new items are taught five at a time, then quizzed', () => {
  let s = fresh();
  let t = START;
  const taught = [];
  for (let i = 0; i < TEACH_BATCH; i++) {
    const id = nextCard(s, t);
    assert.ok(!isTaught(s, splitCardId(id).itemId), `${id} is new`);
    taught.push(splitCardId(id).itemId);
    s = teach(s, splitCardId(id).itemId, t += 1000);
  }
  assert.deepEqual(taught, ['hira:あ', 'hira:い', 'hira:う', 'hira:え', 'hira:お']);
  assert.equal(s.logs.length, 0, 'teaching is not a review');
  assert.equal(s.cards['hira:あ|recognize'].state, 'new');
  // Now the quiz: both directions of each, before any more teaching.
  const quiz = [];
  for (let i = 0; i < TEACH_BATCH * 2; i++) {
    const id = nextCard(s, t);
    quiz.push(id);
    s = rate(s, id, GOOD, { now: t += 1000 });
  }
  assert.ok(quiz.every((id) => taught.includes(splitCardId(id).itemId)), quiz.join(' '));
  assert.equal(new Set(quiz).size, TEACH_BATCH * 2);
  assert.equal(splitCardId(nextCard(s, t)).itemId, 'hira:か', 'then the next lesson');
  assert.ok(!isTaught(s, 'hira:か'));
});

test('the kana batch is quizzed before phrases start being taught', () => {
  let s = fresh({ newPerDay: { hira: 2, kata: 0, menu: 0, num: 0, phrase: 6, sign: 0 } });
  s = teach(s, 'hira:あ', START);
  s = teach(s, 'hira:い', START);
  assert.equal(ITEM[splitCardId(nextCard(s, START)).itemId].deck, 'hira');
});

test('cards quizzed before teaching existed still schedule normally', () => {
  // A state from the first release: rated straight away, never taught.
  let s = rate(fresh(), 'hira:あ|recognize', GOOD, { now: START });
  assert.ok(isTaught(s, 'hira:あ'));
  assert.equal(nextCard(s, START), 'hira:あ|listen', 'its other direction is quizzed, not re-taught');
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
  assert.equal(m.settings.tripDate, '2027-01-25', "this device's trip date stays");
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
  assert.equal(sum0.daysLeft, 77);
  const s1 = studyAll(s0, START);
  assert.equal(summary(s1, START).decks.hira.fresh, 0);
  assert.equal(summary(s1, START + DAY).decks.hira.due, 0);
  assert.ok(summary(s1, START + 4 * DAY).decks.hira.due > 0);
});

test('sweep mode still shows a card the trip cap makes due, even when recall is high', () => {
  const late = day(2027, 1, 20); // 5 days left: cap is 3 days
  const id = cardId('hira:あ', 'recognize');
  const s = normalizeState({
    ...fresh(),
    cards: { [id]: { state: 'review', s: 100, d: 5, due: late + 60 * DAY, last: late - 3 * DAY, reps: 5, intro: START, updatedAt: START } },
  }, START);
  assert.equal(nextCard(s, late, new Set()), id);
  // Once seen, the sweep moves on (here to あ's never-quizzed listening card).
  assert.equal(nextCard(s, late, new Set([id])), 'hira:あ|listen');
});

test('a Jan 25 trip: the pre-trip sweep switches on at 5 days left (Jan 20), not before', () => {
  const s = normalizeState({ settings: { startDate: '2026-11-09' } }, START); // default trip date
  assert.equal(s.settings.tripDate, '2027-01-25');
  assert.equal(daysLeft(s.settings, day(2027, 1, 20)), 5);
  assert.ok(!sweepOn(s.settings, day(2027, 1, 19, 23)), '6 days left: off');
  assert.ok(sweepOn(s.settings, day(2027, 1, 20, 0)), '5 days left: on from midnight');
  assert.ok(sweepOn(s.settings, day(2027, 1, 25)), 'the day you fly');
  assert.ok(!sweepOn(s.settings, day(2027, 1, 26)), 'off once the trip has started');
});

test('the interval cap is worked out again each day from the trip date', () => {
  const s = fresh();
  assert.equal(summary(s, day(2026, 11, 9)).maxDays, 21);
  assert.equal(summary(s, day(2027, 1, 10)).maxDays, 13); // 15 days left
  assert.equal(summary(s, day(2027, 1, 11)).maxDays, 12);
  assert.equal(summary(s, day(2027, 1, 24)).maxDays, 1);
  // A card reviewed on Jan 10 and scheduled 21 days out (Jan 31, after the
  // trip) is pulled in as the cap shrinks: on Jan 17 (8 days left) the cap
  // is 6 days, so it's due from Jan 16.
  const id = cardId('hira:あ', 'recognize');
  const t = day(2027, 1, 10);
  const st = { ...s, cards: { [id]: { id, state: 'review', step: 0, s: 40, d: 5, due: t + 21 * DAY, last: t, reps: 4, lapses: 0, intro: t, updatedAt: t } } };
  assert.equal(summary(st, day(2027, 1, 16)).decks.hira.due, 0, '9 days left, cap 7: due Jan 17');
  assert.equal(summary(st, day(2027, 1, 17)).decks.hira.due, 1, '8 days left, cap 6: due now');
});

test('saved settings from before the move get the new trip date and caps; nothing else changes', () => {
  const legacy = {
    settings: { tripDate: '2027-01-10', startDate: '2026-11-07', newPerDay: { hira: 15, kata: 15, menu: 6, num: 6, phrase: 6, sign: 4 }, showRomaji: false, backupAt: 123 },
    cards: { 'hira:あ|recognize': { state: 'review', s: 3, d: 5, due: 9, last: 1, reps: 2, intro: 1, updatedAt: 1 }, 'sign:年末年始|recognize': { state: 'review', s: 3, d: 5, due: 9, last: 1, reps: 2, intro: 1, updatedAt: 1 } },
    logs: [{ c: 'hira:あ|recognize', r: 3, t: 1, ms: 900 }],
    drills: [{ m: 'price', p: '¥300', a: '300', g: '300', ok: true, ms: 1, t: 2 }],
  };
  const s = normalizeState(legacy, START);
  assert.equal(s.settings.tripDate, '2027-01-25');
  assert.deepEqual(s.settings.newPerDay, Object.fromEntries(Object.keys(DECKS).map((d) => [d, DECKS[d].newPerDay])));
  assert.equal(s.settings.startDate, '2026-11-07');
  assert.equal(s.settings.showRomaji, false);
  assert.equal(s.settings.backupAt, 123);
  assert.deepEqual(Object.keys(s.cards).sort(), ['hira:あ|recognize', 'sign:年末年始|recognize'], 'cards kept, even for removed items');
  assert.equal(s.logs.length, 1);
  assert.equal(s.drills.length, 1);
  // A trip date or cap you chose yourself stays.
  const mine = normalizeState({ settings: { tripDate: '2027-02-14', newPerDay: { phrase: 9 } } }, START);
  assert.equal(mine.settings.tripDate, '2027-02-14');
  assert.equal(mine.settings.newPerDay.phrase, 9);
  // And once migrated, the old date is a real choice if you set it again.
  const again = normalizeState({ settings: { ...s.settings, tripDate: '2027-01-10' } }, START);
  assert.equal(again.settings.tripDate, '2027-01-10');
});

test('the stages of the 11-week plan, for a Nov 9 start and a Jan 25 trip', () => {
  const s = fresh();
  const stage = (y, m, d) => summary(s, day(y, m, d)).stage;
  assert.equal(stage(2026, 12, 20), 'learn');        // week 6
  assert.equal(stage(2026, 12, 21), 'polish');       // week 7, 35 days out
  assert.equal(stage(2027, 1, 3), 'polish');         // end of week 8
  assert.equal(stage(2027, 1, 4), 'consolidate');    // week 9, 21 days out
  assert.equal(stage(2027, 1, 17), 'consolidate');   // end of week 10
  assert.equal(stage(2027, 1, 18), 'final');         // week 11, 7 days out
  assert.equal(stage(2027, 1, 26), 'trip');
  assert.equal(summary(s, day(2027, 1, 18)).week, 11);
});

test('new-card caps spread phrases and signs out: 2 a day each', () => {
  assert.equal(DECKS.phrase.newPerDay, 2);
  assert.equal(DECKS.sign.newPerDay, 2);
  const s = studyAll(fresh(), START);
  assert.equal(Object.keys(s.cards).filter((id) => id.startsWith('ph:')).length, 2);
});

test('weeks 9–10: no new phrases, other decks carry on', () => {
  const s = fresh();
  const jan5 = day(2027, 1, 5);
  assert.equal(summary(s, jan5).decks.phrase.fresh, 0);
  assert.ok(summary(s, jan5).decks.hira.fresh > 0);
  const after = studyAll(s, jan5);
  assert.ok(!Object.keys(after.cards).some((id) => id.startsWith('ph:')), 'no phrase taught');
  assert.ok(summary(s, day(2027, 1, 3)).decks.phrase.fresh > 0, 'the day before, still teaching');
});

test('weeks 9–10: listen-only staff phrases get extra passes, once each per sitting', () => {
  const t = day(2027, 1, 6); // consolidate
  const mk = (id) => ({ id, state: 'review', step: 0, s: 30, d: 5, due: t + 20 * DAY, last: t - 3 * DAY, reps: 3, lapses: 0, intro: 1, updatedAt: 1 });
  // Recall after 3 days at S=30 is about 0.977: above the sweep line.
  // At S=5 it's about 0.88, so it's shaky and gets a pass.
  const shaky = { ...mk('ph:irasshaimase|listen'), s: 5 };
  const s = { ...fresh({ unlockAll: true, newPerDay: { hira: 0, kata: 0, menu: 0, num: 0, phrase: 0, sign: 0 } }), cards: {
    'ph:irasshaimase|listen': shaky, 'ph:nanmei|listen': mk('ph:nanmei|listen'), 'ph:sumimasen|produce': { ...mk('ph:sumimasen|produce'), s: 5 },
  } };
  assert.equal(nextCard(s, t, new Set()), 'ph:irasshaimase|listen');
  assert.equal(nextCard(s, t, new Set(['ph:irasshaimase|listen'])), null, 'not the sure one, not a non-listening phrase');
  // Before weeks 9–10, no extra pass.
  const early = { ...s, settings: { ...s.settings, tripDate: '2027-03-01' } };
  assert.equal(nextCard(early, t, new Set()), null);
});
