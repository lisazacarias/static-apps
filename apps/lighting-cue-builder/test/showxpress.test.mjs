import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizePlan, activeCues, stateAt } from '../cues.js';
import { onGrid, parseFixturesIni, pieces, showxpressShow, view3dIni } from '../showxpress.js';

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
  assert.match(xml, /<Fixture id="1000">\r\n {8}<Channel index="0" value="155" fade="0"\/>\r\n {8}<Channel index="1" value="114" fade="0"\/>\r\n {8}<Channel index="2" value="255" fade="0"\/>\r\n {8}<Channel index="3" value="0" fade="0"\/>\r\n {8}<Channel index="4" value="0" fade="0"\/>\r\n {8}<Channel index="5" value="0" fade="0"\/>\r\n {8}<Channel index="6" value="255" fade="0"\/>/);
  assert.match(xml, /<Fixture id="1002">(\r\n {8}<Channel index="\d" value="\d+" fade="0"\/>){6}\r\n {8}<Channel index="6" value="0"/);
  assert.ok(!xml.includes('id="1012"'), 'CH13 is not on the map, so scenes leave it alone');
});

test('a fade becomes a scene that fades over exactly its length', () => {
  // (with no sections the run sheet calls the one look just "Look")
  const plan = normalizePlan({ cues: [cue({ time: 1, lights: [1], transition: 'fade', fade: 2.5 })] });
  const { scenes, blocks, timeline } = showxpressShow(plan, { fixturesIni: INI, duration: 10 });
  assert.deepEqual(blocks.map((b) => [b.start, b.file]), [[0, 'Blackout.scex'], [1, 'Blackout to Look 2.5s.scex']]);
  // lengths are hundredths of a second
  const steps = [...scenes.get(blocks[1].file).matchAll(/<Step length="(\d+)">/g)].map((m) => Number(m[1]));
  assert.deepEqual(steps, [5, 245, 60000], 'the 0.05 s snap step counts toward the fade, so it still lands at 2.5 s');
  assert.match(timeline, /\[Event_2\]\r\nTimeLineIndex = 3\r\nStartTime = 0:00:01.00\r\nPath = Blackout to Look 2.5s.scex\r\nLength = 0:00:09.00/);
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

test('blocks sit on tenths, back to back, without losing a short flash', () => {
  // a 0.02 s flash that then fades out (both round to 1.0), and a 0.04 s flash on its own
  const plan = normalizePlan({ cues: [
    cue({ time: 1.02, end: 1.04, outFade: 0.5, lights: [1] }),
    cue({ time: 3.01, end: 3.05, outFade: 0, lights: [2] }),
  ] });
  const ps = onGrid(pieces(activeCues(plan.cues), 5), 5);
  for (const p of ps) assert.ok(Math.abs(p.start * 10 - Math.round(p.start * 10)) < 1e-9, `${p.start} is on a tenth`);
  for (let i = 1; i < ps.length; i++) assert.equal(ps[i].start, ps[i - 1].end, 'no gaps for the lights to drop out in');
  const at = (t) => ps.find((p) => t >= p.start && t < p.end);
  assert.equal(at(1.0).from[0][3], 255, 'the flash still snaps on at full');
  assert.equal(at(1.0).fade, 0.5, '...and still fades out over its own 0.5 s');
  assert.equal(at(3.0).to[1][3], 255, 'a 0.04 s flash gets a tenth instead of vanishing');
  assert.equal(at(3.1).to[1][3], 0);
});

import { showxpressPackage } from '../showxpress.js';

test('the download is one folder: an install script and the show laid out for ShowXpress', () => {
  const plan = normalizePlan({ cues: [cue({ time: 1, lights: [1] })] });
  const files = showxpressPackage(plan, { fixturesIni: INI, profile: 'Channel = red', profileName: 'SlimPAR 56 (7CH)',
    pools: { 1: [0, 0] }, audio: new Uint8Array([1, 2, 3]), duration: 5, showName: 'Teen Titans' });
  const names = files.map((f) => f.name);
  assert.ok(names.every((n) => n.startsWith('teen-titans-showxpress/')));
  for (const n of ['install.sh', 'show/fixtures.ini', 'show/fixtures/SlimPAR 56 (7CH).txt', 'show/3DView/fixtures.ini',
    'show/Live/TimeLine/timelines/Teen Titans.tml', 'show/Live/music.mp3', 'show/scenes/Blackout.scex']) {
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

test('a slow fade split across blocks carries on without a jump', () => {
  // two overlapping slow fades: rounding the edge between them used to step the light
  const plan = normalizePlan({ cues: [
    cue({ time: 0, lights: [1], level: 60 }),
    cue({ time: 1.03, lights: [1], level: 20, transition: 'fade', fade: 2.3 }),
    cue({ time: 2.07, lights: [2], level: 50, transition: 'fade', fade: 1 }),
  ] });
  const ps = onGrid(pieces(activeCues(plan.cues), 5), 5);
  for (let i = 1; i < ps.length; i++) {
    const p = ps[i - 1], q = ps[i];
    const k = p.fade ? Math.min(1, (p.end - p.start) / p.fade) : 1;
    const end = p.from.map((v, j) => v[3] + (p.to[j][3] - v[3]) * k);
    assert.ok(end.every((v, j) => Math.abs(v - q.from[j][3]) < 0.5), `no jump at ${q.start}`);
  }
});
