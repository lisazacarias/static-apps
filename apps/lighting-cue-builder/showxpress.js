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

// Step lengths are whole hundredths of a second: the demo's 5 s fade-off
// is length="500", and a step written as 600 showed as 00:06.00.
// HOLD is long enough (10 min) that a held look never loops back inside a
// timeline block; a loop would replay a fade scene from its start.
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

const lerp = (a, b, k) => a.map((v, i) => v.map((x, j) => x + (b[i][j] - x) * k));

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
    // a piece too short to matter (where two changes are a few thousandths
    // apart) just makes the block before it longer, so blocks stay back to back
    if (end - start < 0.005) { if (out.length) out[out.length - 1].end = end; continue; }
    const from = snapshot(cues, start);
    const to = snapshot(cues, end - 0.0001);
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

/** Puts the pieces on ShowXpress's grid. Its timeline works in tenths of a
 *  second (4.32 shows and moves as 4.3), and a block whose start is rounded
 *  but whose length isn't ends early, leaving a gap where the row plays
 *  nothing and the lights drop out. So every block starts on a tenth and
 *  runs exactly to the next. A piece rounded away entirely is dropped if
 *  it's a fade (it becomes a snap) and nudged a tenth later if it's a held
 *  look, so a short flash is never lost; a fade right after a flash
 *  shorter than a tenth replaces it, since it starts from that look. → [{ start, end, from, to, fade }] */
export function onGrid(ps, duration, grid = 0.1) {
  const q = (t) => Math.round(t / grid) * grid;
  const out = [];
  for (const p of ps) {
    const prev = out[out.length - 1];
    let start = q(p.start);
    if (prev && start <= prev.start + 1e-9) {
      // a flash held for less than a tenth, then fading out: the fade
      // scene's first step snaps to that same look, so it takes the slot
      if (p.fade && !prev.fade && near(prev.to, p.from)) { out[out.length - 1] = { ...p, start: prev.start, at: p.start }; continue; }
      // two fades back to back (Slade's breaths overlapping): one longer
      // fade to where the second lands, instead of losing the second
      if (p.fade && prev.fade && near(prev.to, p.from)) { prev.to = p.to; prev.fade = p.start + p.fade - prev.at; continue; }
      if (p.fade) continue;
      start = prev.start + grid;
    }
    // `at` keeps the real start, which merged fade lengths are measured from
    out.push({ ...p, start: Math.round(start * 1000) / 1000, at: p.start });
  }
  out.forEach((p, i) => { p.end = i + 1 < out.length ? out[i + 1].start : Math.max(q(duration), p.start + grid); });
  // Rounding moves block edges by up to half a tenth, so a fade could start
  // a few levels away from where the block before left the lights: a small
  // jump each time, which reads as a glitch in slow fades like Slade's
  // breathing. Where the page doesn't snap at an edge, the fade starts from
  // what the block before ends on instead, and never runs past its block.
  out.forEach((p, i) => {
    if (!p.fade) return;
    p.fade = Math.min(p.fade, p.end - p.start);
    const prev = out[i - 1];
    if (prev && near(prev.to, p.from)) p.from = shownAtEnd(prev);
  });
  return out;
}

// what a block leaves the lights on when it ends: a fade cut short stops partway
function shownAtEnd(p) {
  if (!p.fade) return p.to;
  const k = Math.min(1, (p.end - p.start) / p.fade);
  return k >= 1 ? p.to : lerp(p.from, p.to, k);
}

const fmt = (sec) => {
  const cs = Math.round(sec * 100);
  const h = Math.floor(cs / 360000);
  const m = Math.floor(cs / 6000) % 60;
  const s = Math.floor(cs / 100) % 60;
  // Blocks are on tenths already (see onGrid); a second decimal keeps the
  // file exact without changing what ShowXpress reads.
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
};
const hundredths = (sec) => String(Math.max(1, Math.round(sec * 100)));
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

function sceneXml(fixtures, steps) {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '', '<Scene>', '  <Fixtures>'];
  for (const f of fixtures) lines.push(`    <Fixture id="${f.id}" name="${f.name}" model="${f.model}"/>`);
  lines.push('  </Fixtures>', '  <Steps>');
  for (const st of steps) {
    lines.push(`    <Step length="${hundredths(st.length)}">`);
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
  const blocks = onGrid(pieces(cues, end), end).map((p) => {
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
          // the snap step is part of the fade's time, so it still lands on time
          { length: Math.max(0.01, p.fade - LEAD), snap: p.to, fade: true },
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

/** Everything ShowXpress needs, as files for one zip:
 *  `<show>-showxpress/install.sh` plus a `show/` folder laid out like a
 *  ShowXpress light show. install.sh copies `show/` into
 *  ~/TheLightingController/LightShows/<show>, which is where ShowXpress 9
 *  on a Mac keeps its shows (File › Open lightshow Folder shows it).
 *  → [{ name, data }] for xlsx.js's zip() */
export function showxpressPackage(plan, { fixturesIni, profile, profileName, pools, audio, duration, showName }) {
  // no spaces, so the install command needs no escaping: bash ~/Downloads/teen-titans-showxpress/install.sh
  const root = `${showName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-showxpress`;
  const show = `${root}/show`;
  const { scenes, timeline } = showxpressShow(plan, { fixturesIni, duration, title: `${showName} lights`, audioPath: 'Live/music.wav' });
  const files = [
    { name: `${root}/install.sh`, data: installScript(showName), executable: true },
    { name: `${show}/fixtures.ini`, data: fixturesIni },
    { name: `${show}/fixtures/${profileName}.txt`, data: profile },
    { name: `${show}/3DView/fixtures.ini`, data: view3dIni(fixturesIni, pools) },
    { name: `${show}/Live/TimeLine/timelines/${showName}.tml`, data: timeline },
    ...[...scenes].map(([file, xml]) => ({ name: `${show}/scenes/${file}`, data: xml })),
  ];
  if (audio) files.push({ name: `${show}/Live/music.mp3`, data: audio });
  return files;
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
