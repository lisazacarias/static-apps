// Number readings and the generated price/time/counter drills. No DOM.
//
// Readings are built with spaces between the parts (せん よんひゃく
// はちじゅう えん) so the romaji reads "sen yonhyaku hachijū en"; the kana
// shown and spoken has them taken out.
//
// Readings follow the standard textbook forms (the research notes, citing
// Elon.io's grammar notes; see README.md). Where real speech varies, the
// first form is what the drill says and `accepted` lists the others.

import { toRomaji } from './kana.js';

const DIGIT = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];
const HUNDRED = ['', 'ひゃく', 'にひゃく', 'さんびゃく', 'よんひゃく', 'ごひゃく', 'ろっぴゃく', 'ななひゃく', 'はっぴゃく', 'きゅうひゃく'];
// 6,000 is regular ろくせん; ろっせん is the classic overcorrection.
const THOUSAND = ['', 'せん', 'にせん', 'さんぜん', 'よんせん', 'ごせん', 'ろくせん', 'ななせん', 'はっせん', 'きゅうせん'];

// 0–9,999 as one 万 group, spaced.
function under10k(n) {
  const th = Math.floor(n / 1000), h = Math.floor(n / 100) % 10, t = Math.floor(n / 10) % 10, o = n % 10;
  return [THOUSAND[th], HUNDRED[h], (t ? (t > 1 ? DIGIT[t] : '') + 'じゅう' : '') + DIGIT[o]].filter(Boolean).join(' ');
}

const unspace = (s) => s.replace(/ /g, '');

// Spaced reading of a whole number, 0 to 99,999,999. 10,000 is いちまん —
// 万 always takes its number, unlike 百 and 千.
function spaced(n) {
  if (!Number.isInteger(n) || n < 0 || n >= 1e8) throw new RangeError(`readNumber: ${n}`);
  if (n === 0) return 'ゼロ';
  const man = Math.floor(n / 10000), rest = n % 10000;
  return [man ? under10k(man) + 'まん' : '', under10k(rest)].filter(Boolean).join(' ');
}
export const readNumber = (n) => unspace(spaced(n));

// Counters where the last digit changes the sound. Index by last digit
// (0 = a multiple of ten). Most follow the rule in the notes: 一/六/八/十
// double the next consonant (いっ, ろっ, はっ, じゅっ) and 三 voices it.
const SOUND = {
  hon: ['じゅっぽん', 'いっぽん', 'にほん', 'さんぼん', 'よんほん', 'ごほん', 'ろっぽん', 'ななほん', 'はっぽん', 'きゅうほん'],
  hai: ['じゅっぱい', 'いっぱい', 'にはい', 'さんばい', 'よんはい', 'ごはい', 'ろっぱい', 'ななはい', 'はっぱい', 'きゅうはい'],
  kai: ['じゅっかい', 'いっかい', 'にかい', 'さんがい', 'よんかい', 'ごかい', 'ろっかい', 'ななかい', 'はっかい', 'きゅうかい'],
  // CHECK: 4泊 — よんはく or よんぱく? Both turn up in hotel listings; this uses よんぱく.
  haku: ['じゅっぱく', 'いっぱく', 'にはく', 'さんぱく', 'よんぱく', 'ごはく', 'ろっぱく', 'ななはく', 'はっぱく', 'きゅうはく'],
  fun: ['じゅっぷん', 'いっぷん', 'にふん', 'さんぷん', 'よんぷん', 'ごふん', 'ろっぷん', 'ななふん', 'はっぷん', 'きゅうふん'],
};
const SOUND_ALSO = { 0: { fun: 'じっぷん', hon: 'じっぽん' }, 8: { fun: 'はちふん', kai: 'はちかい' } };

const NATIVE = ['', 'ひとつ', 'ふたつ', 'みっつ', 'よっつ', 'いつつ', 'むっつ', 'ななつ', 'やっつ', 'ここのつ', 'とお'];

export const COUNTERS = {
  yen: { kanji: '円', en: 'yen' },
  nin: { kanji: '人', en: 'people' },
  tsu: { kanji: 'つ', en: 'things' },
  hon: { kanji: '本', en: 'bottles / long things' },
  hai: { kanji: '杯', en: 'cups / bowls' },
  mai: { kanji: '枚', en: 'tickets / flat things' },
  kai: { kanji: '階', en: 'floor' },
  haku: { kanji: '泊', en: 'nights' },
  bansen: { kanji: '番線', en: 'platform' },
  ji: { kanji: '時', en: "o'clock" },
  fun: { kanji: '分', en: 'minutes' },
};

// The tens-and-up part of n (20 for 24), read plainly, for counters that
// only change on the last digit: 24本 = にじゅう + よんほん.
const tensPart = (n) => (n >= 10 ? spaced(n - (n % 10)) : '');

// Spaced forms → what callers get: kana (no spaces), every accepted kana
// form (accepted[0] is kana), and romaji with the spaces kept.
const finish = (forms) => ({ kana: unspace(forms[0]), accepted: forms.map(unspace), romaji: toRomaji(forms[0]) });

// → { kana, accepted, romaji }.
export function toJapaneseReading(n, counter) {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`toJapaneseReading: ${n}`);
  return finish(spacedReading(n, counter));
}

function spacedReading(n, counter) {
  const one = (...forms) => forms;
  const readNumber = spaced;
  if (!counter) return one(readNumber(n));
  if (!COUNTERS[counter]) throw new Error(`unknown counter ${counter}`);
  const last = n % 10;

  switch (counter) {
    case 'yen':
      // 4円 is よえん, and so is any amount ending in 4 (1,004円 せんよえん).
      return one(last === 4 ? readNumber(n).replace(/よん$/, 'よ') + ' えん' : readNumber(n) + ' えん');
    case 'ji': {
      if (n < 1 || n > 24) throw new RangeError(`hour ${n}`);
      const special = { 4: 'よじ', 7: 'しちじ', 9: 'くじ' };
      return one(special[last] ? tensPart(n) + special[last] : unspace(readNumber(n)) + 'じ');
    }
    case 'nin':
      if (n === 1) return one('ひとり');
      if (n === 2) return one('ふたり');
      if (last === 4) return one(tensPart(n) + 'よにん');
      if (last === 7) return one(unspace(readNumber(n)) + 'にん', tensPart(n) + 'しちにん');
      return one(unspace(readNumber(n)) + 'にん');
    case 'tsu':
      // Native numbers stop at 10; past that it's the plain number.
      return one(n >= 1 && n <= 10 ? NATIVE[n] : readNumber(n));
    case 'mai':
      return one(unspace(readNumber(n)) + 'まい');
    case 'bansen':
      return one(unspace(readNumber(n)) + 'ばんせん');
    default: {
      // hon, hai, kai, haku, fun: the last digit decides. 1–99 only; past
      // that the hundreds change too (百本 ひゃっぽん) and nothing drills it.
      if (n < 1 || n > 99) throw new RangeError(`${counter} ${n}`);
      const head = last === 0 ? (n >= 20 ? DIGIT[n / 10] : '') : tensPart(n);
      const alt = SOUND_ALSO[last]?.[counter];
      return alt ? one(unspace(head) + SOUND[counter][last], unspace(head) + alt) : one(unspace(head) + SOUND[counter][last]);
    }
  }
}

// A clock time. style '12' says it the way people do (ごご さんじ…);
// '24' reads the 24-hour figure, as on timetables and announcements.
// :30 is はん first; さんじゅっぷん is also right.
export function timeReading(h, m, style = '12') {
  if (!(h >= 0 && h <= 23 && m >= 0 && m <= 59)) throw new RangeError(`time ${h}:${m}`);
  // 12-hour: noon is ごご じゅうにじ, midnight ごぜん れいじ.
  const hr = style === '12' ? (h % 12 || (h === 12 ? 12 : 0)) : h;
  const hour = hr === 0 ? 'れいじ' : spacedReading(hr, 'ji')[0];
  const mins = m === 0 ? [''] : m === 30 ? ['はん', ...spacedReading(30, 'fun')] : spacedReading(m, 'fun');
  const prefix = style === '12' ? (h < 12 ? 'ごぜん ' : 'ごご ') : '';
  return finish(mins.map((mk) => `${prefix}${hour}${mk ? ' ' + mk : ''}`));
}

export function formatTime(h, m, style = '12') {
  const mm = String(m).padStart(2, '0');
  if (style === '24') return `${h}:${mm}`;
  return `${h % 12 || 12}:${mm} ${h < 12 ? 'am' : 'pm'}`;
}

export const formatYen = (n) => `¥${n.toLocaleString('en-US')}`;

const pick = (rng, xs) => xs[Math.floor(rng() * xs.length)];
const int = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

// Menu and konbini prices: ¥120–¥3,980, mostly ending in 0, 80 or 90.
// One in five is forced to have an irregular 300/600/800/3000/8000 or the
// regular 6000 (to catch ろっせん), and one in twenty is over ¥10,000 for
// hotels and train tickets.
export function genPrice(rng = Math.random) {
  const roll = rng();
  if (roll < 0.2) {
    const lead = pick(rng, [3, 6, 8]);
    if (rng() < 0.5) return lead * 100 + pick(rng, [0, 20, 50, 80, 90]);
    return lead * 1000 + int(rng, 0, 9) * 100 + pick(rng, [0, 0, 50, 80]);
  }
  if (roll < 0.25) return int(rng, 10, 29) * 1000 + int(rng, 0, 9) * 100;
  const hundreds = int(rng, 1, 39);
  const end = pick(rng, [0, 0, 80, 80, 90, 90, 50, 20, 60, 40]);
  return Math.max(120, hundreds * 100 + end);
}

export const DRILL_MODES = ['price', 'time', 'counter', 'platform'];

// Counters a drill can ask for, with the range that comes up on a trip.
const DRILL_COUNTERS = { nin: [1, 8], tsu: [1, 10], hon: [1, 10], hai: [1, 10], mai: [1, 10], kai: [1, 10], haku: [1, 7] };

// One drill question. answer is what the learner types (digits, or H:MM
// in 24-hour time); kana is what gets spoken and revealed.
export function genDrill(mode, rng = Math.random) {
  if (mode === 'price') {
    const n = genPrice(rng);
    const r = toJapaneseReading(n, 'yen');
    return { mode, prompt: formatYen(n), answer: String(n), ...r };
  }
  if (mode === 'time') {
    const h = int(rng, 6, 23);
    // Mostly on the five-minute marks timetables use; :00 and :30 often.
    const m = rng() < 0.3 ? pick(rng, [0, 30]) : int(rng, 0, 11) * 5 + (rng() < 0.3 ? int(rng, 1, 4) : 0);
    const style = rng() < 0.75 ? '12' : '24';
    const r = timeReading(h, m, style);
    return { mode, prompt: formatTime(h, m, style), answer: `${h}:${String(m).padStart(2, '0')}`, style, ...r };
  }
  if (mode === 'counter') {
    const counter = pick(rng, Object.keys(DRILL_COUNTERS));
    const n = int(rng, ...DRILL_COUNTERS[counter]);
    const r = toJapaneseReading(n, counter);
    return { mode, counter, prompt: `${n} ${COUNTERS[counter].kanji}`, hint: COUNTERS[counter].en, answer: String(n), ...r };
  }
  if (mode === 'platform') {
    const n = int(rng, 1, 20);
    return { mode, prompt: `${n}番線`, hint: 'platform', answer: String(n), ...toJapaneseReading(n, 'bansen') };
  }
  throw new Error(`unknown drill mode ${mode}`);
}

// Full-width digits and colons, as a Japanese keyboard types them.
const narrow = (s) => String(s).replace(/[０-９：]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

// Was a typed answer right? Prices and counts compare as numbers
// (commas, ¥ and spaces ignored). Times accept 24-hour "15:45",
// "3:45 pm", and plain "3:45" — the ごご/ごぜん is part of what you hear,
// but getting the clock face right is the point of the drill.
export function checkDrill(drill, given) {
  const g = narrow(given).trim().toLowerCase();
  if (drill.mode !== 'time') {
    const digits = g.replace(/[¥,\s円]/g, '');
    return /^\d+$/.test(digits) && Number(digits) === Number(drill.answer);
  }
  const m = g.match(/^(\d{1,2})(?::|\s|\.|時)?(\d{2})?\s*(am|pm|a|p)?$/);
  if (!m) return false;
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  const [eh, em] = drill.answer.split(':').map(Number);
  if (min !== em) return false;
  if (m[3]) {
    if (h < 1 || h > 12) return false;
    h = (h % 12) + (m[3].startsWith('p') ? 12 : 0);
    return h === eh;
  }
  return h === eh || (h >= 1 && h <= 12 && h % 12 === eh % 12);
}
