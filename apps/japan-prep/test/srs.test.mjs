import { test } from 'node:test';
import assert from 'node:assert/strict';
import { review, newCard, retrievability, intervalFor, maxInterval, dueAt, DAY, AGAIN, HARD, GOOD, EASY } from '../srs.js';

const T0 = new Date(2026, 10, 9, 9).getTime();
const MIN = 60000;

test('R is 0.9 when elapsed time equals stability', () => {
  assert.ok(Math.abs(retrievability(5, 5) - 0.9) < 1e-12);
  assert.ok(Math.abs(intervalFor(7, 0.9) - 7) < 1e-9);
  assert.ok(intervalFor(10, 0.92) < intervalFor(10, 0.9), 'higher retention, shorter interval');
});

test('a new card goes 10 minutes, then graduates on Good', () => {
  let c = review(newCard('x'), GOOD, { now: T0 });
  assert.equal(c.state, 'learning');
  assert.equal(c.due - T0, 10 * MIN);
  c = review(c, GOOD, { now: c.due });
  assert.equal(c.state, 'review');
  assert.ok(c.due - c.last >= DAY);
});

test('Again on a new card starts at 1 minute; Hard waits between the steps', () => {
  assert.equal(review(newCard('x'), AGAIN, { now: T0 }).due - T0, MIN);
  assert.equal(review(newCard('x'), HARD, { now: T0 }).due - T0, 5.5 * MIN);
  assert.equal(review(newCard('x'), EASY, { now: T0 }).state, 'review');
});

test('forgetting a review card relearns at 10 minutes and lowers stability', () => {
  let c = review(newCard('x'), EASY, { now: T0 });
  const t = c.due;
  const s = c.s;
  c = review(c, AGAIN, { now: t });
  assert.equal(c.state, 'relearning');
  assert.equal(c.due - t, 10 * MIN);
  assert.equal(c.lapses, 1);
  assert.ok(c.s < s);
  c = review(c, GOOD, { now: c.due });
  assert.equal(c.state, 'review');
});

test('Good intervals grow, and Easy beats Good beats Hard', () => {
  let c = review(newCard('x'), GOOD, { now: T0 });
  c = review(c, GOOD, { now: c.due });
  const gaps = [];
  for (let i = 0; i < 4; i++) { const next = review(c, GOOD, { now: c.due, maxDays: 365 }); gaps.push(next.due - next.last); c = next; }
  for (let i = 1; i < gaps.length; i++) assert.ok(gaps[i] > gaps[i - 1], `gaps ${gaps.map((g) => g / DAY)}`);
  const at = c.due;
  const [h, g, e] = [HARD, GOOD, EASY].map((r) => review(c, r, { now: at, maxDays: 1e5 }).due);
  assert.ok(h < g && g < e);
});

test('the trip cap: daysLeft − 2, between 1 and 21; back to 21 once the trip starts', () => {
  assert.equal(maxInterval(60), 21);
  assert.equal(maxInterval(10), 8);
  assert.equal(maxInterval(2), 1);
  assert.equal(maxInterval(0), 1);
  assert.equal(maxInterval(-1), 21);
});

test('intervals never exceed maxDays, and dueAt pulls in a card scheduled before the cap shrank', () => {
  let c = review(newCard('x'), EASY, { now: T0 });
  for (let i = 0; i < 6; i++) c = review(c, EASY, { now: c.due, maxDays: 21 });
  assert.ok(c.due - c.last <= 21 * DAY);
  assert.equal(dueAt(c, 3), c.last + 3 * DAY);
  assert.equal(dueAt(c, 400), c.due);
});

test('ratings outside 1–4 are refused', () => {
  assert.throws(() => review(newCard('x'), 0), RangeError);
});
