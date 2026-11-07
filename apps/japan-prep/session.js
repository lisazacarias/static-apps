// What's due, what's new, quiz options, stored state and merging.
// No DOM, so the Node tests import it as shipped.

import { ITEMS, ITEM, DECKS, DECK_ORDER, directionsFor } from './content.js';
import { CONFUSABLE, toHiragana, toKatakana } from './kana.js';
import { review, newCard, dueAt, maxInterval, recallNow, DAY, AGAIN, HARD, GOOD } from './srs.js';

export const VERSION = 1;
export const SWEEP_DAYS = 5;   // last days before the trip: no new cards, revisit anything shaky
export const SWEEP_RECALL = 0.95;
export const SLOW_MS = 6000;   // right but slower than this counts as Hard
const LEARN_AHEAD = 20 * 60000; // with nothing else left, show learning cards up to 20 min early
export const DRILL_KEEP = 2000;

/* ── dates (local, YYYY-MM-DD) ── */

export const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const fromYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const isYmd = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(fromYmd(s).getTime());
const startOfDay = (t) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
// Whole days from a to b, counted on the calendar (DST-proof).
export const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);

/* ── stored state ── */

export const DEFAULT_TRIP = '2027-01-10';

export function normalizeSettings(raw, now = Date.now()) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const num = (v, lo, hi, dflt) => (Number.isFinite(v) && v >= lo && v <= hi ? v : dflt);
  const newPerDay = {};
  for (const d of DECK_ORDER) newPerDay[d] = Math.round(num(r.newPerDay?.[d], 0, 50, DECKS[d].newPerDay));
  return {
    tripDate: isYmd(r.tripDate) ? r.tripDate : DEFAULT_TRIP,
    // Unlock days count from here. Set on first launch.
    startDate: isYmd(r.startDate) ? r.startDate : ymd(new Date(now)),
    retention: { core: num(r.retention?.core, 0.7, 0.99, 0.92), rest: num(r.retention?.rest, 0.7, 0.99, 0.9) },
    newPerDay,
    showRomaji: r.showRomaji !== false,
    showEnglish: r.showEnglish !== false,
    voiceURI: typeof r.voiceURI === 'string' ? r.voiceURI : '',
    sweep: r.sweep === true,
    unlockAll: r.unlockAll === true,
    muteHintShown: r.muteHintShown === true,
    backupAt: Number.isFinite(r.backupAt) ? r.backupAt : 0,
  };
}

const STATES = ['new', 'learning', 'review', 'relearning'];
export function normalizeCard(id, c) {
  if (!c || typeof c !== 'object' || !STATES.includes(c.state)) return null;
  const n = (v) => (Number.isFinite(v) && v >= 0 ? v : 0);
  return {
    id, state: c.state, step: Math.round(n(c.step)), s: n(c.s), d: n(c.d) || 5, due: n(c.due), last: n(c.last),
    reps: Math.round(n(c.reps)), lapses: Math.round(n(c.lapses)), intro: n(c.intro), updatedAt: n(c.updatedAt),
  };
}

// Cards for items no longer in content.js are kept: renaming an item by
// accident shouldn't throw away its history, and they're never shown.
export function normalizeCards(raw) {
  const out = {};
  if (raw && typeof raw === 'object') for (const [id, c] of Object.entries(raw)) { const ok = normalizeCard(id, c); if (ok) out[id] = ok; }
  return out;
}

// Logs: { c: cardId, r: rating 1–4, t: time, ms: answer time }.
export function normalizeLogs(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((l) => l && typeof l.c === 'string' && [1, 2, 3, 4].includes(l.r) && Number.isFinite(l.t))
    .map((l) => ({ c: l.c, r: l.r, t: l.t, ms: Number.isFinite(l.ms) ? l.ms : 0 }));
}

// Drill attempts: { m: mode, p: prompt, a: answer, g: given, ok, ms, t }.
export function normalizeDrills(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((d) => d && typeof d.m === 'string' && Number.isFinite(d.t))
    .map((d) => ({ m: d.m, p: String(d.p ?? ''), a: String(d.a ?? ''), g: String(d.g ?? ''), ok: d.ok === true, ms: Number.isFinite(d.ms) ? d.ms : 0, t: d.t }))
    .slice(-DRILL_KEEP);
}

export function normalizeState(raw, now = Date.now()) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    version: VERSION,
    settings: normalizeSettings(r.settings, now),
    cards: normalizeCards(r.cards),
    logs: normalizeLogs(r.logs),
    drills: normalizeDrills(r.drills),
  };
}

/* ── where we are ── */

export const daysLeft = (settings, now) => daysBetween(now, fromYmd(settings.tripDate).getTime());
export const dayIndex = (settings, now) => daysBetween(fromYmd(settings.startDate).getTime(), now);
export const sweepOn = (settings, now) => {
  const left = daysLeft(settings, now);
  return settings.sweep || (left >= 0 && left <= SWEEP_DAYS);
};
export const retentionFor = (settings, deck) => settings.retention[DECKS[deck]?.retention === 'core' ? 'core' : 'rest'];

export const cardId = (itemId, dir) => `${itemId}|${dir}`;
export const splitCardId = (id) => { const i = id.lastIndexOf('|'); return { itemId: id.slice(0, i), dir: id.slice(i + 1) }; };

export const unlocked = (item, settings, now) => settings.unlockAll || item.day <= dayIndex(settings, now);

const cardOf = (state, id) => state.cards[id] || newCard(id);
const introducedToday = (state, deck, now) => {
  const today = startOfDay(now);
  const items = new Set();
  for (const c of Object.values(state.cards)) {
    if (c.intro >= today && ITEM[splitCardId(c.id).itemId]?.deck === deck) items.add(splitCardId(c.id).itemId);
  }
  return items.size;
};
const itemStarted = (state, itemId) => directionsFor(ITEM[itemId]).some((d) => state.cards[cardId(itemId, d)]?.intro);

// Everything shown today, counted per deck.
export function summary(state, now = Date.now()) {
  const { settings } = state;
  const maxDays = maxInterval(daysLeft(settings, now));
  const endToday = startOfDay(now) + DAY;
  const sweep = sweepOn(settings, now);
  const out = {};
  for (const d of DECK_ORDER) out[d] = { due: 0, fresh: 0, tomorrow: 0, learned: 0, total: 0 };
  for (const item of ITEMS) {
    const o = out[item.deck];
    o.total++;
    if (itemStarted(state, item.id)) o.learned++;
    for (const dir of directionsFor(item)) {
      const c = state.cards[cardId(item.id, dir)];
      if (!c || c.state === 'new') continue;
      const due = dueAt(c, maxDays);
      if (due < endToday) o.due++;
      else if (due < endToday + DAY) o.tomorrow++;
    }
  }
  if (!sweep) {
    for (const d of DECK_ORDER) {
      const left = Math.max(0, settings.newPerDay[d] - introducedToday(state, d, now));
      out[d].fresh = Math.min(left, ITEMS.filter((i) => i.deck === d && unlocked(i, settings, now) && !itemStarted(state, i.id)).length);
    }
  }
  return { decks: out, sweep, daysLeft: daysLeft(settings, now), week: Math.floor(dayIndex(settings, now) / 7) + 1, maxDays };
}

// The next card to show, or null when the day is done.
// seen: card ids already shown this sitting (sweep mode uses it so a
// card isn't repeated once you've got it right).
export function nextCard(state, now = Date.now(), seen = new Set()) {
  const { settings } = state;
  const maxDays = maxInterval(daysLeft(settings, now));
  const endToday = startOfDay(now) + DAY;
  const order = (id) => DECK_ORDER.indexOf(ITEM[splitCardId(id).itemId]?.deck);
  const live = Object.values(state.cards).filter((c) => ITEM[splitCardId(c.id).itemId] && c.state !== 'new');

  // 1. Learning steps that have come round.
  const learning = live.filter((c) => (c.state === 'learning' || c.state === 'relearning')).sort((a, b) => a.due - b.due);
  if (learning[0] && learning[0].due <= now) return learning[0].id;

  if (sweepOn(settings, now)) {
    // 2s. Anything you'd likely miss right now, weakest first.
    const shaky = live.filter((c) => c.state === 'review' && !seen.has(c.id) && recallNow(c, now) < SWEEP_RECALL)
      .sort((a, b) => recallNow(a, now) - recallNow(b, now));
    if (shaky[0]) return shaky[0].id;
  } else {
    // 2. Reviews due today, kana first.
    const due = live.filter((c) => c.state === 'review' && dueAt(c, maxDays) < endToday)
      .sort((a, b) => order(a.id) - order(b.id) || a.due - b.due);
    if (due[0]) return due[0].id;

    // 3. The other direction of something already started (not capped),
    //    then a brand-new item if the deck's daily allowance has room.
    for (const deck of DECK_ORDER) {
      const items = ITEMS.filter((i) => i.deck === deck && unlocked(i, settings, now));
      for (const i of items) {
        if (!itemStarted(state, i.id)) continue;
        const dir = directionsFor(i).find((d) => !state.cards[cardId(i.id, d)]?.intro);
        if (dir) return cardId(i.id, dir);
      }
    }
    for (const deck of DECK_ORDER) {
      if (introducedToday(state, deck, now) >= settings.newPerDay[deck]) continue;
      const fresh = ITEMS.find((i) => i.deck === deck && unlocked(i, settings, now) && !itemStarted(state, i.id));
      if (fresh) return cardId(fresh.id, directionsFor(fresh)[0]);
    }
  }

  // 4. Nothing else: learning cards a little early rather than waiting.
  if (learning[0] && learning[0].due <= now + LEARN_AHEAD) return learning[0].id;
  return null;
}

// Rate a card. Returns the new state (the old one isn't changed).
export function rate(state, id, rating, { now = Date.now(), ms = 0 } = {}) {
  const { itemId } = splitCardId(id);
  const item = ITEM[itemId];
  if (!item) throw new Error(`no item for ${id}`);
  const before = cardOf(state, id);
  const after = review(before, rating, {
    now, retention: retentionFor(state.settings, item.deck), maxDays: maxInterval(daysLeft(state.settings, now)),
  });
  after.intro = before.intro || now;
  after.updatedAt = now;
  return { ...state, cards: { ...state.cards, [id]: after }, logs: [...state.logs, { c: id, r: rating, t: now, ms }] };
}

// Auto-grade a quiz answer: wrong is Again, right but slow is Hard.
export const gradeFor = (correct, ms) => (!correct ? AGAIN : ms > SLOW_MS ? HARD : GOOD);

export const addDrill = (state, d) => ({ ...state, drills: [...state.drills, d].slice(-DRILL_KEEP) });

/* ── multiple choice ── */

const shuffle = (xs, rng) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Look-alike kana for an item, in its own script.
function lookalikes(item) {
  const conv = item.deck === 'kata' ? toKatakana : toHiragana;
  const me = item.jp;
  const out = [];
  for (const set of CONFUSABLE) {
    const chars = [...conv(set)];
    if (chars.includes(me)) out.push(...chars.filter((c) => c !== me));
  }
  return out;
}

// Four choices for a quiz card, the right one included.
// → { prompt kind, options: [{ label, correct }] }
export function choices(item, dir, rng = Math.random) {
  const deckItems = ITEMS.filter((i) => i.deck === item.deck && !i.word && i.id !== item.id);
  let wrong;
  if (item.deck === 'hira' || item.deck === 'kata') {
    const field = dir === 'listen' ? 'jp' : 'romaji';
    if (item.word) {
      wrong = item.confuse;
    } else {
      const look = lookalikes(item).map((c) => ITEM[`${item.deck}:${c}`]).filter(Boolean);
      const sameGroup = shuffle(deckItems.filter((i) => i.group === item.group), rng);
      const rest = shuffle(deckItems, rng);
      wrong = [...shuffle(look, rng), ...sameGroup, ...rest].map((i) => i[field]);
    }
    return pack(item[dir === 'listen' ? 'jp' : 'romaji'], wrong, rng);
  }
  wrong = shuffle(deckItems, rng).map((i) => i.en);
  return pack(item.en, wrong, rng);
}

function pack(right, wrong, rng) {
  const labels = [right];
  for (const w of wrong) { if (labels.length === 4) break; if (!labels.includes(w)) labels.push(w); }
  return shuffle(labels, rng).map((label) => ({ label, correct: label === right }));
}

/* ── streak ── */

// Consecutive days with any study, ending today (or yesterday, so the
// streak doesn't read 0 first thing in the morning).
export function streak(state, now = Date.now()) {
  const days = new Set([...state.logs.map((l) => l.t), ...state.drills.map((d) => d.t)].map((t) => ymd(new Date(t))));
  let d = new Date(startOfDay(now));
  if (!days.has(ymd(d))) d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  let n = 0;
  while (days.has(ymd(d))) { n++; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1); }
  return n;
}

/* ── backup and merge ── */

export const exportBlob = (state, now = Date.now()) => ({ app: 'japan-prep', version: VERSION, exportedAt: now, ...state });

// Combine a backup (or another device's export) with what's here. For
// each card the newer update wins; logs and drills are unioned. Settings
// stay as they are on this device, except a start date that's earlier
// (so imported progress doesn't re-lock).
export function mergeStates(local, incoming) {
  const a = normalizeState(local), b = normalizeState(incoming);
  const cards = { ...a.cards };
  for (const [id, c] of Object.entries(b.cards)) if (!cards[id] || c.updatedAt > cards[id].updatedAt) cards[id] = c;
  const logKey = (l) => `${l.c}@${l.t}`;
  const seenLogs = new Set(a.logs.map(logKey));
  const logs = [...a.logs, ...b.logs.filter((l) => !seenLogs.has(logKey(l)))].sort((x, y) => x.t - y.t);
  const drillKey = (d) => `${d.m}@${d.t}`;
  const seenDrills = new Set(a.drills.map(drillKey));
  const drills = [...a.drills, ...b.drills.filter((d) => !seenDrills.has(drillKey(d)))].sort((x, y) => x.t - y.t).slice(-DRILL_KEEP);
  const startDate = b.settings.startDate < a.settings.startDate ? b.settings.startDate : a.settings.startDate;
  return { ...a, settings: { ...a.settings, startDate }, cards, logs, drills };
}

// Is this something we exported? (Anything else is refused rather than
// merged in as an empty state.)
export const looksLikeExport = (raw) => !!raw && typeof raw === 'object' && raw.app === 'japan-prep' && typeof raw.cards === 'object';
