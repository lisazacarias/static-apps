import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_LIGHTS, formatTime, parseTime, normalizePlan, serializePlan, stateAt,
  cueSheet, lightsLabel, encodeShare, decodeShare, nearestPreset, normalizeCue, colorLabel,
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

import { diffPlans, applyMerge } from '../cues.js';

function twoCopies() {
  const base = normalizePlan({
    title: 'Showcase', tempo: { bpm: 120, beatsPerBar: 4 },
    sections: [{ id: 's1', name: 'Raven solo', bar: 19.68 }],
    cues: [
      { id: 'a', time: 1, lights: [3], updatedAt: 100 },
      { id: 'b', time: 5, lights: [7], updatedAt: 100 },
      { id: 'c', time: 9, lights: [10], updatedAt: 100 },
    ],
  });
  const mine = structuredClone(base);
  const theirs = structuredClone(base);
  return { mine, theirs };
}

test('merge: untouched, added on each side, and edited cues', () => {
  const { mine, theirs } = twoCopies();
  mine.cues.find((c) => c.id === 'b').color = '#ff0000';           // I edited b, earlier
  mine.cues.find((c) => c.id === 'b').updatedAt = 200;
  theirs.cues.find((c) => c.id === 'b').level = 50;                 // they edited b, later
  theirs.cues.find((c) => c.id === 'b').updatedAt = 300;
  mine.cues.push(normalizeCue({ id: 'm', time: 2, lights: [1] }));   // mine only
  theirs.cues.push(normalizeCue({ id: 't', time: 3, lights: [2] })); // theirs only
  theirs.cues = theirs.cues.filter((c) => c.id !== 'c');             // they deleted c

  const d = diffPlans(mine, theirs);
  const by = Object.fromEntries(d.items.filter((i) => i.kind === 'cue').map((i) => [i.id, i]));
  assert.equal(by.a.status, 'same');
  assert.equal(by.b.status, 'differ');
  assert.equal(by.b.pick, 'theirs', 'newer edit is the default');
  assert.equal(by.c.status, 'mine-only');
  assert.equal(by.m.status, 'mine-only');
  assert.equal(by.t.status, 'theirs-only');

  const merged = applyMerge(mine, theirs, d);
  assert.deepEqual(merged.cues.map((c) => c.id), ['a', 'm', 't', 'b', 'c']);
  assert.equal(merged.cues.find((c) => c.id === 'b').level, 50);

  // Accept their deletion of c, keep my version of b.
  const merged2 = applyMerge(mine, theirs, d, { c: 'drop', b: 'mine' });
  assert.deepEqual(merged2.cues.map((c) => c.id), ['a', 'm', 't', 'b']);
  assert.equal(merged2.cues.find((c) => c.id === 'b').color, '#ff0000');
});

test('merge: sections, title and tempo', () => {
  const { mine, theirs } = twoCopies();
  theirs.sections[0].bar = 19.75;
  theirs.sections[0].updatedAt = 500;
  theirs.tempo = { bpm: 100, beatsPerBar: 4 };
  theirs.title = 'Showcase v2';
  const d = diffPlans(mine, theirs);
  const sec = d.items.find((i) => i.kind === 'section');
  assert.equal(sec.status, 'differ');
  assert.equal(sec.pick, 'theirs');
  assert.deepEqual(d.settings.map((s) => [s.key, s.pick]), [['title', 'mine'], ['tempo', 'mine']]);
  const merged = applyMerge(mine, theirs, d, { tempo: 'theirs' });
  assert.equal(merged.sections[0].bar, 19.75);
  assert.equal(merged.tempo.bpm, 100);
  assert.equal(merged.title, 'Showcase');
});

test('merge: identical copies change nothing', () => {
  const { mine, theirs } = twoCopies();
  const d = diffPlans(mine, theirs);
  assert.deepEqual(d.counts, { same: 4, differ: 0, 'mine-only': 0, 'theirs-only': 0 });
  assert.deepEqual(d.settings, []);
  assert.deepEqual(applyMerge(mine, theirs, d).cues, mine.cues);
});

test('edit stamps survive export/import; old files load as 0', () => {
  const p = normalizePlan({ cues: [{ id: 'x', time: 1, lights: [1], updatedAt: 1234 }, { time: 2, lights: [2] }] });
  assert.deepEqual(p.cues.map((c) => c.updatedAt), [1234, 0]);
  const back = normalizePlan(JSON.parse(JSON.stringify(serializePlan(p))));
  assert.equal(back.cues[0].updatedAt, 1234);
});

test('merge offers a title the other copy cleared', () => {
  const d = diffPlans({ title: 'Showcase', cues: [] }, { title: '', cues: [] });
  assert.deepEqual(d.settings.map((x) => [x.key, x.mine, x.theirs, x.pick]), [['title', 'Showcase', '', 'mine']]);
});

test('duplicate section ids (or ones clashing with a cue) are renumbered', () => {
  const p = normalizePlan({
    cues: [{ id: 'x', time: 1, lights: [1] }],
    sections: [{ id: 'x', name: 'A', time: 0 }, { id: 's', name: 'B', time: 5 }, { id: 's', name: 'C', time: 9 }],
  });
  const ids = [...p.cues, ...p.sections].map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(p.cues[0].id, 'x');
  assert.deepEqual(p.sections.map((s) => s.name), ['A', 'B', 'C']);
});

import { flashTimes, flashEnd, fitTaps, normalizeRepeat, flashesPerSecond } from '../cues.js';

const battle = () => normalizeCue({
  id: 'run', time: '2:44.81', lights: [3, 7, 10], color: '#ff2a2a',
  repeat: { bpm: 96.4, beats: 1, count: 16, onFrac: 0.5, altColor: '#2a4bff' },
});

test('a flash run fires on the beat grid', () => {
  const c = battle();
  const ts = flashTimes(c);
  assert.equal(ts.length, 16);
  assert.equal(ts[0], 164.81);
  assert.ok(Math.abs(ts[1] - ts[0] - 60 / 96.4) < 1e-9);
  assert.ok(Math.abs(ts[15] - (164.81 + 15 * 60 / 96.4)) < 1e-9);
  assert.ok(Math.abs(flashEnd(c) - (ts[15] + 0.5 * 60 / 96.4)) < 1e-9);
});

test('flashes go on, off between, and alternate colour', () => {
  const c = battle();
  const gap = 60 / 96.4;
  const at = (t) => stateAt([c], t).lights[3];
  assert.equal(at(164.80).level, 0, 'dark before the run');
  assert.equal(at(164.82).level, 1);
  assert.equal(at(164.82).color, '#ff2a2a');
  assert.equal(at(164.81 + gap * 0.6).level, 0, 'off in the second half of the gap');
  assert.equal(at(164.81 + gap + 0.01).color, '#2a4bff', 'second flash uses the alternate');
  assert.equal(at(164.81 + 2 * gap + 0.01).color, '#ff2a2a');
  assert.equal(at(flashEnd(c) + 0.01).level, 0, 'dark after the last flash');
});

test('held flashes stay lit; others-off only clears at the start', () => {
  const c = normalizeCue({ time: 10, lights: [2], othersOff: true, repeat: { bpm: 120, beats: 1, count: 4, onFrac: 1 } });
  const before = normalizeCue({ time: 0, lights: [11] });
  const after = normalizeCue({ time: 10.75, lights: [11] });
  const s = (t) => stateAt([before, c, after], t).lights;
  assert.equal(s(10.4)[2].level, 1, 'held through the gap');
  assert.equal(s(10.1)[11].level, 0, 'others off at the first flash');
  assert.equal(s(11.2)[11].level, 1, 'a later cue is not undone by later flashes');
});

test('repeat normalises, drops End, and Off cues cannot flash', () => {
  assert.equal(normalizeRepeat({ bpm: 10, count: 4 }), null);
  assert.equal(normalizeRepeat({ bpm: 120, count: 1 }), null);
  assert.deepEqual(normalizeRepeat({ bpm: '96.4', count: '16', beats: 3, onFrac: 2, altColor: 'nope' }),
    { bpm: 96.4, beats: 1, count: 16, onFrac: 0.5, altColor: null, dimTo: 0 });
  const c = normalizeCue({ time: 1, end: 5, lights: [1], repeat: { bpm: 120, count: 4 } });
  assert.equal(c.end, null);
  assert.equal(normalizeCue({ time: 1, lights: [1], action: 'off', repeat: { bpm: 120, count: 4 } }).repeat, null);
  assert.equal(normalizeCue({ time: 1, end: 5, lights: [1] }).end, 5);
  assert.equal(normalizeCue({ time: 1, lights: [1] }).repeat, null, 'old cues have no repeat');
  assert.ok(flashesPerSecond({ bpm: 165, beats: 0.5 }) > 3);
});

test('a flash run round-trips, merges as one item, and spells out on the sheet', () => {
  const plan = { title: '', audio: {}, cues: [battle()] };
  const back = normalizePlan(JSON.parse(JSON.stringify(serializePlan(plan))));
  assert.deepEqual(back.cues[0].repeat, battle().repeat);
  const theirs = structuredClone(back);
  theirs.cues[0].repeat.count = 8;
  const d = diffPlans(back, theirs);
  assert.equal(d.items.find((i) => i.id === 'run').status, 'differ');
  const text = cueSheet(back);
  assert.match(text, /Flash ×16, every beat at 96\.4 BPM \(0\.622s apart\), on for 50% of the gap/);
  assert.match(text, /Red #FF2A2A \/ Deep blue #2A4BFF alternating/);
  assert.match(text, /flashes at 2:44\.81  2:45\.43/);
  assert.equal((text.match(/\d:\d\d\.\d\d/g) || []).length, 16);
});

test('tap tempo fits evenly spaced taps', () => {
  const taps = [10.02, 10.63, 11.27, 11.88, 12.49, 13.12];
  const f = fitTaps(taps);
  assert.ok(Math.abs(f.bpm - 96.4) < 1, f.bpm);
  assert.ok(Math.abs(f.first - 10.02) < 0.03, f.first);
  assert.equal(fitTaps([1, 2, 3]), null);
});

test('a pulse dims between flashes instead of going dark, and fades', () => {
  const c = normalizeCue({ time: 10, lights: [5], transition: 'fade', fade: 2,
    repeat: { bpm: 120, beats: 1, count: 4, onFrac: 0.5, dimTo: 35 } });
  // gap 0.5s, bright for 0.25s, fades capped to 0.225s
  const lv = (t) => stateAt([c], t).lights[5].level;
  assert.ok(Math.abs(lv(10.225) - 1) < 1e-9, 'fully up after the fade');
  assert.ok(lv(10.1) > 0 && lv(10.1) < 1, 'fading up');
  assert.ok(Math.abs(lv(10.49) - 0.35) < 1e-9, 'dimmed, not dark');
  assert.ok(Math.abs(lv(12.5) - 0.35) < 1e-9, 'rests dimmed after the run');
  assert.match(cueSheet({ cues: [c] }), /dimming to 35% between/);
  assert.equal(normalizeRepeat({ bpm: 120, count: 4 }).dimTo, 0, 'old runs still go fully off');
  assert.equal(normalizeRepeat({ bpm: 120, count: 4, dimTo: 33 }).dimTo, 0);
});

import { LOGO_COLORS, APPARATUS } from '../cues.js';

test('logo colours are named on the sheet, and the rig names the apparatus', () => {
  const c = normalizeCue({ time: 4, lights: [3], color: '#00ACEE' });
  assert.equal(colorLabel(c), 'Titans blue');
  assert.equal(LOGO_COLORS.length, 5);
  assert.deepEqual(APPARATUS, { 3: 'pole', 7: 'pole', 10: 'loops' });
  assert.match(cueSheet({ cues: [c] }), /Rig: Apparatus 3 \(pole\), 7 \(pole\), 10 \(loops\)/);
});

test('a hit snaps on and fades out over its own time', () => {
  const c = normalizeCue({ time: 10, end: 10.1, outFade: 0.5, lights: [7], color: '#c0d62d' });
  const lv = (t) => stateAt([c], t).lights[7].level;
  assert.equal(lv(10), 1, 'snaps on');
  assert.equal(lv(10.1), 1);
  assert.ok(Math.abs(lv(10.35) - 0.5) < 1e-9, 'halfway through the fade-out');
  assert.equal(lv(10.6), 0);
  assert.match(cueSheet({ cues: [c] }), /0:10\.00 .*Snap ON, fade straight out over 0\.6s/);
  const slow = normalizeCue({ time: 10, end: 14, outFade: 1, lights: [7] });
  assert.match(cueSheet({ cues: [slow] }), /0:10\.0–0:14\.0 .*Snap ON, fade out 1s at end/);
  // only kept with an End; round-trips; old cues have none
  assert.equal(normalizeCue({ time: 1, lights: [1], outFade: 2 }).outFade, null);
  assert.equal(normalizeCue({ time: 1, end: 2, lights: [1] }).outFade, null);
  const back = normalizePlan(JSON.parse(JSON.stringify(serializePlan({ cues: [c] }))));
  assert.equal(back.cues[0].outFade, 0.5);
});

import { readFileSync } from 'node:fs';

test('the shipped show plan loads cleanly', () => {
  const raw = JSON.parse(readFileSync(new URL('../starter-plan.json', import.meta.url), 'utf8'));
  const p = normalizePlan(raw);
  assert.equal(p.skipped, 0);
  assert.ok(p.cues.length >= 25);
  assert.equal(new Set(p.cues.map((c) => c.id)).size, p.cues.length);
  assert.equal(p.sections[0].name, 'Theme song intro');
  // pole 7 stays lit in lime through the Rustage hits; the hits leave it alone
  const hits = p.cues.filter((c) => c.id.startsWith('rustage-hit'));
  assert.ok(hits.every((c) => !c.lights.includes(7)));
  // the solo handoff: pole lit through the solo, loops dark until she comes in,
  // pole faded out by then, black on the thunderclap
  const at = (t) => stateAt(activeCues(p.cues, p.optionPicks), t).lights;
  for (const t of [27.6, 28.3, 29.5, 33, 36.5]) {
    assert.equal(at(t)[10].level, 0, `loops dark at ${t}`);
    assert.equal(at(t)[7].level, 1, `pole lit at ${t}`);
    assert.equal(at(t)[7].color, '#c0d62d');
  }
  assert.equal(at(60)[7].level, 1);
  assert.equal(at(60)[10].level, 0);
  assert.equal(at(100)[7].level, 0);
  assert.equal(at(100)[10].level, 1);
  assert.ok(ALL_LIGHTS.every((l) => at(117.75)[l].level === 0));
  // everyone else is lit through each solo; only the other dancer is dark
  assert.ok(ALL_LIGHTS.filter((l) => l !== 10).every((l) => at(60)[l].level === 1));
  assert.ok(ALL_LIGHTS.filter((l) => l !== 7).every((l) => at(100)[l].level === 1));
  assert.equal(at(100)[10].color, '#858ac2', 'her loops in lavender');
});

import { planSignature } from '../cues.js';

test('plan signature ignores edit stamps and audio, but not edits', () => {
  const a = normalizePlan({ title: 'T', audio: { name: 'x.mp3', duration: 1 }, cues: [{ id: 'q', time: 1, lights: [1], updatedAt: 5 }] });
  const b = structuredClone(a);
  b.cues[0].updatedAt = 999;
  b.audio = { name: 'y.mp3', duration: 200 };
  assert.equal(planSignature(a), planSignature(b));
  b.cues[0].level = 50;
  assert.notEqual(planSignature(a), planSignature(b));
});

import { activeCues, optionGroups, pickedChoice } from '../cues.js';

test('option groups: the primary plays, a pick swaps it, the sheet lists the backup', () => {
  const g = { group: 'run', label: 'Run in' };
  const cues = [
    normalizeCue({ id: 'always', time: 1, lights: [1] }),
    normalizeCue({ id: 'h1', time: 5, lights: [2], option: { ...g, choice: 'Hits', primary: true } }),
    normalizeCue({ id: 'h2', time: 6, lights: [2], option: { ...g, choice: 'Hits', primary: true } }),
    normalizeCue({ id: 'f1', time: 5, lights: [2], transition: 'fade', fade: 1, option: { ...g, choice: 'Fade' } }),
  ];
  assert.deepEqual(optionGroups(cues), [{ group: 'run', label: 'Run in', choices: ['Hits', 'Fade'], primary: 'Hits' }]);
  assert.deepEqual(activeCues(cues).map((c) => c.id), ['always', 'h1', 'h2']);
  assert.deepEqual(activeCues(cues, { run: 'Fade' }).map((c) => c.id), ['always', 'f1']);
  assert.equal(pickedChoice(cues, { run: 'Nope' }, 'run'), 'Hits', 'unknown pick falls back to the primary');
  const sheet = cueSheet({ cues });
  assert.match(sheet, /3 cues, plus backup option marked B/);
  assert.match(sheet, /BACKUP for “Run in” — if “Hits” is too much, skip cues 2–3 and run these instead \(“Fade”\)/);
  assert.match(sheet, /^B1 /m);
  const flipped = cueSheet({ cues, optionPicks: { run: 'Fade' } });
  assert.match(flipped, /if “Fade” is too much, skip cue 2 and run these instead \(“Hits”\)/);
  // round-trips with the pick, and old plans have no options
  const back = normalizePlan(JSON.parse(JSON.stringify(serializePlan({ cues, optionPicks: { run: 'Fade' } }))));
  assert.deepEqual(back.optionPicks, { run: 'Fade' });
  assert.equal(back.cues.find((c) => c.id === 'f1').option.choice, 'Fade');
  assert.equal(normalizeCue({ time: 1, lights: [1] }).option, null);
});

test('a flash run can snap up and ease out at its own speed', () => {
  const c = normalizeCue({ time: 10, lights: [1], transition: 'sharp', outFade: 0.4,
    repeat: { bpm: 120, beats: 1, count: 3, onFrac: 0.25, dimTo: 35 } });
  // gap 0.5s: snap to full on the beat, bright 0.125s, then ease to 35% over 0.4s
  const lv = (t) => stateAt([c], t).lights[1].level;
  assert.equal(lv(10), 1, 'full exactly on the beat');
  assert.equal(lv(10.12), 1);
  assert.ok(Math.abs(lv(10.325) - 0.675) < 1e-9, 'halfway down');
  assert.ok(Math.abs(lv(10.499) - (1 - 0.65 * (0.374 / 0.4))) < 1e-6);
  assert.equal(lv(10.5), 1, 'next beat snaps back up');
  assert.match(cueSheet({ cues: [c] }), /snapping up and easing out over 0\.4s/);
  assert.equal(normalizePlan(JSON.parse(JSON.stringify(serializePlan({ cues: [c] })))).cues[0].outFade, 0.4);
});
