// Turns a plan into ShowXpress (The Lighting Controller V9) files: one
// scene file per look or fade, and a timeline that places them on the song.
// DOM-free, so the Node tests import it directly.
//
// The file shapes come from the demo show that ships with ShowXpress 9.2.6
// (lightshows_bank/demo_show_V9): scenes are XML (scenes/*.scex), the
// timeline is an ini file (Live/TimeLine/timelines/*.tml), and the patch is
// fixtures.ini. Things the demo show doesn't settle are marked CHECK.

import { ALL_LIGHTS, activeCues, changeTimes, hexToRgb, rgbToHex, shortColorName, stateAt, runSheet } from './cues.js';

// Channel order of the venue's SlimPAR 56 in 7-channel mode, from the
// profile the venue sent: red, green, blue, colour macro, shutter, mode,
// dimmer. Index 3–5 stay at 0: macro off, shutter open, plain RGB mode.
const SLIMPAR = { red: 0, green: 1, blue: 2, dimmer: 6, channels: 7 };

// Long enough that a held look never loops back inside a timeline block.
const HOLD = 600;
// A fade scene starts with one short snap step holding where the lights
// already are, so the fade starts from that rather than from whatever
// the desk thinks the previous scene left behind.
// CHECK: does a scene's first step fade from the live output anyway? If so,
// this step does nothing, which is harmless.
const LEAD = 0.05;

/** Reads fixtures.ini → [{ light, id, name, model, address }]. Fixture names
 *  start "CH1:", "CH2:"… and CHn is light n on the venue's map. */
export function parseFixturesIni(text) {
  const out = [];
  let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^\[Fixture\d+\]$/i.test(line)) { cur = {}; out.push(cur); continue; }
    const m = cur && line.match(/^(\w+)\s*=\s*(.*)$/);
    if (m) cur[m[1]] = m[2];
  }
  return out.map((f) => ({
    light: Number((f.name || '').match(/^ch\s*(\d+)/i)?.[1]) || null,
    id: f.id, name: f.name, model: f.model, address: Number(f.address),
  })).filter((f) => f.id && f.name);
}

// One light's output as DMX values: colour on RGB, brightness on the dimmer.
function dmx(s) {
  const [r, g, b] = hexToRgb(s.color);
  return [r, g, b, Math.round(Math.min(1, Math.max(0, s.level)) * 255)];
}

function snapshot(cues, t) {
  const st = stateAt(cues, t).lights;
  return ALL_LIGHTS.map((l) => dmx(st[l]));
}

// Within rounding: a colour fade sampled either side of an edge can differ by 1.
const near = (a, b) => a.every((v, i) => v.every((x, j) => Math.abs(x - b[i][j]) <= 2));

// Lights that are dark all match, whatever colour they were left on.
// (a dimmer at 1–2 of 255 is the last moment of a fade, and reads as dark)
const keyOf = (snap) => snap.map(([r, g, b, d]) => (d > 2 ? `${r},${g},${b}@${d}` : '-')).join('|');

/** The show as back-to-back pieces: each one either holds a look or fades
 *  straight from one to another. → [{ start, end, from, to }] */
export function pieces(cues, duration) {
  const times = changeTimes(cues).filter((t) => t >= 0 && t < duration);
  const edges = [...new Set([0, ...times, duration])].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const [start, end] = [edges[i], edges[i + 1]];
    if (end - start < 0.005) continue;
    const from = snapshot(cues, start);
    const to = snapshot(cues, end - 0.0001);
    const prev = out[out.length - 1];
    const holding = keyOf(from) === keyOf(to);
    // A sliver left over where two fades overlap (a hundredth of a second)
    // isn't worth its own block: the fade before it just lands there. A
    // short piece that starts with a snap is a real flash and stays.
    if (prev && end - start < 0.05 && near(from, prev.to)) {
      prev.end = end;
      // a still sliver only makes the block longer; a moving one is the
      // tail of the fade, which then lands where the sliver ends
      if (!holding) { prev.to = to; prev.fade = end - prev.start; }
      continue;
    }
    // a hold that carries on the look before it just makes that block longer
    if (prev && holding && keyOf(prev.to) === keyOf(to)) { prev.end = end; continue; }
    // a fade too short to see (the last 1/255 of a dimmer) is a snap
    if (!holding && end - start < 0.05) {
      if (prev && keyOf(prev.to) === keyOf(to)) prev.end = end;
      else out.push({ start, end, from: to, to, fade: 0 });
      continue;
    }
    out.push({ start, end, from, to: holding ? from : to, fade: holding ? 0 : end - start });
  }
  return out;
}

const fmt = (sec) => {
  const cs = Math.round(sec * 100);
  const h = Math.floor(cs / 360000);
  const m = Math.floor(cs / 6000) % 60;
  const s = Math.floor(cs / 100) % 60;
  // CHECK: the demo timeline only uses tenths (0:00:01.4). Does ShowXpress
  // read hundredths? If it rounds or rejects them, drop to one decimal.
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
};
const secs = (n) => String(Math.round(n * 1000) / 1000);
const safe = (name) => name.replace(/[^A-Za-z0-9 ._()%+-]+/g, '').replace(/\s+/g, ' ').trim();

function sceneXml(fixtures, steps) {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '', '<Scene>', '  <Fixtures>'];
  for (const f of fixtures) lines.push(`    <Fixture id="${f.id}" name="${f.name}" model="${f.model}"/>`);
  lines.push('  </Fixtures>', '  <Steps>');
  for (const st of steps) {
    // CHECK: step length in seconds, with decimals? The demo only has whole numbers.
    lines.push(`    <Step length="${secs(st.length)}">`);
    fixtures.forEach((f, i) => {
      const [r, g, b, d] = st.snap[i];
      const vals = new Array(SLIMPAR.channels).fill(0);
      vals[SLIMPAR.red] = r; vals[SLIMPAR.green] = g; vals[SLIMPAR.blue] = b; vals[SLIMPAR.dimmer] = d;
      lines.push(`      <Fixture id="${f.id}">`);
      // Every channel is written, so a scene never leaves one over from the last.
      vals.forEach((v, ch) => lines.push(`        <Channel index="${ch}" value="${v}" fade="${st.fade ? 1 : 0}"/>`));
      lines.push('      </Fixture>');
    });
    lines.push('    </Step>');
  }
  lines.push('  </Steps>', '</Scene>', '');
  return lines.join('\r\n');
}

/** → { scenes: Map(fileName → xml), timeline: ini text, blocks: [...] } */
export function showxpressShow(plan, { fixturesIni, duration, audioPath = 'Live/music.wav', title = 'show' }) {
  const all = parseFixturesIni(fixturesIni);
  const fixtures = ALL_LIGHTS.map((l) => all.find((f) => f.light === l));
  const missing = ALL_LIGHTS.filter((l, i) => !fixtures[i]);
  if (missing.length) throw new Error(`fixtures.ini has no CH${missing.join(', CH')}`);
  const cues = activeCues(plan.cues, plan.optionPicks);
  const end = duration ?? Math.max(0, ...cues.map((c) => (c.end ?? c.time) + 5));

  // Looks keep the names the run sheet gives them (Intro A, Rustage…).
  const named = new Map();
  for (const look of runSheet(plan).looks) {
    const snap = look.lights.map((x) => (x ? [...hexToRgb(x.hex), Math.round(x.level / 100 * 255)] : [0, 0, 0, 0]));
    named.set(keyOf(snap), look.name);
  }
  let extra = 0;
  const looks = [...named.entries()].map(([k, name]) => ({ parts: k.split('|'), name }));
  // In-between states get a plain description where one fits ("7 warm
  // white", "All white 40%", "Starfire solo A + 7"), else a number.
  const describe = (snap) => {
    const lit = snap.map((v, i) => [ALL_LIGHTS[i], v]).filter(([, v]) => v[3] > 2);
    if (!lit.length) return 'Blackout';
    const kinds = new Set(lit.map(([, v]) => v.join(',')));
    if (kinds.size !== 1) {
      const parts = keyOf(snap).split('|');
      for (const look of looks) {
        const diff = parts.map((x, i) => (x === look.parts[i] ? null : ALL_LIGHTS[i])).filter(Boolean);
        if (diff.length && diff.length <= 2 && diff.every((l) => look.parts[l - 1] === '-')) return `${look.name} + ${diff.join(' ')}`;
      }
      return `Look ${++extra}`;
    }
    const [r, g, b, d] = lit[0][1];
    const who = lit.length === ALL_LIGHTS.length ? 'All' : lit.map(([l]) => l).join(' ');
    return `${who} ${shortColorName(rgbToHex([r, g, b]))}${d < 255 ? ` ${Math.round(d / 2.55)}%` : ''}`;
  };
  const lookName = (snap) => {
    const k = keyOf(snap);
    if (!named.has(k)) named.set(k, describe(snap));
    return named.get(k);
  };

  const scenes = new Map();
  const blocks = pieces(cues, end).map((p) => {
    let file;
    if (!p.fade) {
      file = `${safe(lookName(p.to))}.scex`;
      if (!scenes.has(file)) scenes.set(file, sceneXml(fixtures, [{ length: HOLD, snap: p.to, fade: false }]));
    } else {
      const s = Math.round(p.fade * 100) / 100;
      file = `${safe(`${lookName(p.from)} to ${lookName(p.to)} ${s}s`)}.scex`;
      if (!scenes.has(file)) {
        scenes.set(file, sceneXml(fixtures, [
          { length: LEAD, snap: p.from, fade: false },
          { length: p.fade, snap: p.to, fade: true },
          { length: HOLD, snap: p.to, fade: false },
        ]));
      }
    }
    return { start: p.start, length: p.end - p.start, file };
  });

  const ini = ['', '[Params]', 'Version = 0.2', 'CommentTimeLine = 0', 'LightTimeLines = 1', 'MediaTimeLines = 1',
    'ShowWaveForm = 1', 'Zoom = 1', `MaxTime = ${fmt(Math.ceil(end)).replace(/\.\d+$/, '')}`,
    'TimeLine_1 = V I D E O   P I C T U R E   T I M E L I N E', 'TimeLine_2 = music', `TimeLine_3 = ${safe(title)}`];
  const ev = (i, rows) => { ini.push(`[Event_${i}]`, ...rows); };
  ev(0, ['TimeLineIndex = 2', 'StartTime = 0:00:00.00', `Path = ${audioPath}`, `Length = ${fmt(end)}`]);
  // One light row: each block takes over from the last, and every scene sets
  // every channel, so nothing carries over between rows.
  blocks.forEach((b, i) => ev(i + 1, ['TimeLineIndex = 3', `StartTime = ${fmt(b.start)}`, `Path = ${b.file}`,
    `Length = ${fmt(b.length)}`, 'Speed = 100', 'SpeedType = 2']));
  ini.push('');
  return { scenes, timeline: ini.join('\r\n'), blocks };
}
