import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizePlan, activeCues, stateAt } from '../cues.js';
import { changeTimes } from '../cues.js';
import { parseFixturesIni, pieces, showxpressShow, view3dIni } from '../showxpress.js';

// Plays a timeline the way ShowXpress does: each block from its start, step
// by step (lengths in hundredths), a fade step running from the step before.
// → each light's dimmer (0–255) at time t
function play(blocks, t) {
  const b = blocks.find((x) => t >= x.start - 1e-9 && t < x.start + x.length - 1e-9) || blocks[blocks.length - 1];
  let at = b.start, prev = null;
  for (const st of b.steps) {
    const len = st.ticks / 100;
    if (t < at + len || st === b.steps[b.steps.length - 1]) {
      if (!st.fade || !prev) return st.snap.map((v) => Math.round(v[3]));
      const k = Math.min(1, (t - at) / len);
      return prev.snap.map((v, i) => v[3] + (st.snap[i][3] - v[3]) * k);
    }
    prev = st; at += len;
  }
}

const cue = (o) => ({ id: o.id || Math.random().toString(36), time: 0, end: null, lights: [], action: 'on',
  color: '#ff0000', colorName: '', level: 100, transition: 'sharp', fade: 2, othersOff: false, note: '', ...o });

// Same shape as the venue's fixtures.ini: CH1..CH13, 32 addresses apart.
const INI = Array.from({ length: 13 }, (_, i) => `[Fixture${i + 1}]\naddress = ${i * 32 + 1}\nname = CH${i + 1}: SlimPAR 56 (7CH)${i ? ` #${i + 1}` : ''}\nmodel = SlimPAR 56 (7CH)\nquantity = 1\ngroup = aa\nid = ${1000 + i}\n`).join('');

test('reads the patch and maps CHn to light n', () => {
  const f = parseFixturesIni(INI);
  assert.equal(f.length, 13);
  assert.deepEqual(f[6], { light: 7, id: '1006', name: 'CH7: SlimPAR 56 (7CH) #7', model: 'SlimPAR 56 (7CH)', address: 193 });
});

test('a held look is one scene that sets all 7 channels on all 12 lights', () => {
  const plan = normalizePlan({ cues: [cue({ time: 0, lights: [1, 2], color: '#9b72ff' })] });
  const { scenes, blocks } = showxpressShow(plan, { fixturesIni: INI, duration: 10 });
  assert.equal(blocks.length, 1);
  const xml = scenes.get(blocks[0].file);
  assert.equal((xml.match(/<Channel /g) || []).length, 12 * 7);
  // light 1: lavender, macro/shutter/mode 0, dimmer full; light 3 dark
  assert.match(xml, /<Fixture id="1000">\r\n {8}<Channel index="0" name="[a-z_]+" value="155" fade="0"\/>\r\n {8}<Channel index="1" name="[a-z_]+" value="114" fade="0"\/>\r\n {8}<Channel index="2" name="[a-z_]+" value="255" fade="0"\/>\r\n {8}<Channel index="3" name="[a-z_]+" value="0" fade="0"\/>\r\n {8}<Channel index="4" name="[a-z_]+" value="0" fade="0"\/>\r\n {8}<Channel index="5" name="[a-z_]+" value="0" fade="0"\/>\r\n {8}<Channel index="6" name="[a-z_]+" value="255" fade="0"\/>/);
  // dark is red, green and blue at 0: Revel's lights ignore the dimmer
  assert.match(xml, /<Fixture id="1002">(\r\n {8}<Channel index="\d" name="[a-z_]+" value="0" fade="0"\/>){6}\r\n {8}<Channel index="6" name="[a-z_]+" value="255"/);
  assert.ok(!xml.includes('id="1012"'), 'CH13 is not on the map, so scenes leave it alone');
});

test('a fade becomes steps that fade over exactly its length', () => {
  const plan = normalizePlan({ cues: [cue({ time: 1, lights: [1], transition: 'fade', fade: 2.5 })] });
  const { scenes, blocks, timeline } = showxpressShow(plan, { fixturesIni: INI, duration: 10 });
  // a new block starts inside the held look after the fade, clear of the fade's end
  assert.deepEqual(blocks.map((b) => [b.start, b.file]), [[0, '001 0.0s.scex'], [3.8, '002 3.8s.scex']]);
  // lengths are hundredths: dark for 1 s, fade 2.5 s, then held (padded so it never loops)
  const steps = [...scenes.get(blocks[0].file).matchAll(/<Step (?:name="[^"]*" )?length="(\d+)">/g)].map((m) => Number(m[1]));
  assert.deepEqual(steps, [100, 250, 30 + 60000]);
  assert.match(scenes.get(blocks[0].file), /fade="1"/);
  assert.match(timeline, /\[Event_2\]\r\nTimeLineIndex = 3\r\nStartTime = 0:00:03.80\r\nPath = 002 3.8s.scex\r\nLength = 0:00:06.20/);
  assert.match(timeline, /\[Event_0\]\r\nTimeLineIndex = 2\r\nStartTime = 0:00:00.00\r\nPath = Live\/music.wav/);
});

test('the show plan replays in ShowXpress the way the page shows it', () => {
  const plan = normalizePlan(JSON.parse(readFileSync(new URL('../starter-plan.json', import.meta.url))));
  const cues = activeCues(plan.cues, plan.optionPicks);
  const end = 235.31;
  const ps = pieces(cues, end);
  for (let i = 1; i < ps.length; i++) assert.ok(Math.abs(ps[i].start - ps[i - 1].end) < 1e-9, 'blocks are back to back');
  assert.equal(ps.at(-1).end, end);
  let worst = 0;
  for (let t = 0.003; t < end; t += 0.011) {
    const p = ps.find((q) => t >= q.start && t < q.end);
    const k = p.fade ? Math.min(1, (t - p.start) / p.fade) : 1;
    const st = stateAt(cues, t).lights;
    for (let l = 1; l <= 12; l++) {
      const got = p.from[l - 1][3] + (p.to[l - 1][3] - p.from[l - 1][3]) * k;
      worst = Math.max(worst, Math.abs(got - Math.round(st[l].level * 255)));
    }
  }
  assert.ok(worst <= 2, `dimmers within 2/255 of the page (worst ${worst})`);
});

test('fails loudly when the patch is missing a light', () => {
  const plan = normalizePlan({ cues: [cue({ lights: [1] })] });
  assert.throws(() => showxpressShow(plan, { fixturesIni: INI.split('[Fixture12]')[0], duration: 5 }), /CH12/);
});

test('the 3D layout hangs each light over its pool, mirror side at the back', () => {
  const ini = view3dIni(INI, { 1: [100, 100], 2: [270, 270] }, { scale: 85 });
  assert.match(ini, /\[1000\]\r\nName = CH1: SlimPAR 56 \(7CH\)\r\nPosition = -1.00,4.50,1.00\r\n/);
  assert.match(ini, /\[1001\]\r\nName = CH2: SlimPAR 56 \(7CH\) #2\r\nPosition = 1.00,4.50,-1.00\r\n/);
  assert.match(ini, /\[1012\][^[]*Position = 5.50,4.50,3.50/, 'off-map light parked in a corner');
});

test('the whole show plays from its blocks the way the page shows it', () => {
  const plan = normalizePlan(JSON.parse(readFileSync(new URL('../starter-plan.json', import.meta.url))));
  const cues = activeCues(plan.cues, plan.optionPicks);
  const { blocks } = showxpressShow(plan, { fixturesIni: INI, duration: 235.31 });
  for (const b of blocks) assert.ok(Math.abs(b.start * 10 - Math.round(b.start * 10)) < 1e-9, `${b.start} is on a tenth`);
  for (let i = 1; i < blocks.length; i++) assert.ok(Math.abs(blocks[i].start - blocks[i - 1].start - blocks[i - 1].length) < 1e-9, 'back to back');
  // every step is whole 0.05 s ticks, which ShowXpress plays exactly
  for (const b of blocks) for (const st of b.steps) assert.equal(st.ticks % 5, 0, `${b.file}: ${st.ticks} hundredths`);
  // so every light matches the page give or take a tick (0.05 s: half from
  // rounding to the grid, up to half more where a 0.04 s flash needs its tick)
  const ch = changeTimes(cues);
  const shifts = [-0.05, -0.025, 0, 0.025, 0.05];
  let worst = 0, at = 0;
  for (let t = 0.004; t < 235.3; t += 0.023) {
    if (ch.some((c) => Math.abs(c - t) < 0.055)) continue;
    const got = play(blocks, t);
    const wants = shifts.map((d) => stateAt(cues, t + d).lights);
    for (let l = 1; l <= 12; l++) {
      const e = Math.min(...wants.map((w) => Math.abs(got[l - 1] - Math.round(w[l].level * 255))));
      if (e > worst) { worst = e; at = t; }
    }
  }
  // fades land on the grid too, so a 0.22 s one plays as 0.2: mid-fade it can be ~5% off
  assert.ok(worst <= 16, `dimmers within 16/255 of the page (worst ${worst.toFixed(1)} at ${at.toFixed(3)})`);
});

test('fast runs stay on time: no drift, every switch within half a tick', () => {
  // eighths at 104.79 BPM are 0.286 s apart. ShowXpress rounds each step up
  // to 0.05 s, so written as 0.29 they drifted; on the grid they can't
  const plan = normalizePlan({ cues: [cue({ time: 1, lights: [1], repeat: { bpm: 104.79, beats: 0.5, count: 32, onFrac: 1, altColor: '#00ff00' } })] });
  const { blocks } = showxpressShow(plan, { fixturesIni: INI, duration: 12 });
  let t = blocks[0].start;
  const starts = blocks[0].steps.map((st) => { const at = t; t += st.ticks / 100; return at; }).slice(1, -1);
  starts.forEach((at, k) => assert.ok(Math.abs(at - (1 + k * 60 / 104.79 / 2)) <= 0.0251, `switch ${k + 1} at ${at.toFixed(3)}`));
});

import { showxpressPackage } from '../showxpress.js';

test('the download is one folder: an install script and the show laid out for ShowXpress', () => {
  const plan = normalizePlan({ cues: [cue({ time: 1, lights: [1] })] });
  const files = showxpressPackage(plan, { fixturesIni: INI, profile: 'Channel = red', profileName: 'SlimPAR 56 (7CH)',
    pools: { 1: [0, 0] }, audio: new Uint8Array([1, 2, 3]), duration: 5, showName: 'Teen Titans' });
  const names = files.map((f) => f.name);
  assert.ok(names.every((n) => n.startsWith('teen-titans-showxpress/')));
  for (const n of ['install.sh', 'show/fixtures.ini', 'show/fixtures/SlimPAR 56 (7CH).txt', 'show/3DView/fixtures.ini',
    'show/Live/TimeLine/timelines/Teen Titans.tml', 'show/Live/music.mp3', 'show/scenes/001 0.0s.scex']) {
    assert.ok(names.includes(`teen-titans-showxpress/${n}`), n);
  }
  const sh = files.find((f) => f.name.endsWith('install.sh')).data;
  assert.match(sh, /DEST="\$SHOWS\/Teen Titans"/);
  assert.match(sh, /pgrep -f "TheLightingController.app\/Contents\/MacOS"/, 'refuses to run while ShowXpress is open');
  assert.match(sh, /rm -rf "\$DEST\/scenes"/, 'old scenes go before the new ones land');
});

test('install.sh comes out of the zip runnable', async () => {
  const { zip } = await import('../xlsx.js');
  const bytes = zip([{ name: 'a/install.sh', data: '#!/bin/bash\n', executable: true }, { name: 'a/x.txt', data: 'x' }]);
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = v.getUint32(bytes.length - 22 + 16, true);
  const modes = [];
  for (let i = 0; i < 2; i++) {
    modes.push((v.getUint32(at + 38, true) >>> 16) & 0o777);
    at += 46 + v.getUint16(at + 28, true);
  }
  assert.deepEqual(modes, [0o755, 0], 'only the script is marked; other files keep the old plain entry');
});

test('a long fade split across blocks carries on without a jump', () => {
  // Slade-style: overlapping slow fades and no held look, so blocks split mid-fade
  const plan = normalizePlan({ cues: [
    cue({ time: 0, lights: [1, 2], level: 60 }),
    cue({ time: 0.5, lights: [1], level: 100, transition: 'fade', fade: 2, repeat: { bpm: 26, beats: 2, count: 4, onFrac: 0.5, dimTo: 20 }, outFade: 2.3 }),
    cue({ time: 1.3, lights: [2], level: 100, transition: 'fade', fade: 2, repeat: { bpm: 26, beats: 2, count: 4, onFrac: 0.5, dimTo: 20 }, outFade: 2.3 }),
  ] });
  const cues = activeCues(plan.cues);
  const { blocks } = showxpressShow(plan, { fixturesIni: INI, duration: 20 });
  assert.ok(blocks.length >= 3, 'long fades still get split into blocks');
  for (const b of blocks.slice(1)) {
    const before = play(blocks, b.start - 0.001), after = play(blocks, b.start + 0.001);
    assert.ok(before.every((v, i) => Math.abs(v - after[i]) < 2), `no jump at ${b.start}`);
    const want = stateAt(cues, b.start).lights;
    assert.ok([1, 2].every((l) => Math.abs(after[l - 1] - want[l].level * 255) < 2), `matches the page at ${b.start}`);
  }
});

test('block edges stay clear of snaps, so a flash never lands right at one', () => {
  const plan = normalizePlan(JSON.parse(readFileSync(new URL('../starter-plan.json', import.meta.url))));
  const cues = activeCues(plan.cues, plan.optionPicks);
  const { blocks } = showxpressShow(plan, { fixturesIni: INI, duration: 235.31 });
  // a snap: the page jumps between two instants a hundredth apart
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const jump = (t) => { const a = stateAt(cues, t - 0.003).lights, b = stateAt(cues, t + 0.003).lights; return [1,2,3,4,5,6,7,8,9,10,11,12].some((l) => Math.abs(a[l].level - b[l].level) > 0.2 || (a[l].level > 0.02 && rgb(a[l].color).some((v, i) => Math.abs(v - rgb(b[l].color)[i]) > 60))); };
  const snaps = changeTimes(cues).filter(jump);
  const tight = blocks.slice(1).map((b) => [b.start, Math.min(...snaps.map((c) => Math.abs(c - b.start)))]).filter(([, r]) => r < 0.25);
  assert.equal(tight.length, 0, `edges close to a snap: ${tight.map(([t, r]) => `${t}s (${r.toFixed(2)})`).join(', ')}`);
  assert.ok(Math.max(...blocks.map((b) => b.length)) <= 16.5, 'no block longer than about 16 s');
});

import { timingTest } from '../showxpress.js';

test('the timing test flips the stage 40 times, then turns it white on schedule', () => {
  const files = timingTest(INI);
  const slow = files.find((f) => f.name.endsWith('slow.scex')).data, fast = files.find((f) => f.name.endsWith('fast.scex')).data;
  assert.equal((slow.match(/<Step (?:name="[^"]*" )?length="25">/g) || []).length, 40, '40 × 0.25 s: white at 10.0 s');
  assert.equal((fast.match(/<Step (?:name="[^"]*" )?length="7">/g) || []).length, 40, '40 × 0.07 s: white 2.8 s in');
  assert.match(files.find((f) => f.name.endsWith('.tml')).data, /StartTime = 0:00:13.00\r\nPath = timing test fast.scex/);
});

import { starterPackage } from '../showxpress.js';

test('the Revel starter sets every channel of all 13 lights and never installs over scenes', () => {
  const ini = readFileSync(new URL('../venue/fixtures.ini', import.meta.url), 'utf8');
  const files = starterPackage({ fixturesIni: ini, profile: 'Channel = red', profileName: 'SlimPAR 56 (7CH)', pools: { 1: [0, 0], 7: [100, 100] } });
  const names = files.map((f) => f.name);
  assert.ok(names.every((n) => n.startsWith('revel-showxpress-starter/')));
  for (const n of ['install.sh', 'show/fixtures.ini', 'show/fixtures/SlimPAR 56 (7CH).txt', 'show/3DView/fixtures.ini',
    'show/scenes/00 blackout.scex', 'show/scenes/03 find each light.scex', 'show/Live/TimeLine/timelines/Timing test.tml']) {
    assert.ok(names.includes(`revel-showxpress-starter/${n}`), n);
  }
  const scene = (n) => files.find((f) => f.name.endsWith(`${n}.scex`)).data;
  const black = scene('00 blackout');
  assert.equal((black.match(/<Fixture id="\d+">/g) || []).length, 13, 'CH13 too');
  assert.equal((black.match(/<Channel /g) || []).length, 13 * 7);
  assert.ok(!/index="[0-5]" name="[a-z_]+" value="[1-9]/.test(black), 'red, green, blue, macro, shutter and mode at zero');
  const find = scene('03 find each light');
  assert.equal((find.match(/<Step (?:name="[^"]*" )?length="200">/g) || []).length, 13, 'one light at a time, 2 s each');
  assert.equal((find.match(/index="0" name="[a-z_]+" value="255"/g) || []).length, 13, 'one light lit per step');
  const sh = files.find((f) => f.name.endsWith('install.sh'));
  assert.ok(sh.executable);
  assert.match(sh.data, /\[ -e "\$DEST\/\$rel" \] \|\| cp/, 'starter scenes only fill gaps');
  assert.doesNotMatch(sh.data, /rm -rf/);
});

import { rgbOut } from '../showxpress.js';

test('brightness goes out on red, green and blue, since Revel only listens to those', () => {
  const plan = normalizePlan({ cues: [cue({ time: 0, lights: [1], color: '#ffd9a0', level: 55 })] });
  const { scenes, blocks } = showxpressShow(plan, { fixturesIni: INI, duration: 10 });
  const xml = scenes.get(blocks[0].file);
  const ch = (id, i) => Number(xml.match(new RegExp(`<Fixture id="${id}">(?:\\r\\n {8}<Channel[^>]*>){${i}}\\r\\n {8}<Channel index="${i}" name="[a-z_]+" value="(\\d+)"`))[1]);
  assert.deepEqual([0, 1, 2].map((i) => ch(1000, i)), [140, 119, 88], 'warm white at 55%');
  assert.equal(ch(1000, 6), 255, 'dimmer held at full for rigs where it works');
  assert.deepEqual(rgbOut([255, 217, 160, 0]), [0, 0, 0], 'a dark light sends no colour');
});

import { dimmerTest } from '../showxpress.js';

test('the old dimmer behaviour is still there to switch back to', () => {
  const plan = normalizePlan({ cues: [cue({ time: 0, lights: [1], color: '#ffd9a0', level: 55 })] });
  const { scenes, blocks } = showxpressShow(plan, { fixturesIni: INI, duration: 10, brightness: 'dimmer' });
  assert.match(scenes.get(blocks[0].file), /<Fixture id="1000">\r\n {8}<Channel index="0" name="[a-z_]+" value="255"[^]*?<Channel index="6" name="[a-z_]+" value="140"/);
});

test('the dimmer test fades the dimmer alone, then red, green and blue alone', () => {
  const [scene, tml] = dimmerTest(INI);
  const steps = scene.data.split('<Step ').slice(1);
  assert.equal(steps.length, 6);
  const first = (st, i) => Number(st.match(new RegExp(`index="${i}" name="[a-z_]+" value="(\\d+)"`))[1]);
  assert.deepEqual([0, 6].map((i) => first(steps[1], i)), [255, 0], 'dimmer to 0, red left at full');
  assert.deepEqual([0, 6].map((i) => first(steps[4], i)), [0, 255], 'red to 0, dimmer left at full');
  assert.equal((steps[0].match(/<Fixture id=/g) || []).length, 13, 'CH13 too');
  assert.match(tml.data, /Path = dimmer test.scex/);
});

import { revelColor, colorTest } from '../showxpress.js';

test('Revel gets saturated colours: Quan\'s purple and orange, whites left alone', () => {
  assert.deepEqual(revelColor('#9b72ff'), [51, 0, 255], 'lavender is Quan\'s 27,0,136, at full');
  assert.deepEqual(revelColor('#FBB612'), [255, 114, 0], 'orange is Quan\'s');
  assert.deepEqual(revelColor('#ffd9a0'), [255, 217, 160], 'warm white stays white');
  assert.deepEqual(revelColor('#ffffff'), [255, 255, 255]);
  assert.deepEqual(revelColor('#2ad8ff'), [0, 208, 255], 'anything else: the white part taken out');
});

test('the export sends the venue colour, scaled by level', () => {
  const plan = normalizePlan({ cues: [cue({ time: 0, lights: [1], color: '#fbb612', level: 50 })] });
  const { scenes, blocks } = showxpressShow(plan, { fixturesIni: INI, duration: 10, color: revelColor });
  assert.match(scenes.get(blocks[0].file), /<Fixture id="1000">\r\n {8}<Channel index="0" name="red" value="128"[^/]*\/>\r\n {8}<Channel index="1" name="green" value="57"[^/]*\/>\r\n {8}<Channel index="2" name="blue" value="0"/);
});

test('scenes are named for their section and steps for their cues', () => {
  const plan = normalizePlan({
    sections: [{ name: 'Intro', time: 0 }, { name: 'Raven solo', time: 3 }],
    cues: [cue({ id: 'warm', time: 0, lights: [1] }), cue({ id: 'solo-pole', time: 3.8, lights: [7], color: '#ffd9a0' })],
  });
  const { scenes, blocks } = showxpressShow(plan, { fixturesIni: INI, duration: 10 });
  assert.equal(blocks[0].file, '001 Intro 0.0s.scex');
  assert.match(blocks[1].file, /^002 Raven solo \d+\.\ds\.scex$/);
  assert.match([...scenes.values()].join(''), /<Step name="0:03.80 (snap|block starts): solo-pole" length=/);
});

test('the colour test shows each colour as the page has it, then as Revel gets it', () => {
  const [scene, tml] = colorTest(INI);
  assert.match(scene.data, /<Step name="lavender: page" length="300">[^]*?name="red" value="155"/);
  assert.match(scene.data, /<Step name="lavender: Revel" length="300">[^]*?name="red" value="51"/);
  assert.match(tml.data, /Path = colour test.scex/);
  assert.match(scene.data, /<Step name="light purple: Revel"/, 'light purple has its own name');
});

test('a crossfade between saturated colours keeps its brightness halfway', () => {
  const plan = normalizePlan({ cues: [
    cue({ time: 0, lights: [1], color: '#9b72ff' }),
    cue({ time: 1, lights: [1], color: '#c0d62d', transition: 'fade', fade: 0.4 }),
  ] });
  const { scenes, blocks } = showxpressShow(plan, { fixturesIni: INI, duration: 5, color: revelColor });
  const xml = [...scenes.values()].join('');
  // a halfway step lifted to full: lavender 51,0,255 and lime 100,255,0 meet near 76,128,128 → scaled to 255
  const mids = [...xml.matchAll(/<Fixture id="1000">\r\n {8}<Channel index="0" name="red" value="(\d+)"[^>]*>\r\n {8}<Channel index="1" name="green" value="(\d+)"[^>]*>\r\n {8}<Channel index="2" name="blue" value="(\d+)"/g)]
    .map((m) => m.slice(1).map(Number)).filter(([r, g, b]) => g > 0 && b > 0);
  assert.ok(mids.length >= 1, 'a halfway step');
  assert.ok(mids.every((v) => Math.max(...v) >= 240), `halfway at full brightness: ${JSON.stringify(mids)}`);
});

test('a lead-in puts that much blackout before the song and the lights', () => {
  const plan = normalizePlan({ cues: [cue({ time: 0, lights: [1] }), cue({ time: 3.8, lights: [2] })] });
  const { scenes, timeline } = showxpressShow(plan, { fixturesIni: INI, duration: 10, lead: 5 });
  assert.match(timeline, /\[Event_0\]\r\nTimeLineIndex = 2\r\nStartTime = 0:00:05.00\r\nPath = Live\/music.wav/);
  assert.match(timeline, /\[Event_1\]\r\nTimeLineIndex = 3\r\nStartTime = 0:00:00.00\r\nPath = 000 blackout before the show.scex\r\nLength = 0:00:05.00/);
  assert.match(timeline, /\[Event_2\]\r\nTimeLineIndex = 3\r\nStartTime = 0:00:05.00\r\nPath = 001 0.0s.scex/);
  assert.match(timeline, /MaxTime = 0:00:15/);
  assert.ok(!/name="(red|green|blue)" value="[1-9]/.test(scenes.get('000 blackout before the show.scex')), 'all dark');
});

test('a snap overtaken within half a tick is dropped rather than flashed', () => {
  const plan = normalizePlan({ cues: [
    cue({ time: 0, lights: [1], color: '#ffffff' }),
    cue({ id: 'orange', time: 1.24, lights: [1], color: '#fbb612' }),
    cue({ id: 'white', time: 1.26, lights: [1], color: '#ffffff', end: 1.36 }),
  ] });
  const { scenes } = showxpressShow(plan, { fixturesIni: INI, duration: 5 });
  const xml = [...scenes.values()].join('');
  assert.ok(!/0:01.24 snap: orange/.test(xml), 'no orange blip');
  const steps = [...xml.matchAll(/<Step name="([^"]*)" length="(\d+)"/g)].map((m) => [m[1], +m[2]]);
  const white = steps.find(([n]) => n.includes('white'));
  assert.equal(white[1], 10, 'the white flash keeps its 0.1 s');
});

test('a crossfade mixes the venue colours, never a pastel in between', () => {
  // pink to light purple, with a second light changing a hundredth later so
  // a step boundary lands mid-fade (as in Starfire's solo)
  const plan = normalizePlan({ cues: [
    cue({ time: 0, lights: [1, 2], color: '#ff8fc8', level: 55 }),
    cue({ time: 1, lights: [1], color: '#b79cff', level: 55, transition: 'fade', fade: 0.16 }),
    cue({ time: 1.01, lights: [2], color: '#b79cff', level: 55, transition: 'fade', fade: 0.16 }),
  ] });
  const { scenes } = showxpressShow(plan, { fixturesIni: INI, duration: 5, color: revelColor });
  const greens = [...[...scenes.values()].join('').matchAll(/<Fixture id="100[01]">\r\n[^\n]*\n {8}<Channel index="1" name="green" value="(\d+)"/g)].map((m) => +m[1]);
  assert.ok(greens.length > 2);
  assert.deepEqual([...new Set(greens)], [0], 'pink and light purple have no green, nor does anything between them');
});

test('with a Revel act, install.sh files the show the way Revel does', () => {
  const plan = normalizePlan({ cues: [cue({ time: 1, lights: [1] })] });
  const files = showxpressPackage(plan, { fixturesIni: INI, profile: 'Channel = red', profileName: 'SlimPAR 56 (7CH)',
    pools: { 1: [0, 0] }, audio: new Uint8Array([1]), duration: 5, showName: 'Teen Titans', lead: 5, revelAct: 'LisaDorothy_TeenTitans' });
  const get = (n) => files.find((f) => f.name === `teen-titans-showxpress/${n}`);
  const sh = get('install.sh').data, tml = get('revel/LisaDorothy_TeenTitans.tml').data;
  assert.match(sh, /SHOW="\$HOME\/TheLightingController\/LightShows\/default"/);
  assert.match(sh, /SCENES="\$SHOW\/scenes\/Heroes & Villains Scenes\/\$ACT"/);
  assert.match(sh, /rm -rf "\$SCENES"/, 'only its own scene folder is replaced');
  assert.doesNotMatch(sh, /(cp|ditto|>)[^\n]*(fixtures|3DView)/, "Revel's patch and layout are left alone");
  assert.match(sh, /for ID in 1000 1001 [^\n]*1012; do grep -q "id = \$ID" "\$SHOW\/fixtures.ini"/, 'warns if the patch has other ids');
  assert.ok(get('install-on-my-mac.sh').executable, 'the separate show is still there for home');
  assert.doesNotMatch(sh, /sed /, 'the timeline is written by bash itself (sed left none on the studio laptop)');
  assert.match(sh, /printf '%s\\n' "\$\{LINE\/\/__HOME__\/\$HOME\}"/);
  assert.match(sh, /grep -q "Path = STOP" "\$TIMELINES\/\$ACT.tml"/, 'checks the timeline landed in full');
  assert.ok(!sh.includes('\r'), 'no stray carriage returns in the script');
  assert.match(tml, /Path = __HOME__\/Desktop\/Revel Room\/Heroes & Villains Music\/LisaDorothy_TeenTitans.wav/);
  assert.match(tml, /Path = Heroes & Villains Scenes\/LisaDorothy_TeenTitans\/001 0.0s.scex/);
  assert.match(tml, /Path = STOP\r\n$/);
});
