import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, PHRASES, SIGNS, NUMBERS, MENU, KANA, directionsFor, DECKS } from '../content.js';
import { HINTS, toKatakana } from '../kana.js';
import { toJapaneseReading as r } from '../numbers.js';

test('item ids are unique and every item has what a card needs', () => {
  const ids = ITEMS.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const i of ITEMS) {
    for (const f of ['jp', 'kana', 'romaji', 'en', 'speak']) assert.ok(i[f], `${i.id} ${f}`);
    assert.ok(DECKS[i.deck], i.id);
    assert.ok(Number.isInteger(i.day) && i.day >= 0, i.id);
    assert.ok(directionsFor(i).length, i.id);
  }
});

test('the decks are the sizes the notes asked for', () => {
  assert.equal(KANA.filter((i) => i.deck === 'hira' && !i.word).length, 46 - 1 + 23 + 33 + 1); // 46 base (を counted), dakuten without ぢづ, yōon
  assert.ok(PHRASES.length >= 70, `${PHRASES.length} phrases`);
  assert.ok(SIGNS.length >= 30);
  assert.ok(MENU.length >= 40);
  assert.ok(PHRASES.filter((p) => p.star).length >= 15);
});

test('speak strings are kana only, with no 〜 left to read out', () => {
  for (const i of ITEMS) assert.match(i.speak, /^[぀-ヿ。、・ー]+$/u, `${i.id}: ${i.speak}`);
});

test('the particle は is written わ in speak strings', () => {
  const toire = PHRASES.find((p) => p.id === 'ph:toire');
  assert.equal(toire.speak, 'トイレわどこですか');
});

test('number-rule cards agree with toJapaneseReading', () => {
  const card = (id) => NUMBERS.find((n) => n.id === `num:${id}`).kana;
  for (const n of [300, 600, 800, 3000, 6000, 8000, 10000]) assert.equal(card(n), r(n).kana, n);
  assert.equal(card('4yen'), r(4, 'yen').kana);
  assert.equal(card('hours'), [4, 7, 9].map((n) => r(n, 'ji').kana).join(' / '));
  assert.equal(card('people'), [1, 2, 4].map((n) => r(n, 'nin').kana).join(' / '));
  assert.equal(card('fun'), [1, 3, 10].map((n) => r(n, 'fun').kana).join(' / '));
});

test('every look-alike hint is for a kana that exists', () => {
  const chars = new Set(KANA.map((i) => i.jp));
  for (const k of Object.keys(HINTS)) assert.ok(chars.has(k), k);
  assert.equal(toKatakana('しゃ'), 'シャ');
});

test('every card with a blank (〜) has a full example to practise', () => {
  const blanks = PHRASES.filter((p) => p.jp.includes('〜'));
  assert.equal(blanks.length, 13);
  for (const p of blanks) {
    assert.ok(p.example, `${p.id} has an example`);
    for (const f of ['jp', 'kana', 'romaji', 'en']) {
      assert.ok(p.example[f], `${p.id} example.${f}`);
      assert.ok(!/[〜~]/.test(p.example[f]), `${p.id} example.${f} has no blank: ${p.example[f]}`);
    }
    assert.match(p.example.kana, /^[぀-ヿ。、ー]+$/u, `${p.id} example kana is kana`);
    assert.ok(p.notes && !p.notes.includes('Audio example'), `${p.id} note explains the pattern`);
    // The audio says the example. speak spells は and へ the way they're
    // said (わ, え), so fold those together on both sides and compare the
    // whole sentence.
    const said = (k) => k.replace(/[、。]/g, '').replace(/は/g, 'わ').replace(/へ/g, 'え');
    assert.equal(said(p.speak), said(p.example.kana), `${p.id}: ${p.speak} vs ${p.example.kana}`);
  }
  assert.ok(!PHRASES.some((p) => !p.jp.includes('〜') && p.example), 'only blank cards get one');
});

test('no year-end content: the trip is in late January', () => {
  const all = JSON.stringify(ITEMS);
  for (const gone of ['年末年始', 'あけましておめでとうございます', '福袋', '初詣', 'new-year', '29 Dec', 'New Year']) assert.ok(!all.includes(gone), gone);
  for (const kept of ['sign:休業', 'sign:本日', 'sign:雪', 'sign:遅延', 'ph:aite', 'ph:nanji-made', 'ph:yuki-chien']) assert.ok(ITEMS.some((i) => i.id === kept), kept);
  assert.equal(PHRASES.find((p) => p.id === 'ph:aite').notes, 'Check opening hours for your specific dates.');
});

test('Japanese in notes is always tagged so it can be heard and read', () => {
  const JP = /[぀-ヿ一-鿿]/u;
  const TAG = /\{([^|{}]+)\|([^|{}]+)\|([^{}]+)\}/g;
  let tags = 0;
  for (const i of ITEMS) {
    if (!i.notes) continue;
    assert.ok(!JP.test(i.notes.replace(TAG, '')), `${i.id}: bare Japanese in "${i.notes}"`);
    for (const [, jp, say, romaji] of i.notes.matchAll(TAG)) {
      tags++;
      assert.match(say, /^[぀-ヿ、ー]+$/u, `${i.id}: spoken part is kana: ${say}`);
      assert.ok(!JP.test(romaji) && romaji.trim(), `${i.id}: romaji for ${jp}`);
    }
  }
  assert.ok(tags >= 50, `${tags} tagged words`);
  const hai = PHRASES.find((p) => p.id === 'ph:hai-iie').notes;
  assert.ok(hai.includes('{大丈夫です|だいじょうぶです|daijōbu desu}'));
});
