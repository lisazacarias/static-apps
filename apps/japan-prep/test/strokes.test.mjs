import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strokeFile, strokeUrl, drawable, parseStrokes } from '../strokes.js';

// Written for this test in KanjiVG's layout (not copied from KanjiVG):
// paths out of order on purpose, one with a bad d, one without a stroke id.
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="109" height="109" viewBox="0 0 109 109">
<g id="kvg:StrokePaths_03042" style="fill:none;stroke:#000000;stroke-width:3;">
<g id="kvg:03042" kvg:element="あ">
  <path id="kvg:03042-s2" kvg:type="㇑" d="M50,20c1,10,2,40,5,60"/>
  <path id="kvg:03042-s1" kvg:type="㇐" d="M30,30c10,2,30,0,45-3"/>
  <path id="kvg:03042-s3" d="M60,40c-20,10-30,40-10,45s30-20,25-35"/>
  <path id="kvg:03042-s4" d="javascript:alert(1)"/>
  <path id="decoration" d="M0,0L1,1"/>
</g></g>
<g id="kvg:StrokeNumbers_03042" style="font-size:8;fill:#808080">
  <text transform="matrix(1 0 0 1 24.5 29.25)">1</text>
  <text transform="matrix(1 0 0 1 44.5 18.5)">2</text>
</g></svg>`;

test('file names are the code point in five lowercase hex digits', () => {
  assert.equal(strokeFile('あ'), '03042.svg');
  assert.equal(strokeFile('ア'), '030a2.svg');
  assert.equal(strokeFile('入'), '05165.svg');
  assert.ok(strokeUrl('あ').endsWith('/kanji/03042.svg'));
});

test('only kana and kanji are drawn', () => {
  assert.deepEqual(drawable('きゃ'), ['き', 'ゃ']);
  assert.deepEqual(drawable('〜行き'), ['行', 'き']);
  assert.deepEqual(drawable('コーヒー'), ['コ', 'ー', 'ヒ', 'ー']);
  assert.deepEqual(drawable('Wi-Fi'), []);
});

test('strokes come out in stroke order, unsafe or unnumbered paths dropped', () => {
  const { strokes, labels } = parseStrokes(SVG);
  assert.deepEqual(strokes.map((s) => s.n), [1, 2, 3]);
  assert.equal(strokes[0].d, 'M30,30c10,2,30,0,45-3');
  assert.deepEqual(labels, [{ x: 24.5, y: 29.25, n: 1 }, { x: 44.5, y: 18.5, n: 2 }]);
});

test('garbage in, nothing out', () => {
  assert.deepEqual(parseStrokes('not an svg'), { strokes: [], labels: [] });
});
