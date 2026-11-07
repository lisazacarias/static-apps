// Spaced repetition: FSRS scheduling, the trip-deadline cap, and the
// daily queue. No DOM.
//
// The research notes suggested the ts-fsrs library, but this repo ships
// nothing from npm, and the part we need is about a hundred lines. This
// is FSRS-5 as described in the algorithm write-up:
// https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
// with the default weights published for FSRS-5. No per-user optimizing:
// with ~300 cards and two months there isn't enough history to fit.
// CHECK: weights copied from the FSRS-5 defaults in fsrs4anki / ts-fsrs 4.x.

export const W = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192,
  1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621,
];
const DECAY = -0.5;
const FACTOR = 19 / 81; // makes R = 0.9 exactly when t = S
export const DAY = 86400000;
const MIN = 60000;

export const AGAIN = 1, HARD = 2, GOOD = 3, EASY = 4;

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// Chance of recalling a card t days after its last review.
export const retrievability = (t, s) => Math.pow(1 + FACTOR * Math.max(0, t) / s, DECAY);
// Days until recall drops to r.
export const intervalFor = (s, r) => (s / FACTOR) * (Math.pow(r, 1 / DECAY) - 1);

const initStability = (g) => W[g - 1];
const initDifficulty = (g) => clamp(W[4] - Math.exp(W[5] * (g - 1)) + 1, 1, 10);
function nextDifficulty(d, g) {
  const moved = d + (-W[6] * (g - 3)) * (10 - d) / 9; // shrinks as d nears 10
  return clamp(W[7] * initDifficulty(EASY) + (1 - W[7]) * moved, 1, 10);
}
function recallStability(d, s, r, g) {
  const hard = g === HARD ? W[15] : 1;
  const easy = g === EASY ? W[16] : 1;
  return s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hard * easy);
}
const forgetStability = (d, s, r) =>
  Math.min(s, W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r)));
// Reviews less than a day apart (learning steps, same-day repeats).
const shortTermStability = (s, g) => s * Math.exp(W[17] * (g - 3 + W[18]));

// Defaults from the research notes: steps 1m and 10m, relearn at 10m,
// no fuzz (a deadline wants predictable dates more than spread-out ones).
export const LEARNING_STEPS = [1, 10]; // minutes
export const RELEARNING_STEPS = [10];

export const newCard = (id) => ({ id, state: 'new', step: 0, s: 0, d: 0, due: 0, last: 0, reps: 0, lapses: 0 });

// The cap that keeps every card coming back before the trip:
// daysLeft − 2, between 1 and 21. Once the trip has started the cap goes
// back to 21 — reviewing everything daily in Japan helps nobody.
export function maxInterval(daysLeft) {
  if (daysLeft < 0) return 21;
  return clamp(daysLeft - 2, 1, 21);
}

// → the card after rating it. opts: { retention, maxDays, now }.
export function review(card, rating, { retention = 0.9, maxDays = 21, now = Date.now() } = {}) {
  if (![AGAIN, HARD, GOOD, EASY].includes(rating)) throw new RangeError(`rating ${rating}`);
  const c = { ...card, reps: card.reps + 1 };
  const elapsed = card.last ? (now - card.last) / DAY : 0;

  if (card.state === 'new') {
    c.s = initStability(rating);
    c.d = initDifficulty(rating);
  } else if (elapsed < 1) {
    c.s = shortTermStability(card.s, rating);
    c.d = nextDifficulty(card.d, rating);
  } else {
    const r = retrievability(elapsed, card.s);
    c.s = rating === AGAIN ? forgetStability(card.d, card.s, r) : recallStability(card.d, card.s, r, rating);
    c.d = nextDifficulty(card.d, rating);
  }
  c.s = Math.max(0.01, c.s);
  c.last = now;

  const days = () => clamp(Math.round(intervalFor(c.s, retention)), 1, maxDays);
  const graduate = () => { c.state = 'review'; c.step = 0; c.due = now + days() * DAY; return c; };
  const stepTo = (state, steps, i) => { c.state = state; c.step = i; c.due = now + steps[i] * MIN; return c; };

  if (card.state === 'review') {
    if (rating === AGAIN) { c.lapses = card.lapses + 1; return stepTo('relearning', RELEARNING_STEPS, 0); }
    return graduate();
  }
  // new, learning, relearning. A new card counts as on step 0, so Good
  // moves it to step 1 (10 minutes), the way Anki does.
  const state = card.state === 'relearning' ? 'relearning' : 'learning';
  const steps = state === 'relearning' ? RELEARNING_STEPS : LEARNING_STEPS;
  const at = card.state === 'new' ? 0 : card.step;
  if (rating === AGAIN) return stepTo(state, steps, 0);
  if (rating === EASY) return graduate();
  if (rating === HARD) {
    // Stay on this step; on the very first step, wait between it and the next.
    stepTo(state, steps, at);
    if (at === 0 && steps.length > 1) c.due = now + ((steps[0] + steps[1]) / 2) * MIN;
    return c;
  }
  return at + 1 < steps.length ? stepTo(state, steps, at + 1) : graduate();
}

// When a card is next due, with the trip cap applied. The cap shrinks
// every day as the trip gets closer, so a card scheduled weeks ago with a
// long interval is pulled in rather than left past the deadline.
export function dueAt(card, maxDays) {
  if (card.state !== 'review') return card.due;
  return Math.min(card.due, card.last + maxDays * DAY);
}

export const recallNow = (card, now) =>
  (card.state === 'new' || !card.s ? 0 : retrievability((now - card.last) / DAY, card.s));
