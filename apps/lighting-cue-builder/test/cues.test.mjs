import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_LIGHTS, formatTime, parseTime, normalizePlan, serializePlan, stateAt,
  cueSheet, lightsLabel, encodeShare, decodeShare, nearestPreset,
} from '../cues.js';

const cue = (o) => ({ id: o.id || Math.random().toString(36), time: 0, end: null, lights: [], action: 'on',
  color: '#ff0000', colorName: '', transition: 'sharp', fade: 2, othersOff: false, note: '', ...o });

test('time formats to hundredths and parses back', () => {
  assert.equal(formatTime(0), '0:00.00');
  assert.equal(formatTime(83.456), '1:23.46');
  assert.equal(formatTime(59.999), '1:00.00');
  assert.equal(formatTime(12.34, 1), '0:12.3');
  assert.equal(parseTime('1:23.45'), 83.45);
  assert.equal(parseTime('83.45'), 83.45);
  assert.equal(parseTime('0:05'), 5);
  assert.equal(parseTime('.5'), 0.5);
  assert.equal(parseTime('1:75'), null);
  assert.equal(parseTime('abc'), null);
  assert.equal(parseTime(''), null);
  assert.equal(parseTime(-1), null);
});

test('rig has all twelve lights exactly once', () => {
  assert.deepEqual(ALL_LIGHTS, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
});

test('everything is dark before the first cue', () => {
  const s = stateAt([cue({ time: 5, lights: [3] })], 4.99);
  assert.equal(s.activeCue, null);
  for (const l of ALL_LIGHTS) assert.equal(s.lights[l].level, 0);
});

test('sharp cue snaps on and holds', () => {
  const s = stateAt([cue({ id: 'a', time: 5, lights: [3, 7], color: '#00ff00' })], 5);
  assert.equal(s.activeCue, 'a');
  assert.equal(s.lights[3].level, 1);
  assert.equal(s.lights[3].color, '#00ff00');
  assert.equal(s.lights[1].level, 0);
});

test('fade ramps level, and colour cross-fades on a lit light', () => {
  const cues = [
    cue({ time: 0, lights: [1], color: '#ff0000' }),
    cue({ time: 10, lights: [1], color: '#0000ff', transition: 'fade', fade: 2 }),
  ];
  assert.equal(stateAt(cues, 11).lights[1].color, '#800080');
  assert.equal(stateAt(cues, 12).lights[1].color, '#0000ff');
  const up = [cue({ time: 0, lights: [2], transition: 'fade', fade: 4 })];
  assert.equal(stateAt(up, 1).lights[2].level, 0.25);
  // A dark light picks up its new colour immediately; only level fades.
  assert.equal(stateAt(up, 1).lights[2].color, '#ff0000');
});

test('all others off darkens everything not named', () => {
  const cues = [
    cue({ time: 0, lights: ALL_LIGHTS }),
    cue({ time: 3, lights: [11], color: '#ffffff', othersOff: true }),
  ];
  const s = stateAt(cues, 3);
  assert.equal(s.lights[11].level, 1);
  for (const l of ALL_LIGHTS.filter((x) => x !== 11)) assert.equal(s.lights[l].level, 0);
});

test('off cue fades a light out keeping its colour', () => {
  const cues = [
    cue({ time: 0, lights: [5], color: '#00ff00' }),
    cue({ time: 4, lights: [5], action: 'off', transition: 'fade', fade: 2 }),
  ];
  const mid = stateAt(cues, 5).lights[5];
  assert.equal(mid.level, 0.5);
  assert.equal(mid.color, '#00ff00');
  assert.equal(stateAt(cues, 6).lights[5].level, 0);
});

test('a ranged cue takes its lights out at the end', () => {
  const cues = [cue({ time: 2, end: 6, lights: [10] })];
  assert.equal(stateAt(cues, 5.9).lights[10].level, 1);
  assert.equal(stateAt(cues, 6).lights[10].level, 0);
});

test('a fade interrupted mid-way starts from where it got to', () => {
  const cues = [
    cue({ time: 0, lights: [4], transition: 'fade', fade: 4 }),
    cue({ time: 2, lights: [4], action: 'off', transition: 'fade', fade: 2 }),
  ];
  assert.equal(stateAt(cues, 2).lights[4].level, 0.5);
  assert.equal(stateAt(cues, 3).lights[4].level, 0.25);
});

test('two cues at one time: the later-entered one wins', () => {
  const cues = [cue({ time: 1, lights: [1], color: '#ff0000' }), cue({ time: 1, lights: [1], color: '#0000ff' })];
  assert.equal(stateAt(cues, 1).lights[1].color, '#0000ff');
});

test('normalizePlan cleans junk and survives a round trip', () => {
  const raw = {
    title: 'Showcase',
    audio: { name: 'track.mp3', duration: 200 },
    cues: [
      { id: 'x', time: '0:10.5', lights: [3, 3, 99, '7'], color: '#ABCDEF', transition: 'fade', fade: 1.5 },
      { id: 'x', time: 2, end: 1, lights: [1], color: 'red' },
      { time: 'nope' },
      null,
    ],
  };
  const p = normalizePlan(raw);
  assert.equal(p.cues.length, 2);
  assert.equal(p.skipped, 2);
  assert.equal(p.cues[0].time, 2);
  assert.equal(p.cues[0].end, null);
  assert.equal(p.cues[0].color, '#ffffff');
  assert.deepEqual(p.cues[1].lights, [3, 7]);
  assert.equal(p.cues[1].color, '#abcdef');
  assert.notEqual(p.cues[0].id, p.cues[1].id);
  const again = normalizePlan(JSON.parse(JSON.stringify(serializePlan(p))));
  assert.deepEqual(again.cues, p.cues);
  assert.equal(again.title, 'Showcase');
  assert.throws(() => normalizePlan({}), /cues/);
});

test('lightsLabel collapses whole groups', () => {
  assert.equal(lightsLabel([3, 7, 10]), 'All apparatus (3,7,10)');
  assert.equal(lightsLabel(ALL_LIGHTS), 'ALL (1–12)');
  assert.equal(lightsLabel([3, 7, 10, 1, 11]), 'All apparatus (3,7,10) + 1, 11');
  assert.equal(lightsLabel([]), '—');
});

test('cue sheet has aligned columns a tech can read', () => {
  const text = cueSheet({
    title: 'Showcase',
    audio: { name: 'track.mp3', duration: 125 },
    cues: [
      cue({ time: 12.34, lights: [3, 7, 10], color: '#2a4bff', transition: 'fade', fade: 3, note: 'beat drop' }),
      cue({ time: 1, end: 4, lights: [11], color: '#ffffff', othersOff: true }),
      cue({ time: 20, lights: ALL_LIGHTS, action: 'off' }),
    ],
  });
  const lines = text.split('\n');
  assert.match(lines[0], /LIGHTING CUE SHEET — Showcase/);
  assert.match(text, /Audio: track\.mp3 \(2:05\.0\)/);
  const header = lines.find((l) => l.startsWith('CUE'));
  const rows = lines.slice(lines.indexOf(header) + 2).filter(Boolean);
  assert.equal(rows.length, 3);
  assert.match(rows[0], /^1\s+0:01\.0–0:04\.0\s+11\s+Open white #FFFFFF\s+Snap ON, snap out at end\s+ALL OTHERS OFF/);
  assert.match(rows[1], /^2\s+0:12\.3\s+All apparatus \(3,7,10\)\s+Deep blue #2A4BFF\s+Fade ON 3s\s+beat drop/);
  assert.match(rows[2], /^3\s+0:20\.0\s+ALL \(1–12\)\s+—\s+Snap OFF/);
  const col = header.indexOf('COLOR');
  for (const r of rows) assert.notEqual(r[col - 1], undefined);
  assert.equal(rows[0].indexOf('Open white'), col);
});

test('custom colours are named by the nearest preset', () => {
  assert.equal(nearestPreset('#2050f0').name, 'Deep blue');
  assert.equal(nearestPreset('#fe2b2b').name, 'Red');
});

test('share token round-trips', async () => {
  const plan = { title: 'T', audio: { name: 'a.mp3', duration: 3 }, cues: [cue({ id: 'q1', time: 1.25, lights: [2, 9], note: 'hi' })] };
  const token = await encodeShare(plan);
  assert.match(token, /^[A-Za-z0-9_-]+$/);
  const back = await decodeShare(token);
  assert.equal(back.title, 'T');
  assert.deepEqual(back.cues[0].lights, [2, 9]);
  assert.equal(back.cues[0].note, 'hi');
});
