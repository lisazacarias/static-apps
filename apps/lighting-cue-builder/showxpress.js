// Turns a plan into ShowXpress (The Lighting Controller V9) files: one
// scene file per look or fade, and a timeline that places them on the song.
// DOM-free, so the Node tests import it directly.
//
// The file shapes come from the demo show that ships with ShowXpress 9.2.6
// (lightshows_bank/demo_show_V9): scenes are XML (scenes/*.scex), the
// timeline is an ini file (Live/TimeLine/timelines/*.tml), and the patch is
// fixtures.ini. Things the demo show doesn't settle are marked CHECK.

import { ALL_LIGHTS, activeCues, changeTimes, hexToRgb, stateAt, flashTimes, formatTime, sectionAt, shortColorName } from './cues.js';

// Channel order of the venue's SlimPAR 56 in 7-channel mode, from the
// profile the venue sent: red, green, blue, colour macro, shutter, mode,
// dimmer. Index 3–5 stay at 0: macro off, shutter open, plain RGB mode.
// At Revel only red, green and blue respond (Quan: "only the RGB works,
// there's no dimmer or any other channel"), so brightness goes out as the
// colour scaled down, and the dimmer is held at full. A rig whose dimmer
// does work gets the same look.
const SLIMPAR = { red: 0, green: 1, blue: 2, dimmer: 6, channels: 7 };
// Channel names from the profile, written into scenes so they read like
// ShowXpress's own (Quan's intermission scene names each channel too).
const CHANNEL_NAMES = ['red', 'green', 'blue', 'color_macro', 'shutter', 'mode', 'dimmer'];

// How the plan's colours go out at Revel. The page's colours are screen
// colours; on the SlimPARs anything with all three channels lit comes out
// pastel (Lisa: "super washed out" at the studio). Quan's saturated
// intermission scene keeps one channel at 0 and green low: purple
// 27,0,136 and orange 255,114,0. Those two are his; the rest follow the
// same idea and are guesses until the Colour test timeline is checked.
// CHECK: blue, cyan, lime, red, light purple and pink on the real lights.
// Seconds of blackout on Revel's timeline before the song (Quan: "we needed
// 5s of blackout before the lighting starts").
export const REVEL_LEAD = 5;

export const REVEL_COLORS = {
  '#9b72ff': [51, 0, 255],   // Titans lavender: Quan's purple, at full
  '#fbb612': [255, 114, 0],  // Titans orange: Quan's orange
  '#ec1b24': [255, 0, 0],    // Titans red
  '#00acee': [0, 100, 255],  // Titans blue
  '#2ad8ff': [0, 208, 255],  // cyan (the freeze ray)
  '#c0d62d': [100, 255, 0],  // Titans lime
  '#b79cff': [130, 0, 255],  // light purple (Starfire's solo)
  '#ff8fc8': [255, 0, 120],  // pink (Starfire's solo)
};

// Names for the Colour test and the run page. The page's own names call
// both #9b72ff and #b79cff "lavender".
export const REVEL_COLOR_NAMES = {
  '#9b72ff': 'lavender', '#fbb612': 'orange', '#ec1b24': 'red', '#00acee': 'blue',
  '#2ad8ff': 'cyan', '#c0d62d': 'lime', '#b79cff': 'light purple', '#ff8fc8': 'pink',
};

/** A plan colour as Revel's lights should get it: from REVEL_COLORS, or
 *  for anything else, the white part taken out (the smallest channel to
 *  0) and scaled back to full, unless it's a white or near-white, which
 *  stays as it is (warm white is meant to look white). */
export function revelColor(hex) {
  const h = hex.toLowerCase();
  if (REVEL_COLORS[h]) return REVEL_COLORS[h];
  const rgb = hexToRgb(h);
  const max = Math.max(...rgb), min = Math.min(...rgb);
  if (!max || (max - min) / max < 0.5) return rgb;
  return rgb.map((v) => Math.round(((v - min) / (max - min)) * 255));
}

// Step lengths are whole hundredths of a second: the demo's 5 s fade-off
// is length="500", and a step written as 600 showed as 00:06.00. That's
// finer than the timeline, which works in tenths, so the timing lives in
// the steps (see blocks()).
// HOLD (10 min) pads each block's last step so a scene never loops back
// to its start inside its block.
const HOLD = 600;
// ShowXpress plays steps in 0.05 s ticks and rounds each step up: a timing
// test on Lisa's Mac (ShowXpress 9.2.6) played 40 steps of 0.25 s in
// 10.02 s, but 40 of 0.07 s took 3.97 s (0.10 each). Rounded one by one,
// that drift added up over a strobe run. So every step edge goes on the
// 0.05 s grid, counted from the block's start, and nothing gets rounded.
const TICK = 0.05;

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

// One light as [r, g, b, level 0–255]; `color` turns a plan colour into
// what goes out (the page's own colour unless told otherwise).
function dmx(s, color) {
  const [r, g, b] = color(s.color);
  return [r, g, b, Math.round(Math.min(1, Math.max(0, s.level)) * 255)];
}

function snapshot(cues, t, color) {
  const st = stateAt(cues, t).lights;
  return ALL_LIGHTS.map((l) => dmx(st[l], color));
}

// Within rounding: a colour fade sampled either side of an edge can differ by 1.
const near = (a, b) => a.every((v, i) => v.every((x, j) => Math.abs(x - b[i][j]) <= 2));

// Same on stage: dark lights match whatever colour they're on.
const looksSame = (a, b) => a.every((v, i) => (v[3] <= 2 && b[i][3] <= 2) || v.every((x, j) => Math.abs(x - b[i][j]) <= 2));

const lerp = (a, b, k) => a.map((v, i) => v.map((x, j) => x + (b[i][j] - x) * k));

// Lights that are dark all match, whatever colour they were left on.
// (a dimmer at 1–2 of 255 is the last moment of a fade, and reads as dark)
const keyOf = (snap) => snap.map(([r, g, b, d]) => (d > 2 ? `${r},${g},${b}@${d}` : '-')).join('|');

/** The show as back-to-back pieces: each one either holds a look or fades
 *  straight from one to another. → [{ start, end, from, to }] */
export function pieces(cues, duration, color = hexToRgb) {
  const times = changeTimes(cues).filter((t) => t >= 0 && t < duration);
  const edges = [...new Set([0, ...times, duration])].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const [start, end] = [edges[i], edges[i + 1]];
    // a piece too short to matter (where two changes are a few thousandths
    // apart) just makes the block before it longer, so blocks stay back to back
    if (end - start < 0.005) { if (out.length) out[out.length - 1].end = end; continue; }
    const from = snapshot(cues, start, color);
    const to = snapshot(cues, end - 0.0001, color);
    const prev = out[out.length - 1];
    const holding = keyOf(from) === keyOf(to);
    // A sliver left over where two fades overlap (a hundredth of a second)
    // isn't worth its own block: the fade before it just lands there. A
    // short piece that starts with a snap is a real flash and stays.
    // a still sliver only makes the block longer; a moving one is the tail
    // of the fade, which then lands where the sliver ends, as long as the
    // longer straight line still passes where the lights really were
    const joints = [...(prev?.joints || []), [start, from]];
    const fits = !holding && prev?.fade && joints.every(([t, snap]) => near(lerp(prev.from, to, (t - prev.start) / (end - prev.start)), snap));
    if (prev && end - start < 0.05 && near(from, prev.to) && (holding || fits)) {
      prev.end = end;
      if (!holding) { prev.to = to; prev.fade = end - prev.start; prev.joints = joints; }
      continue;
    }
    // a hold that carries on the look before it just makes that block longer
    if (prev && holding && keyOf(prev.to) === keyOf(to)) { prev.end = end; continue; }
    // a fade too short to see (the last 1/255 of a dimmer) is a snap; a
    // short piece that really moves (a crossfade's first 0.04 s) stays a fade
    if (!holding && end - start < 0.05 && near(from, to)) {
      if (prev && keyOf(prev.to) === keyOf(to)) prev.end = end;
      else out.push({ start, end, from: to, to, fade: 0 });
      continue;
    }
    out.push({ start, end, from, to: holding ? from : to, fade: holding ? 0 : end - start });
  }
  return out;
}

/** Packs the pieces into timeline blocks of a few seconds, each one scene
 *  whose steps carry the timing. The timeline works in tenths (4.32 shows
 *  and moves as 4.3), and one block per change put every switch on a tenth:
 *  fast runs came out uneven (eighths at 0.29 s played as 0.3, 0.3, 0.2…)
 *  and fades stepped at the joins. Steps are exact to the hundredth, so
 *  only block edges sit on tenths. Edges go inside a held look where one
 *  comes along (nothing changes there), else every 8 s, and each block's
 *  first step snaps to exactly what the page shows at its edge, so the
 *  joins don't show. → [{ start, end, steps: [{ t, snap, fade }] }] */
export function blocks(pieceList, duration, { every = 3, most = 8, longest = 16, clear = 0.25, grid = 0.1 } = {}) {
  // pieces() folds a look held after a fade into the fade's piece; split it
  // back out so a fade step only ever covers the fade itself
  const ps = pieceList.flatMap((p) => (p.fade && p.end - p.start > p.fade + 1e-9
    ? [{ ...p, end: p.start + p.fade }, { start: p.start + p.fade, end: p.end, from: p.to, to: p.to, fade: 0 }]
    : [p]));
  const tenth = (t) => Math.round(t / grid) * grid;
  const shownAt = (t) => {
    const p = ps.find((q) => t >= q.start && t < q.end) || ps[ps.length - 1];
    return p.fade ? lerp(p.from, p.to, Math.min(1, (t - p.start) / p.fade)) : p.to;
  };
  // ShowXpress may take a moment to switch blocks, so an edge stays at
  // least `clear` seconds from any snap (where the stage jumps): a flash
  // right after an edge could get swallowed. Smooth fades hide an edge
  // fine. Prefer a held look, looking up to `longest` ahead so a whole
  // strobe or chaos run can sit in one block; failing that, the quietest
  // tenth (most room either side).
  // (quick fades count too: cutting one costs it a hundredth, a visible step)
  const changes = [
    ...ps.filter((p, i) => i > 0 && !looksSame(ps[i - 1].to, p.from)).map((p) => p.start),
    ...ps.filter((p) => p.fade && p.fade < 1).flatMap((p) => [p.start, p.end]),
  ];
  const room = (t) => Math.min(...changes.map((c) => Math.abs(c - t)), Infinity);
  const holding = (t) => ps.some((p) => !p.fade && p.start <= t - clear && p.end >= t + clear);
  const edges = [0];
  for (;;) {
    const from = edges[edges.length - 1];
    if (!ps.some((p) => p.start > from + every)) break; // nothing left to split for
    let pick = null, best = null;
    for (let t = tenth(from + every); t <= from + longest + 1e-9 && t < duration - every; t = tenth(t + grid)) {
      if (room(t) >= clear && holding(t)) { pick = t; break; }
      if (t <= from + most + 1e-9 && (!best || room(t) > room(best) + 1e-9)) best = t;
    }
    pick = pick ?? best;
    if (pick === null) break;
    edges.push(Math.round(pick * 1000) / 1000);
  }
  return edges.map((a, i) => {
    const b = i + 1 < edges.length ? edges[i + 1] : duration;
    const steps = [];
    for (const p of ps) {
      const s = Math.max(p.start, a), e = Math.min(p.end, b);
      if (e - s < 1e-9) continue;
      const s0 = shownAt(s), e0 = p.fade ? lerp(p.from, p.to, Math.min(1, (e - p.start) / p.fade)) : p.to;
      const last = steps[steps.length - 1];
      if (!p.fade || looksSame(s0, e0)) {
        if (!(last && !last.fade && looksSame(last.snap, e0))) steps.push({ t: s, snap: e0, fade: false });
        continue;
      }
      // a fade that doesn't carry on from the step before (a flash that
      // snapped on, or the block's first step) starts with a one-tick snap
      const joins = last && looksSame(last.snap, s0);
      if (!joins) steps.push({ t: s, snap: s0, fade: false });
      steps.push({ t: joins ? s : s + TICK, snap: e0, fade: true });
    }
    // a block that ends mid-fade gets a closing hold, which takes the
    // never-loop padding; padding the fade itself would stretch it out
    if (steps[steps.length - 1].fade) steps.push({ t: b, snap: steps[steps.length - 1].snap, fade: false });
    return { start: a, end: b, steps };
  });
}

const fmt = (sec) => {
  const cs = Math.round(sec * 100);
  const h = Math.floor(cs / 360000);
  const m = Math.floor(cs / 6000) % 60;
  const s = Math.floor(cs / 100) % 60;
  // Blocks start on tenths already (see blocks()); a second decimal keeps
  // the file exact without changing what ShowXpress reads.
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
};
/** 3DView/fixtures.ini: each light hung at `height`, pointing straight
 *  down at its pool on the venue map. `pools` maps light → [x, y] in the
 *  map's units; `scale` is map units per metre. In the 3D view +x is the
 *  pole side and -z is nearest the camera, so the mirror (top of the map)
 *  goes to +z, the far wall. Lights not on the map are parked in a corner. */
export function view3dIni(fixturesIni, pools, { scale = 85, height = 4.5 } = {}) {
  const pts = Object.values(pools);
  const mid = [0, 1].map((k) => (Math.min(...pts.map((p) => p[k])) + Math.max(...pts.map((p) => p[k]))) / 2);
  return parseFixturesIni(fixturesIni).map((f) => {
    const p = pools[f.light];
    const [x, z] = p ? [(p[0] - mid[0]) / scale, -(p[1] - mid[1]) / scale] : [5.5, 3.5];
    return [`[${f.id}]`, `Name = ${f.name}`, `Position = ${x.toFixed(2)},${height.toFixed(2)},${z.toFixed(2)}`,
      'Orientation = 0,0,0', 'Scale = 1,1,1', 'Color = 125,125,125'].join('\r\n');
  }).join('\r\n') + '\r\n';
}

const safe = (name) => name.replace(/[^A-Za-z0-9 ._()%+-]+/g, '').replace(/\s+/g, ' ').trim();

// How brightness goes out. 'rgb' (the default): the colour times the level
// on red, green and blue, dimmer held at full. A fade between two steps then
// dims the colour itself, the only way it can dim at Revel; a rig whose
// dimmer works gets the same look. When colour and level change in the same
// fade the middle differs a little from the page (a product of two straight
// lines isn't one). 'dimmer': full colour, level on the dimmer, as before
// Quan's note, kept so the dimmer test can be acted on either way.
export const rgbOut = ([r, g, b, d]) => [r, g, b].map((v) => Math.round((v * d) / 255));
const channelsOf = (snap, brightness) => {
  const vals = new Array(SLIMPAR.channels).fill(0);
  const [r, g, b] = brightness === 'dimmer' ? snap.slice(0, 3).map((v) => Math.round(v)) : rgbOut(snap);
  vals[SLIMPAR.red] = r; vals[SLIMPAR.green] = g; vals[SLIMPAR.blue] = b;
  vals[SLIMPAR.dimmer] = brightness === 'dimmer' ? Math.round(snap[3]) : 255;
  return vals;
};

const xmlText = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// steps: [{ ticks, fade, vals: [one 7-channel array per fixture], name? }]
function rawSceneXml(fixtures, steps) {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '', '<Scene>', '  <Fixtures>'];
  for (const f of fixtures) lines.push(`    <Fixture id="${f.id}" name="${f.name}" model="${f.model}"/>`);
  lines.push('  </Fixtures>', '  <Steps>');
  for (const st of steps) {
    lines.push(st.name ? `    <Step name="${xmlText(st.name)}" length="${st.ticks}">` : `    <Step length="${st.ticks}">`);
    fixtures.forEach((f, i) => {
      lines.push(`      <Fixture id="${f.id}">`);
      // Every channel is written, so a scene never leaves one over from the last.
      st.vals[i].forEach((v, ch) => lines.push(`        <Channel index="${ch}" name="${CHANNEL_NAMES[ch]}" value="${v}" fade="${st.fade ? 1 : 0}"/>`));
      lines.push('      </Fixture>');
    });
    lines.push('    </Step>');
  }
  lines.push('  </Steps>', '</Scene>', '');
  return lines.join('\r\n');
}

function sceneXml(fixtures, steps, brightness = 'rgb') {
  return rawSceneXml(fixtures, steps.map((st) => ({ ...st, vals: st.snap.map((sn) => channelsOf(sn, brightness)) })));
}

// A fade between two saturated colours dims in the middle: ShowXpress
// moves each channel in a straight line, so lavender (51,0,255) to lime
// (100,255,0) passes through about 75,128,128, half as bright. With the
// solos' 0.16 s swaps that read as a blink at every background vocal.
// keepBright splits such a fade in two, the halfway colour lifted back to
// the brightness the light should have there. A fade under 0.1 s (two
// ticks) is left alone; it can't be split.
const brightness = ([r, g, b, d]) => (Math.max(r, g, b) * d) / 255;
function liftedMid(a, b) {
  const m = a.map((v, i) => (v + b[i]) / 2);
  const want = (brightness(a) + brightness(b)) / 2, have = brightness(m);
  if (!(have > 0) || have >= want * 0.9) return null;
  const k = Math.min(want / have, 255 / Math.max(m[0], m[1], m[2]));
  return [m[0] * k, m[1] * k, m[2] * k, m[3]];
}
function keepBright(steps, end) {
  const out = [];
  steps.forEach((st, k) => {
    const prev = out[out.length - 1];
    const next = k + 1 < steps.length ? steps[k + 1].t : end;
    if (st.fade && prev && next - st.t >= 2 * TICK - 1e-9) {
      const mids = prev.snap.map((a, i) => liftedMid(a, st.snap[i]));
      if (mids.some(Boolean)) {
        const half = prev.snap.map((a, i) => mids[i] || a.map((v, j) => (v + st.snap[i][j]) / 2));
        out.push({ ...st, snap: half }, { ...st, t: (st.t + next) / 2 });
        return;
      }
    }
    out.push(st);
  });
  return out;
}

/** → { scenes: Map(fileName → xml), timeline: ini text, blocks: [...] } */
// lead: seconds of blackout on the timeline before the song and lights
// start. Revel wants 5 (Quan: "we needed 5s of blackout before the lighting
// starts"); the page and the plan's own times are unchanged.
export function showxpressShow(plan, { fixturesIni, duration, audioPath = 'Live/music.wav', title = 'show', brightness = 'rgb', color = hexToRgb, lead = 0 }) {
  const all = parseFixturesIni(fixturesIni);
  const fixtures = ALL_LIGHTS.map((l) => all.find((f) => f.light === l));
  const missing = ALL_LIGHTS.filter((l, i) => !fixtures[i]);
  if (missing.length) throw new Error(`fixtures.ini has no CH${missing.join(', CH')}`);
  const cues = activeCues(plan.cues, plan.optionPicks);
  const end = duration ?? Math.max(0, ...cues.map((c) => (c.end ?? c.time) + 5));

  // One scene per block, named by where it starts. Step lengths come from
  // putting each step's start on the 0.05 s grid (blocks start on tenths,
  // so that's the block's own grid too); they add up exactly, in hundredths.
  const scenes = new Map();
  const tick = (t) => Math.round(t / TICK) * TICK * 100;
  // "0:37.52 snap: raven-solo-pole, raven-solo-lime +3": when, how, and
  // which cues start there, so a step can be traced back to the plan
  const near = (a, b) => Math.abs(a - b) < 0.006;
  const stepName = (st, k) => {
    const ids = cues.filter((c) => flashTimes(c).some((t) => near(t, st.t)) || (c.end !== null && near(c.end, st.t))).map((c) => c.id);
    const what = k === 0 ? 'block starts' : st.fade ? 'fade' : 'snap';
    const list = ids.length > 2 ? `${ids.slice(0, 2).join(', ')} +${ids.length - 2}` : ids.join(', ');
    return `${formatTime(st.t)} ${what}${list ? `: ${list}` : ''}`;
  };
  const blockList = blocks(pieces(cues, end, color), end).map((bl, i) => {
    // "012 Raven solo 37.8s": readable in Finder and in ShowXpress's lists
    const section = sectionAt(plan.sections || [], plan.tempo, bl.start + 0.001)?.name;
    const file = `${String(i + 1).padStart(3, '0')} ${section ? `${safe(section)} ` : ''}${(Math.round(bl.start * 10) / 10).toFixed(1)}s.scex`;
    // A step that rounds to nothing goes if it only repeats what's already
    // up (the dark moment after a fade-out); one that changes something
    // (a 0.04 s flash) gets one tick, and the next ones catch up.
    const kept = bl.steps.filter((st, k, all) => {
      // A snap overtaken by another snap in under half a tick can't be seen
      // on the page either, but given its own tick it shows for 0.05 s: the
      // battle's return to orange 0.02 s before the first punch flashed
      // orange and cut that white flash to one tick.
      if (k > 0 && k < all.length - 1 && !st.fade && !all[k + 1].fade && all[k + 1].t - st.t < TICK / 2) return false;
      if (k === 0 || k === all.length - 1 || !(!st.fade && looksSame(st.snap, all[k - 1].snap))) return true;
      const next = k + 1 < all.length ? all[k + 1].t : bl.end;
      return tick(next) > tick(st.t);
    });
    const smooth = keepBright(kept, bl.end);
    const at = [];
    smooth.forEach((st, k) => at.push(k ? Math.max(tick(st.t), at[k - 1] + TICK * 100) : tick(st.t)));
    const steps = smooth.map((st, k) => {
      const next = k + 1 < smooth.length ? at[k + 1] : Math.max(tick(bl.end), at[k] + TICK * 100);
      return { ...st, name: stepName(st, k), ticks: Math.round(next - at[k] + (k + 1 === smooth.length ? HOLD * 100 : 0)) };
    });
    scenes.set(file, sceneXml(fixtures, steps, brightness));
    return { start: bl.start, length: bl.end - bl.start, file, steps };
  });

  const ini = ['', '[Params]', 'Version = 0.2', 'CommentTimeLine = 0', 'LightTimeLines = 1', 'MediaTimeLines = 1',
    'ShowWaveForm = 1', 'Zoom = 1', `MaxTime = ${fmt(Math.ceil(end + lead)).replace(/\.\d+$/, '')}`,
    'TimeLine_1 = V I D E O   P I C T U R E   T I M E L I N E', 'TimeLine_2 = music', `TimeLine_3 = ${safe(title)}`];
  const ev = (i, rows) => { ini.push(`[Event_${i}]`, ...rows); };
  ev(0, ['TimeLineIndex = 2', `StartTime = ${fmt(lead)}`, `Path = ${audioPath}`, `Length = ${fmt(end)}`]);
  // One light row: each block takes over from the last, and every scene sets
  // every channel, so nothing carries over between rows.
  const rows = blockList.map((b) => ({ start: b.start + lead, length: b.length, file: b.file }));
  if (lead > 0) {
    const black = fixtures.map(() => [0, 0, 0, 0]);
    scenes.set('000 blackout before the show.scex', sceneXml(fixtures, [{ name: 'blackout before the show', ticks: HOLD * 100, snap: black, fade: false }], brightness));
    rows.unshift({ start: 0, length: lead, file: '000 blackout before the show.scex' });
  }
  rows.forEach((b, i) => ev(i + 1, ['TimeLineIndex = 3', `StartTime = ${fmt(b.start)}`, `Path = ${b.file}`,
    `Length = ${fmt(b.length)}`, 'Speed = 100', 'SpeedType = 2']));
  ini.push('');
  return { scenes, timeline: ini.join('\r\n'), blocks: blockList };
}

/** Everything ShowXpress needs, as files for one zip:
 *  `<show>-showxpress/install.sh` plus a `show/` folder laid out like a
 *  ShowXpress light show. install.sh copies `show/` into
 *  ~/TheLightingController/LightShows/<show>, which is where ShowXpress 9
 *  on a Mac keeps its shows (File › Open lightshow Folder shows it).
 *  → [{ name, data }] for xlsx.js's zip() */
export function showxpressPackage(plan, { fixturesIni, profile, profileName, pools, audio, duration, showName, brightness, color, lead }) {
  // no spaces, so the install command needs no escaping: bash ~/Downloads/teen-titans-showxpress/install.sh
  const root = `${showName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-showxpress`;
  const show = `${root}/show`;
  const { scenes, timeline } = showxpressShow(plan, { fixturesIni, duration, title: `${showName} lights`, audioPath: 'Live/music.wav', brightness, color, lead });
  const files = [
    { name: `${root}/install.sh`, data: installScript(showName), executable: true },
    { name: `${show}/fixtures.ini`, data: fixturesIni },
    { name: `${show}/fixtures/${profileName}.txt`, data: profile },
    { name: `${show}/3DView/fixtures.ini`, data: view3dIni(fixturesIni, pools) },
    { name: `${show}/Live/TimeLine/timelines/${showName}.tml`, data: timeline },
    ...[...scenes].map(([file, xml]) => ({ name: `${show}/scenes/${file}`, data: xml })),
  ];
  if (audio) files.push({ name: `${show}/Live/music.mp3`, data: audio });
  files.push(...[...timingTest(fixturesIni), ...dimmerTest(fixturesIni), ...colorTest(fixturesIni)].map((f) => ({ ...f, name: `${show}/${f.name}` })));
  return files;
}

/** A separate "Timing test" timeline for measuring how ShowXpress plays
 *  steps. Two scenes flip the whole stage red/blue, then turn it white:
 *  40 steps of 0.25 s (white due at 0:10.0) and 40 of 0.07 s (white due
 *  2.8 s after its block starts at 0:13.0, so at 0:15.8). If white lands
 *  late, the delay divided by 40 is what each step costs, and comparing
 *  the two says whether it's a fixed cost per step or a rounding. */
export function timingTest(fixturesIni) {
  const all = parseFixturesIni(fixturesIni);
  const fixtures = ALL_LIGHTS.map((l) => all.find((f) => f.light === l));
  const fill = (rgb) => ALL_LIGHTS.map(() => [...rgb, 255]);
  const flips = (ticks) => [
    ...Array.from({ length: 40 }, (_, k) => ({ ticks, snap: fill(k % 2 ? [0, 0, 255] : [255, 0, 0]), fade: false })),
    { ticks: HOLD * 100, snap: fill([255, 255, 255]), fade: false },
  ];
  const ini = ['', '[Params]', 'Version = 0.2', 'CommentTimeLine = 0', 'LightTimeLines = 1', 'MediaTimeLines = 1',
    'ShowWaveForm = 0', 'Zoom = 1', 'MaxTime = 0:00:25',
    'TimeLine_1 = V I D E O   P I C T U R E   T I M E L I N E', 'TimeLine_2 = music', 'TimeLine_3 = timing test',
    '[Event_0]', 'TimeLineIndex = 3', 'StartTime = 0:00:00.00', 'Path = timing test slow.scex', 'Length = 0:00:12.00', 'Speed = 100', 'SpeedType = 2',
    '[Event_1]', 'TimeLineIndex = 3', 'StartTime = 0:00:13.00', 'Path = timing test fast.scex', 'Length = 0:00:06.00', 'Speed = 100', 'SpeedType = 2', ''];
  return [
    { name: 'scenes/timing test slow.scex', data: sceneXml(fixtures, flips(25)) },
    { name: 'scenes/timing test fast.scex', data: sceneXml(fixtures, flips(7)) },
    { name: 'Live/TimeLine/timelines/Timing test.tml', data: ini.join('\r\n') },
  ];
}

/** Revel's rig as a starting point for programming a piece by hand: the
 *  patch, the light profile and the 3D layout, plus a few scenes every
 *  show needs. Every scene sets all 7 channels of all 13 lights, CH13
 *  included, so each one is a whole look. install.sh puts it into a show
 *  someone has already made, without touching scenes they've built.
 *  → [{ name, data }] for xlsx.js's zip() */
export function starterPackage({ fixturesIni, profile, profileName, pools }) {
  const root = 'revel-showxpress-starter';
  const fixtures = parseFixturesIni(fixturesIni).sort((a, b) => a.light - b.light);
  const all = (rgb, d) => fixtures.map(() => [...rgb, d]);
  const warm = hexToRgb('#ffd9a0');
  const hold = HOLD * 100;
  const scenes = {
    '00 blackout': [{ ticks: hold, snap: all([0, 0, 0], 0), fade: false }],
    '01 all warm white fade in': [{ ticks: 200, snap: all(warm, 255), fade: true }, { ticks: hold, snap: all(warm, 255), fade: false }],
    '02 all white': [{ ticks: hold, snap: all([255, 255, 255], 255), fade: false }],
    // one light at a time, in number order, 2 s each, to check which is which
    '03 find each light': fixtures.map((_, k) => ({ name: `light ${fixtures[k].light}`, ticks: 200, snap: fixtures.map((f, i) => (i === k ? [255, 255, 255, 255] : [0, 0, 0, 0])), fade: false })),
  };
  return [
    { name: `${root}/install.sh`, data: starterScript(), executable: true },
    { name: `${root}/show/fixtures.ini`, data: fixturesIni },
    { name: `${root}/show/fixtures/${profileName}.txt`, data: profile },
    { name: `${root}/show/3DView/fixtures.ini`, data: view3dIni(fixturesIni, pools) },
    ...Object.entries(scenes).map(([n, steps]) => ({ name: `${root}/show/scenes/${n}.scex`, data: sceneXml(fixtures, steps) })),
    ...[...timingTest(fixturesIni), ...dimmerTest(fixturesIni), ...colorTest(fixturesIni)].map((f) => ({ ...f, name: `${root}/show/${f.name}` })),
  ];
}

function starterScript() {
  return `#!/bin/bash
# Puts Revel's lights into a ShowXpress show, new or existing. Quit
# ShowXpress, then run:
#   bash ~/Downloads/revel-showxpress-starter/install.sh "Show name" [song]
# With a song (MP3, WAV, M4A…), it also goes in as Live/music.wav.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
SHOWS="$HOME/TheLightingController/LightShows"
NAME="$1"
SONG="$2"

if [ -z "$NAME" ]; then
  echo "Say which show, in quotes, after the command:"
  echo "  bash $0 \\"Show name\\""
  [ -d "$SHOWS" ] && echo "Your shows: $(ls "$SHOWS" | tr '\n' ',' | sed 's/,$//; s/,/, /g')"
  exit 1
fi
DEST="$SHOWS/$NAME"
if pgrep -f "TheLightingController.app/Contents/MacOS" >/dev/null; then
  echo "ShowXpress is open. Quit it first (Cmd+Q), then run this again."
  exit 1
fi
if [ ! -d "$SHOWS" ]; then
  echo "Couldn't find ShowXpress's show folder at $SHOWS."
  echo "Open ShowXpress once, quit it, and run this again."
  exit 1
fi
if [ -n "$SONG" ] && [ ! -f "$SONG" ]; then
  echo "Couldn't find the song at $SONG."
  exit 1
fi
# ShowXpress opens a show made only of these files: a "Test" show made
# this way opened and played on ShowXpress 9.2.6.
[ -d "$DEST" ] || echo "Making a new show called \\"$NAME\\"."

# the patch and 3D layout are Revel's, so these replace whatever is there
mkdir -p "$DEST/fixtures" "$DEST/3DView" "$DEST/scenes" "$DEST/Live/TimeLine/timelines"
ditto "$HERE/show/fixtures.ini" "$DEST/fixtures.ini"
ditto "$HERE/show/fixtures" "$DEST/fixtures"
ditto "$HERE/show/3DView" "$DEST/3DView"
# starter scenes and the timing test only go in if missing: never over someone's work
for f in "$HERE/show/scenes/"*.scex "$HERE/show/Live/TimeLine/timelines/"*.tml; do
  rel="\${f#$HERE/show/}"
  [ -e "$DEST/$rel" ] || cp "$f" "$DEST/$rel"
done
# ShowXpress only draws the waveform for WAV; macOS's afconvert converts anything it can play
if [ -n "$SONG" ]; then
  afconvert -f WAVE -d LEI16 "$SONG" "$DEST/Live/music.wav"
  echo "Song added as Live/music.wav."
fi
# zip files carry no real dates; give the new ones today's
find "$DEST/fixtures.ini" "$DEST/fixtures" "$DEST/3DView" -exec touch {} +

echo "Done: $DEST"
echo "Open ShowXpress, choose File > Open lightshow > $NAME. Editor > Fixtures should show CH1 to CH13."
`;
}

/** A "Dimmer test" timeline, to see whether the dimmer channel does
 *  anything: every light (CH13 too) white, then the dimmer alone fades to
 *  0 over 3 s with red, green and blue left at full; back to white; then
 *  red, green and blue alone fade to 0 with the dimmer left at full.
 *  If the first fade goes dark, the dimmer works. Quan says it doesn't. */
export function dimmerTest(fixturesIni) {
  const fixtures = parseFixturesIni(fixturesIni).sort((a, b) => a.light - b.light);
  const all = (rgb, d) => fixtures.map(() => [...rgb, 0, 0, 0, d]);
  const white = all([255, 255, 255], 255);
  const steps = [
    { name: '0:00 white', ticks: 200, fade: false, vals: white },
    { name: '0:02 dimmer only to 0', ticks: 300, fade: true, vals: all([255, 255, 255], 0) },
    { name: '0:05 hold', ticks: 200, fade: false, vals: all([255, 255, 255], 0) },
    { name: '0:07 white again', ticks: 200, fade: false, vals: white },
    { name: '0:09 red green blue only to 0', ticks: 300, fade: true, vals: all([0, 0, 0], 255) },
    { name: '0:12 dark', ticks: HOLD * 100, fade: false, vals: all([0, 0, 0], 255) },
  ];
  const ini = ['', '[Params]', 'Version = 0.2', 'CommentTimeLine = 0', 'LightTimeLines = 1', 'MediaTimeLines = 1',
    'ShowWaveForm = 0', 'Zoom = 1', 'MaxTime = 0:00:20',
    'TimeLine_1 = V I D E O   P I C T U R E   T I M E L I N E', 'TimeLine_2 = music', 'TimeLine_3 = dimmer test',
    '[Event_0]', 'TimeLineIndex = 3', 'StartTime = 0:00:00.00', 'Path = dimmer test.scex', 'Length = 0:00:15.00', 'Speed = 100', 'SpeedType = 2', ''];
  return [
    { name: 'scenes/dimmer test.scex', data: rawSceneXml(fixtures, steps) },
    { name: 'Live/TimeLine/timelines/Dimmer test.tml', data: ini.join('\r\n') },
  ];
}

/** A "Colour test" timeline for tuning REVEL_COLORS at the studio: every
 *  light shows each of the show's colours for 3 s as the page has it, then
 *  3 s as it now goes out, named in the step list ("lavender: page",
 *  "lavender: Revel"). Then white, for comparison. */
export function colorTest(fixturesIni) {
  const fixtures = parseFixturesIni(fixturesIni).sort((a, b) => a.light - b.light);
  const all = ([r, g, b]) => fixtures.map(() => [r, g, b, 0, 0, 0, 255]);
  const steps = Object.keys(REVEL_COLORS).flatMap((hex) => [
    { name: `${REVEL_COLOR_NAMES[hex] || shortColorName(hex)}: page`, ticks: 300, fade: false, vals: all(hexToRgb(hex)) },
    { name: `${REVEL_COLOR_NAMES[hex] || shortColorName(hex)}: Revel`, ticks: 300, fade: false, vals: all(revelColor(hex)) },
  ]);
  steps.push({ name: 'white', ticks: HOLD * 100, fade: false, vals: all([255, 255, 255]) });
  const ini = ['', '[Params]', 'Version = 0.2', 'CommentTimeLine = 0', 'LightTimeLines = 1', 'MediaTimeLines = 1',
    'ShowWaveForm = 0', 'Zoom = 1', 'MaxTime = 0:01:00',
    'TimeLine_1 = V I D E O   P I C T U R E   T I M E L I N E', 'TimeLine_2 = music', 'TimeLine_3 = colour test',
    '[Event_0]', 'TimeLineIndex = 3', 'StartTime = 0:00:00.00', 'Path = colour test.scex', `Length = ${fmt(Object.keys(REVEL_COLORS).length * 6 + 6)}`, 'Speed = 100', 'SpeedType = 2', ''];
  return [
    { name: 'scenes/colour test.scex', data: rawSceneXml(fixtures, steps) },
    { name: 'Live/TimeLine/timelines/Colour test.tml', data: ini.join('\r\n') },
  ];
}

function installScript(showName) {
  return `#!/bin/bash
# Puts this show into ShowXpress. In Terminal, type "bash " (with the
# space), drag this file into the window, and press Enter.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
SHOWS="$HOME/TheLightingController/LightShows"
DEST="$SHOWS/${showName}"

# match the app's own path: process names get cut short, and this script's path doesn't contain it
if pgrep -f "TheLightingController.app/Contents/MacOS" >/dev/null; then
  echo "ShowXpress is open. Quit it first (Cmd+Q), then run this again."
  echo "(If it's open while this runs, it saves over the new files when it closes.)"
  exit 1
fi
if [ ! -d "$SHOWS" ]; then
  echo "Couldn't find ShowXpress's show folder at $SHOWS."
  echo "Open ShowXpress once, quit it, and run this again."
  exit 1
fi

mkdir -p "$DEST"
# old scenes go first, so ones the new plan doesn't use don't pile up
rm -rf "$DEST/scenes"
ditto "$HERE/show" "$DEST"
# ShowXpress only draws the waveform for WAV; macOS's afconvert makes one once
if [ ! -f "$DEST/Live/music.wav" ] && [ -f "$DEST/Live/music.mp3" ]; then
  afconvert -f WAVE -d LEI16 "$DEST/Live/music.mp3" "$DEST/Live/music.wav"
fi
# zip files carry no real dates; give everything today's
find "$DEST" -exec touch {} +

echo "Done: $DEST"
echo "Open ShowXpress, choose File > Open lightshow > ${showName}, then Live > TimeLine > Open > ${showName}."
`;
}
