import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_LIGHTS, formatTime, parseTime, normalizePlan, serializePlan, stateAt,
  cueSheet, lightsLabel, encodeShare, decodeShare, nearestPreset,
} from '../cues.js';

const cue = (o) => ({ id: o.id || Math.random().toString(36), time: 0, end: null, lights: [], action: 'on',
  color: '#ff0000', colorName: '', level: 100, transition: 'sharp', fade: 2, othersOff: false, note: '', ...o });

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
      cue({ time: 12.34, lights: [3, 7, 10], color: '#2a4bff', level: 40, transition: 'fade', fade: 3, note: 'beat drop' }),
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
  assert.match(rows[0], /^1\s+0:01\.0–0:04\.0\s+11\s+100%\s+Open white #FFFFFF\s+Snap ON, snap out at end\s+ALL OTHERS OFF/);
  assert.match(rows[1], /^2\s+0:12\.3\s+All apparatus \(3,7,10\)\s+40%\s+Deep blue #2A4BFF\s+Fade ON 3s\s+beat drop/);
  assert.match(rows[2], /^3\s+0:20\.0\s+ALL \(1–12\)\s+0%\s+—\s+Snap OFF/);
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

test('intensity sets the level a cue brings lights to', () => {
  const s = stateAt([cue({ time: 0, lights: [7], level: 40 })], 1);
  assert.equal(s.lights[7].level, 0.4);
});

test('a fade between two intensities ramps from one to the other', () => {
  const cues = [
    cue({ time: 0, lights: [2], level: 100 }),
    cue({ time: 10, lights: [2], level: 20, transition: 'fade', fade: 4 }),
  ];
  assert.ok(Math.abs(stateAt(cues, 12).lights[2].level - 0.6) < 1e-9);
  assert.equal(stateAt(cues, 14).lights[2].level, 0.2);
});

test('plans saved before intensity existed load at full', () => {
  const p = normalizePlan({ cues: [{ time: 1, lights: [3] }, { time: 2, lights: [4], level: 250 }, { time: 3, lights: [5], level: 0 }] });
  assert.deepEqual(p.cues.map((c) => c.level), [100, 100, 100]);
  assert.equal(normalizePlan({ cues: [{ time: 1, lights: [3], level: 33.4 }] }).cues[0].level, 33);
});

import { barToTime, timeToBar, parseStart, parseSectionLines, sectionAt, normalizeTempo } from '../cues.js';

test('bars convert to time at the project tempo', () => {
  const t120 = { bpm: 120, beatsPerBar: 4 };
  assert.equal(barToTime(1, t120), 0);
  assert.equal(barToTime(9, t120), 16);
  assert.equal(barToTime(9, { bpm: 96, beatsPerBar: 4 }), 20);
  assert.equal(barToTime(4, { bpm: 90, beatsPerBar: 3 }), 6);
  assert.ok(Math.abs(timeToBar(barToTime(14.85, t120), t120) - 14.85) < 1e-9);
  assert.deepEqual(normalizeTempo({ bpm: 'x', beatsPerBar: 99 }), { bpm: 120, beatsPerBar: 4 });
});

test('a section start is a bar or a time', () => {
  assert.deepEqual(parseStart('b15'), { bar: 15, time: null });
  assert.deepEqual(parseStart('bar 14.85'), { bar: 14.85, time: null });
  assert.deepEqual(parseStart('20b'), { bar: 20, time: null });
  assert.deepEqual(parseStart('1:17.6'), { bar: null, time: 77.6 });
  assert.equal(parseStart('b0'), null);
  assert.equal(parseStart('soon'), null);
});

test('a pasted list becomes sections, flagging lines it cannot read', () => {
  const { sections, bad } = parseSectionLines('# from GarageBand\nb1 Theme\n\nb14.85 - Rustage intro\n0:37.4: Raven solo\nwhenever Slade');
  assert.deepEqual(sections.map((s) => [s.name, s.bar, s.time]), [
    ['Theme', 1, null], ['Rustage intro', 14.85, null], ['Raven solo', null, 37.4],
  ]);
  assert.deepEqual(bad, [6]);
  // A name starting with "b" after a time isn't a bar marker.
  assert.deepEqual(parseSectionLines('120 Battle').sections.map((x) => [x.name, x.time]), [['Battle', 120]]);
});

test('sectionAt finds the song playing, and bar sections follow tempo', () => {
  const secs = parseSectionLines('b1 A\nb11 B\n0:30 C').sections;
  const t = { bpm: 120, beatsPerBar: 4 };
  assert.equal(sectionAt(secs, t, 19.9).name, 'A');
  assert.equal(sectionAt(secs, t, 20).name, 'B');
  assert.equal(sectionAt(secs, t, 31).name, 'C');
  // Slower tempo pushes bar 11 past the 0:30 section.
  assert.equal(sectionAt(secs, { bpm: 60, beatsPerBar: 4 }, 31).name, 'C');
  assert.equal(sectionAt(secs, { bpm: 60, beatsPerBar: 4 }, 41).name, 'B');
  assert.equal(sectionAt([], t, 5), null);
});

test('sections survive export/import and head their cues on the sheet', () => {
  const plan = {
    title: '', audio: {}, tempo: { bpm: 120, beatsPerBar: 4 },
    sections: parseSectionLines('b1 Theme intro\nb11 Raven solo').sections,
    cues: [cue({ time: 2, lights: [3] }), cue({ time: 25, lights: [7] })],
  };
  const back = normalizePlan(JSON.parse(JSON.stringify(serializePlan(plan))));
  assert.deepEqual(back.sections.map((s) => s.name), ['Theme intro', 'Raven solo']);
  assert.equal(back.sections[1].bar, 11);
  const text = cueSheet(back);
  const a = text.indexOf('— Theme intro (from 0:00.0) —');
  const b = text.indexOf('— Raven solo (from 0:20.0) —');
  assert.ok(a > 0 && b > a, text);
  assert.ok(text.indexOf('0:25.0') > b);
  // Old exports with no sections still load.
  assert.deepEqual(normalizePlan({ cues: [] }).sections, []);
});
