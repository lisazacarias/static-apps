import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizePlan, activeCues, stateAt } from '../cues.js';
import { parseFixturesIni, pieces, showxpressShow } from '../showxpress.js';

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
  const steps = [...scenes.get(blocks[1].file).matchAll(/<Step length="([\d.]+)">/g)].map((m) => Number(m[1]));
  assert.deepEqual(steps, [0.05, 2.5, 600]);
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
