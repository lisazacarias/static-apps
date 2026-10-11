import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cueGrid, backupGrids, normalizePlan, shortColorName } from '../cues.js';
import { buildXlsx, cueWorkbook, crc32, zip } from '../xlsx.js';

const cue = (o) => ({ id: o.id || Math.random().toString(36), time: 0, end: null, lights: [], action: 'on',
  color: '#ff0000', colorName: '', level: 100, transition: 'sharp', fade: 2, othersOff: false, note: '', ...o });

// Read a stored zip back: [{ name, data }], checking every CRC on the way.
function unzip(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  assert.equal(v.getUint32(end, true), 0x06054b50, 'end of central directory');
  const n = v.getUint16(end + 10, true);
  let at = v.getUint32(end + 16, true);
  const out = [];
  for (let i = 0; i < n; i++) {
    assert.equal(v.getUint32(at, true), 0x02014b50, 'central directory entry');
    const size = v.getUint32(at + 20, true), nameLen = v.getUint16(at + 28, true), local = v.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLen));
    assert.equal(v.getUint32(local, true), 0x04034b50, `local header for ${name}`);
    const start = local + 30 + v.getUint16(local + 26, true);
    const data = bytes.subarray(start, start + size);
    assert.equal(crc32(data), v.getUint32(at + 16, true), `CRC of ${name}`);
    out.push({ name, text: new TextDecoder().decode(data) });
    at += 46 + nameLen;
  }
  return out;
}

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('zip round-trips names and contents', () => {
  const files = unzip(zip([{ name: 'a.txt', data: 'hello' }, { name: 'dir/b.xml', data: '<b>é</b>' }]));
  assert.deepEqual(files.map((f) => [f.name, f.text]), [['a.txt', 'hello'], ['dir/b.xml', '<b>é</b>']]);
});

test('buildXlsx writes every part a spreadsheet app needs, with escaped text', () => {
  const parts = unzip(buildXlsx([{ name: 'Grid: 1/2', freeze: { cols: 2, rows: 3 }, widths: [9], rows: [['a & b', { v: '<x>', style: { bold: true, fill: '#00acee' } }]] }]));
  const names = parts.map((p) => p.name);
  for (const n of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/worksheets/sheet1.xml', 'xl/styles.xml']) assert.ok(names.includes(n), n);
  const sheet = parts.find((p) => p.name === 'xl/worksheets/sheet1.xml').text;
  assert.match(sheet, /a &amp; b/);
  assert.match(sheet, /&lt;x&gt;/);
  assert.match(sheet, /topLeftCell="C4"/);
  assert.match(parts.find((p) => p.name === 'xl/workbook.xml').text, /name="Grid  1 2"/, 'illegal sheet-name characters replaced');
  assert.match(parts.find((p) => p.name === 'xl/styles.xml').text, /FF00ACEE/);
});

test('cueGrid shows each light once its row has landed', () => {
  const plan = normalizePlan({ cues: [
    cue({ time: 1, lights: [1, 2], color: '#ec1b24', transition: 'fade', fade: 2, note: 'Up in red' }),
    cue({ time: 5, lights: [2], action: 'off' }),
    cue({ time: 8, lights: [1], color: '#00acee', repeat: { bpm: 120, beats: 1, count: 4, onFrac: 1, altColor: '#fbb612' } }),
  ] });
  const g = cueGrid(plan);
  assert.deepEqual(g.map((r) => r.time), ['0:01.00', '0:05.00', '0:08.00']);
  assert.equal(g[0].how, 'fade 2s');
  assert.deepEqual(g[0].lights.slice(0, 3), [{ hex: '#ec1b24', name: 'red', level: 100 }, { hex: '#ec1b24', name: 'red', level: 100 }, null], 'shown at the end of the fade');
  assert.equal(g[0].notes, 'Up in red');
  assert.equal(g[1].lights[1], null);
  assert.match(g[2].effect, /lights 1: switch colours 4× every beat \(0\.50s\)/);
  assert.equal(g[2].lights[0].name, 'blue');
});

test('grid colour names are short', () => {
  assert.equal(shortColorName('#c0d62d'), 'lime');
  assert.equal(shortColorName('#ffffff'), 'white');
  assert.equal(shortColorName('#123456').startsWith('~'), true);
});

test('the shipped show plan exports a grid and a backup sheet', () => {
  const plan = normalizePlan(JSON.parse(readFileSync(new URL('../starter-plan.json', import.meta.url))));
  const rows = cueGrid(plan);
  assert.ok(rows.length >= 25);
  assert.ok(rows.every((r) => r.lights.length === 12));
  assert.ok(backupGrids(plan).length >= 1);
  const parts = unzip(cueWorkbook(plan));
  assert.ok(parts.some((p) => p.name === 'xl/worksheets/sheet2.xml'), 'backup tab');
});
