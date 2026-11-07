import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readNumber, toJapaneseReading as r, timeReading, genDrill, genPrice, checkDrill, DRILL_MODES, formatTime, priceParts, timeParts, PRIMER } from '../numbers.js';
import { toRomaji } from '../kana.js';

const k = (n, c) => r(n, c).kana;
// Small deterministic generator so the drill tests are repeatable.
const rng = (seed = 7) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

test('hundreds and thousands, including every irregular', () => {
  assert.equal(readNumber(100), 'ひゃく');
  assert.equal(readNumber(300), 'さんびゃく');
  assert.equal(readNumber(600), 'ろっぴゃく');
  assert.equal(readNumber(800), 'はっぴゃく');
  assert.equal(readNumber(1000), 'せん');
  assert.equal(readNumber(3000), 'さんぜん');
  assert.equal(readNumber(6000), 'ろくせん'); // not ろっせん
  assert.equal(readNumber(8000), 'はっせん');
  assert.equal(readNumber(10000), 'いちまん');
  assert.equal(readNumber(11), 'じゅういち');
  assert.equal(readNumber(40), 'よんじゅう');
  assert.equal(readNumber(97), 'きゅうじゅうなな');
});

test('the price fixtures from the notes', () => {
  assert.equal(k(1480, 'yen'), 'せんよんひゃくはちじゅうえん');
  assert.equal(k(3800, 'yen'), 'さんぜんはっぴゃくえん');
  assert.equal(k(680, 'yen'), 'ろっぴゃくはちじゅうえん');
  assert.equal(k(12600, 'yen'), 'いちまんにせんろっぴゃくえん');
  assert.equal(k(4, 'yen'), 'よえん');
  assert.equal(k(1004, 'yen'), 'せんよえん');
  assert.equal(k(9, 'yen'), 'きゅうえん');
});

test("o'clock: 4, 7 and 9 are よ, しち and く, at any ten", () => {
  assert.equal(k(4, 'ji'), 'よじ');
  assert.equal(k(7, 'ji'), 'しちじ');
  assert.equal(k(9, 'ji'), 'くじ');
  assert.equal(k(14, 'ji'), 'じゅうよじ');
  assert.equal(k(19, 'ji'), 'じゅうくじ');
  assert.equal(k(10, 'ji'), 'じゅうじ');
  assert.equal(k(12, 'ji'), 'じゅうにじ');
});

test('minutes 1–10, then the tens', () => {
  const want = ['いっぷん', 'にふん', 'さんぷん', 'よんぷん', 'ごふん', 'ろっぷん', 'ななふん', 'はっぷん', 'きゅうふん', 'じゅっぷん'];
  assert.deepEqual(want.map((_, i) => k(i + 1, 'fun')), want);
  assert.equal(k(45, 'fun'), 'よんじゅうごふん');
  assert.equal(k(30, 'fun'), 'さんじゅっぷん');
  assert.ok(r(30, 'fun').accepted.includes('さんじっぷん'));
  assert.ok(r(8, 'fun').accepted.includes('はちふん'));
});

test('times: 3:45 pm, half past, and 24-hour', () => {
  assert.equal(timeReading(15, 45).kana, 'ごごさんじよんじゅうごふん');
  assert.equal(timeReading(9, 30).kana, 'ごぜんくじはん');
  assert.ok(timeReading(9, 30).accepted.includes('ごぜんくじさんじゅっぷん'));
  assert.equal(timeReading(7, 0).kana, 'ごぜんしちじ');
  assert.equal(timeReading(12, 10).kana, 'ごごじゅうにじじゅっぷん');
  assert.equal(timeReading(15, 45, '24').kana, 'じゅうごじよんじゅうごふん');
  assert.equal(formatTime(15, 45), '3:45 pm');
  assert.equal(formatTime(0, 5), '12:05 am');
  assert.equal(formatTime(15, 5, '24'), '15:05');
});

test('people and things', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((n) => k(n, 'nin')), ['ひとり', 'ふたり', 'さんにん', 'よにん', 'ごにん']);
  assert.equal(k(14, 'nin'), 'じゅうよにん');
  assert.ok(r(7, 'nin').accepted.includes('しちにん'));
  assert.deepEqual([1, 2, 3, 4, 5, 10].map((n) => k(n, 'tsu')), ['ひとつ', 'ふたつ', 'みっつ', 'よっつ', 'いつつ', 'とお']);
  assert.equal(k(11, 'tsu'), 'じゅういち');
});

test('本 杯 階 泊 and 番線', () => {
  assert.deepEqual([1, 2, 3, 4, 6, 8, 10].map((n) => k(n, 'hon')), ['いっぽん', 'にほん', 'さんぼん', 'よんほん', 'ろっぽん', 'はっぽん', 'じゅっぽん']);
  assert.deepEqual([1, 2, 3, 6].map((n) => k(n, 'hai')), ['いっぱい', 'にはい', 'さんばい', 'ろっぱい']);
  assert.deepEqual([1, 2, 3, 4].map((n) => k(n, 'kai')), ['いっかい', 'にかい', 'さんがい', 'よんかい']);
  assert.deepEqual([1, 2, 3].map((n) => k(n, 'haku')), ['いっぱく', 'にはく', 'さんぱく']);
  assert.equal(k(1, 'bansen'), 'いちばんせん');
  assert.equal(k(3, 'bansen'), 'さんばんせん');
  assert.equal(k(11, 'hon'), 'じゅういっぽん');
  assert.equal(k(20, 'hon'), 'にじゅっぽん');
  assert.equal(k(3, 'mai'), 'さんまい');
  assert.throws(() => k(100, 'hon'), RangeError);
});

test('romaji for generated readings', () => {
  assert.equal(r(1480, 'yen').romaji, 'sen yonhyaku hachijū en');
  assert.equal(r(12600, 'yen').romaji, 'ichiman nisen roppyaku en');
  assert.equal(timeReading(15, 45).romaji, 'gogo sanji yonjūgofun');
  assert.equal(r(4, 'yen').romaji, 'yo en');
  assert.equal(toRomaji('せんよん'), "sen'yon"); // Hepburn: n' before y
  assert.equal(toRomaji('ろっぴゃく'), 'roppyaku');
  assert.equal(toRomaji('ごごさんじよんじゅうごふん'), 'gogosanjiyonjūgofun');
  assert.equal(toRomaji('じゅっぷん'), 'juppun');
  assert.equal(toRomaji('とお'), 'tō');
  assert.equal(toRomaji('せんいちえん'), "sen'ichien");
  assert.equal(toRomaji('きゅう'), 'kyū');
  assert.equal(toRomaji('しゃしん'), 'shashin');
  assert.equal(toRomaji('チェックイン'), 'chekkuin');
  assert.equal(toRomaji('コーヒー'), 'kōhī');
  assert.equal(toRomaji('ちょっと'), 'chotto');
  assert.equal(toRomaji('まっちゃ'), 'matcha');
});

test('generated prices are realistic, and about one in five is an irregular', () => {
  const g = rng(11);
  const prices = Array.from({ length: 2000 }, () => genPrice(g));
  assert.ok(prices.every((p) => Number.isInteger(p) && p >= 120 && p < 30000));
  const irregular = prices.filter((p) => /^[368]\d{2}$|^[368]\d{3}$/.test(String(p)));
  assert.ok(irregular.length / prices.length > 0.18, `irregular share ${irregular.length / prices.length}`);
  assert.ok(prices.some((p) => p >= 10000), 'some over ¥10,000');
  assert.ok(prices.some((p) => String(p).startsWith('6') && p >= 6000 && p < 7000), 'includes 6xxx');
});

test('every drill mode produces a question whose own answer checks out', () => {
  const g = rng(3);
  for (const mode of DRILL_MODES) {
    for (let i = 0; i < 200; i++) {
      const d = genDrill(mode, g);
      assert.ok(d.kana && d.prompt && d.answer, JSON.stringify(d));
      assert.ok(checkDrill(d, d.answer), `${mode} ${d.prompt} → ${d.answer}`);
      assert.ok(!/[0-9]/.test(d.kana), `spoken text has no digits: ${d.kana}`);
    }
  }
});

test('checking typed answers', () => {
  const price = { mode: 'price', answer: '1480' };
  assert.ok(checkDrill(price, '1,480'));
  assert.ok(checkDrill(price, '¥1480'));
  assert.ok(checkDrill(price, '１４８０'));
  assert.ok(!checkDrill(price, '1408'));
  assert.ok(!checkDrill(price, ''));
  const time = { mode: 'time', answer: '15:45' };
  for (const ok of ['15:45', '3:45 pm', '3:45pm', '3:45', '1545', '３：４５ pm']) assert.ok(checkDrill(time, ok), ok);
  for (const no of ['3:45 am', '15:40', '4:45', 'abc']) assert.ok(!checkDrill(time, no), no);
  assert.ok(checkDrill({ mode: 'time', answer: '9:00' }, '9'));
});

test('every drill reading breaks into parts that say what each piece means', () => {
  const g = rng(9);
  for (const mode of DRILL_MODES) {
    for (let i = 0; i < 500; i++) {
      const d = genDrill(mode, g);
      assert.ok(d.parts.length >= 1, `${mode} ${d.prompt}`);
      assert.equal(d.parts.map((p) => p.kana).join(''), d.kana, `${mode} ${d.prompt}: parts spell the reading`);
      for (const p of d.parts) assert.ok(p.means && p.romaji, `${mode} ${d.prompt}`);
    }
  }
  assert.deepEqual(priceParts(1480).map((p) => p.means), ['1,000', '400', '80', 'yen']);
  assert.deepEqual(priceParts(1004).map((p) => p.kana), ['せん', 'よ', 'えん']);
  assert.deepEqual(timeParts(15, 45).map((p) => p.means), ['pm (afternoon/evening)', "3 o'clock", '45 minutes']);
  assert.deepEqual(timeParts(9, 30).map((p) => p.means), ['am (morning)', "9 o'clock", 'half past']);
});

test('the numbers primer matches the readings the drills use', () => {
  const by = Object.fromEntries(PRIMER.map((p) => [p.shows, p.kana]));
  assert.equal(by['4'], 'よん');
  assert.equal(by['300'], 'さんびゃく');
  assert.equal(by['10,000'], 'いちまん');
  assert.equal(by['¥1,480'], r(1480, 'yen').kana);
});
