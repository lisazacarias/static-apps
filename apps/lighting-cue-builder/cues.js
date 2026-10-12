// Pure cue logic: the rig, time formatting, what every light is doing at a
// given moment, import/export normalisation and the plain-text cue sheet.
// No DOM in here, so the Node tests exercise exactly what the page runs.

export const GROUPS = [
  { id: 'apparatus', label: 'Apparatus spots', lights: [3, 7, 10] },
  { id: 'floor', label: 'Floor spots', lights: [1, 2, 4, 5, 6, 8, 9, 12] },
  { id: 'backdrop', label: 'Backdrop', lights: [11] },
];

export const ALL_LIGHTS = GROUPS.flatMap((g) => g.lights).sort((a, b) => a - b);

// What each apparatus spot is lighting, for the stage plot and cue sheet.
export const APPARATUS = { 3: 'pole', 7: 'pole', 10: 'loops' };

export function groupOf(light) {
  return GROUPS.find((g) => g.lights.includes(light))?.id;
}

// Named colours a tech will recognise. The cue sheet names a custom pick by
// whichever of these it sits closest to, alongside the exact hex.
export const PRESETS = [
  { name: 'Open white', hex: '#ffffff' },
  { name: 'Warm white', hex: '#ffd9a0' },
  { name: 'Amber', hex: '#ffa630' },
  { name: 'Red', hex: '#ff2a2a' },
  { name: 'Magenta', hex: '#ff2fb4' },
  { name: 'Pink', hex: '#ff8fc8' },
  { name: 'Lavender', hex: '#b79cff' },
  { name: 'Purple', hex: '#8a3cff' },
  { name: 'Deep blue', hex: '#2a4bff' },
  { name: 'Cyan', hex: '#2ad8ff' },
  { name: 'Green', hex: '#2aff7a' },
];

// The show's palette: the five colours of the Teen Titans logo. Lavender is
// richer than the logo's #858ac2, which is grey enough that it reads as
// dull blue-white on stage.
// CHECK: does #9b72ff still read as purple on the venue's LED fixtures?
export const LOGO_COLORS = [
  { name: 'Titans red', hex: '#ec1b24' },
  { name: 'Titans orange', hex: '#fbb612' },
  { name: 'Titans lime', hex: '#c0d62d' },
  { name: 'Titans lavender', hex: '#9b72ff' },
  { name: 'Titans blue', hex: '#00acee' },
];

export const DEFAULT_FADE = 2;

/* ── time ─────────────────────────────────────────────────────────────── */

// 83.456 → "1:23.46". Hundredths: cues land on beats, and a tenth is audible.
export function formatTime(sec, digits = 2) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const scale = 10 ** digits;
  const total = Math.round(sec * scale) / scale;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  const ss = s.toFixed(digits).padStart(digits ? digits + 3 : 2, '0');
  return `${m}:${ss}`;
}

// Accepts "1:23.4", "83.4", "1:23", "0:05". Returns seconds or null.
export function parseTime(text) {
  if (typeof text === 'number') return Number.isFinite(text) && text >= 0 ? text : null;
  const t = String(text ?? '').trim();
  if (!t) return null;
  const m = t.match(/^(?:(\d+):)?(\d+(?:\.\d*)?|\.\d+)$/);
  if (!m) return null;
  const mins = m[1] ? Number(m[1]) : 0;
  const secs = Number(m[2]);
  if (m[1] && secs >= 60) return null;
  return mins * 60 + secs;
}

/* ── colour ───────────────────────────────────────────────────────────── */

export function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

export function isHex(v) {
  return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
}

export function nearestPreset(hex) {
  const [r, g, b] = hexToRgb(hex);
  let best = PRESETS[0];
  let bestD = Infinity;
  for (const p of PRESETS) {
    const [pr, pg, pb] = hexToRgb(p.hex);
    // Weighted RGB distance — cheap and good enough to name a gel.
    const d = 2 * (r - pr) ** 2 + 4 * (g - pg) ** 2 + 3 * (b - pb) ** 2;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

export function colorLabel(cue) {
  if (cue.colorName) return cue.colorName;
  const exact = [...PRESETS, ...LOGO_COLORS].find((p) => p.hex.toLowerCase() === cue.color.toLowerCase());
  return exact ? exact.name : `~${nearestPreset(cue.color).name}`;
}

/* ── cues ─────────────────────────────────────────────────────────────── */

let idCounter = 0;
export function newId() {
  idCounter += 1;
  return `c${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function blankCue(time = 0) {
  return {
    id: newId(),
    time: round2(time),
    end: null,
    lights: [],
    action: 'on',
    color: '#ffffff',
    colorName: '',
    level: 100,
    transition: 'sharp',
    fade: DEFAULT_FADE,
    othersOff: false,
    note: '',
    repeat: null,
  };
}

/* ── flash runs ───────────────────────────────────────────────────────── */

// A cue with `repeat` fires again and again on a beat grid: one row in the
// list, one item in a merge, shifted as a block by editing its start.
//   bpm      the song's tempo
//   beats    beats between flashes (0.25 … 4)
//   count    how many flashes
//   onFrac   how much of the gap each flash stays lit (1 = hold to the next)
//   altColor every other flash uses this colour, or null for one colour
//   dimTo    level (%) lights drop to between flashes; 0 = fully off
export const FLASH_BEATS = [0.25, 0.5, 1, 2, 4];
export const FLASH_ON = [0.25, 0.5, 0.75, 1];
export const FLASH_DIM = [0, 20, 35, 50, 70];

export function normalizeRepeat(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const bpm = Number(raw.bpm);
  const count = Math.round(Number(raw.count));
  if (!Number.isFinite(bpm) || bpm < 20 || bpm > 400 || !Number.isFinite(count) || count < 2) return null;
  const beats = FLASH_BEATS.includes(Number(raw.beats)) ? Number(raw.beats) : 1;
  const onFrac = FLASH_ON.includes(Number(raw.onFrac)) ? Number(raw.onFrac) : 0.5;
  return {
    bpm: Math.round(bpm * 100) / 100,
    beats,
    count: Math.min(count, 500),
    onFrac,
    altColor: isHex(raw.altColor) ? raw.altColor.toLowerCase() : null,
    // Runs saved before dimming existed went fully off between flashes.
    dimTo: FLASH_DIM.includes(Number(raw.dimTo)) ? Number(raw.dimTo) : 0,
    // Brightness only: each light keeps whatever colour it already has.
    keepColor: Boolean(raw.keepColor),
  };
}

export function flashGap(rep) {
  return (60 / rep.bpm) * rep.beats;
}

export function flashTimes(cue) {
  if (!cue.repeat) return [cue.time];
  const gap = flashGap(cue.repeat);
  return Array.from({ length: cue.repeat.count }, (_, k) => cue.time + k * gap);
}

// When the run is over: the last flash going out, or (held) the last flash.
export function flashEnd(cue) {
  const times = flashTimes(cue);
  const last = times[times.length - 1];
  return cue.repeat.onFrac < 1 ? last + flashGap(cue.repeat) * cue.repeat.onFrac : last;
}

function beatsLabel(b) {
  return { 0.25: '¼ beat', 0.5: '½ beat', 1: 'beat', 2: '2 beats', 4: '4 beats' }[b] || `${b} beats`;
}

export function flashLabel(cue) {
  const r = cue.repeat;
  const on = r.onFrac >= 1 ? 'held until the next' : `on for ${Math.round(r.onFrac * 100)}% of the gap`;
  const dim = r.onFrac < 1 && r.dimTo ? `, dimming to ${r.dimTo}% between` : '';
  const bright = r.keepColor ? ', brightness only' : '';
  const shape = cue.outFade ? `, ${cue.transition === 'fade' ? 'fading up' : 'snapping up'} and easing out over ${cue.outFade}s` : '';
  return `Flash ×${r.count}, every ${beatsLabel(r.beats)} at ${r.bpm} BPM (${flashGap(r).toFixed(3)}s apart), ${on}${dim}${shape}${bright}`;
}

// More than three flashes a second is the common photosensitivity limit.
// CHECK: confirm the venue's own rule on strobing and warnings.
export function flashesPerSecond(rep) {
  return 1 / flashGap(rep);
}

// Tap-along tempo: fit tap times to evenly spaced beats.
// → { bpm, first, taps } or null with fewer than 4 taps.
export function fitTaps(times) {
  if (times.length < 4) return null;
  const n = times.length;
  const mk = (n - 1) / 2;
  const mt = times.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  times.forEach((t, k) => { num += (k - mk) * (t - mt); den += (k - mk) ** 2; });
  const gap = num / den;
  if (!(gap > 0)) return null;
  return { bpm: Math.round((60 / gap) * 10) / 10, first: Math.round((mt - gap * mk) * 100) / 100, taps: n };
}

// When a cue or section was last edited (ms). Only the merge reads it.
// Anything saved before edits were stamped counts as 0, i.e. oldest.
function stampOf(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

export function sortCues(cues) {
  // Stable on ties so two cues at one timestamp keep their entry order —
  // the later one wins, which is what "last cue in" means on a desk.
  return cues
    .map((c, i) => [c, i])
    .sort((a, b) => a[0].time - b[0].time || a[1] - b[1])
    .map(([c]) => c);
}

// Coerce anything that came from storage, an import file or a share link
// into a well-formed cue, or null if it can't be one.
export function normalizeCue(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const time = parseTime(raw.time);
  if (time === null) return null;
  let end = raw.end === null || raw.end === undefined || raw.end === '' ? null : parseTime(raw.end);
  if (end !== null && end <= time) end = null;
  const lights = Array.isArray(raw.lights)
    ? [...new Set(raw.lights.map(Number).filter((n) => ALL_LIGHTS.includes(n)))].sort((a, b) => a - b)
    : [];
  const fade = Number(raw.fade);
  // Plans saved before intensity existed have no level — they meant full.
  const level = Math.round(Number(raw.level));
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId(),
    time: round2(time),
    end: end === null ? null : round2(end),
    lights,
    action: raw.action === 'off' ? 'off' : 'on',
    color: isHex(raw.color) ? raw.color.toLowerCase() : '#ffffff',
    colorName: typeof raw.colorName === 'string' ? raw.colorName.slice(0, 40) : '',
    transition: raw.transition === 'fade' ? 'fade' : 'sharp',
    fade: Number.isFinite(fade) && fade > 0 ? Math.min(round2(fade), 60) : DEFAULT_FADE,
    level: Number.isFinite(level) && level >= 1 ? Math.min(level, 100) : 100,
    othersOff: Boolean(raw.othersOff),
    note: typeof raw.note === 'string' ? raw.note.slice(0, 200) : '',
    updatedAt: stampOf(raw.updatedAt),
    ...flashFields(raw, end),
    option: normalizeOption(raw.option),
  };
}

// A flash run owns its own timing, so it drops End; Off cues can't flash.
// outFade: how long the lights take to go out at End, independent of how
// the cue came on (a hit that snaps on and fades away). null = same as on.
function outFadeOf(raw) {
  const out = Number(raw.outFade);
  return raw.outFade !== null && raw.outFade !== undefined && raw.outFade !== '' && Number.isFinite(out) && out >= 0 ? Math.min(round2(out), 30) : null;
}

function flashFields(raw, end) {
  const repeat = raw.action === 'off' ? null : normalizeRepeat(raw.repeat);
  // A run keeps outFade as how each flash eases out (snap up, ease down).
  if (repeat) return { repeat, end: null, outFade: outFadeOf(raw) };
  const out = Number(raw.outFade);
  const hasOut = end !== null && raw.outFade !== null && raw.outFade !== undefined && raw.outFade !== '' && Number.isFinite(out) && out >= 0;
  return { repeat: null, end: end === null ? null : round2(end), outFade: hasOut ? Math.min(round2(out), 30) : null };
}

/* ── options: alternative versions of a passage ───────────────────────── */

// Cues can belong to an option group with named choices, e.g. "Hits" (the
// plan) and "Fade" (a backup in case the tech says no). Only the picked
// choice plays; the cue sheet lists the rest as a backup block.
//   option = { group, label, choice, primary }
function cleanText(v, n) {
  return typeof v === 'string' ? v.trim().slice(0, n) : '';
}

export function normalizeOption(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const group = cleanText(raw.group, 40);
  const choice = cleanText(raw.choice, 30);
  if (!group || !choice) return null;
  return { group, label: cleanText(raw.label, 60) || group, choice, primary: Boolean(raw.primary) };
}

// → [{ group, label, choices: [choice…] (primary first), primary }]
export function optionGroups(cues) {
  const groups = new Map();
  for (const c of sortCues(cues)) {
    if (!c.option) continue;
    const g = groups.get(c.option.group) || { group: c.option.group, label: c.option.label, choices: [], primary: null };
    if (!g.choices.includes(c.option.choice)) g.choices.push(c.option.choice);
    if (c.option.primary && !g.primary) g.primary = c.option.choice;
    groups.set(c.option.group, g);
  }
  for (const g of groups.values()) {
    g.primary = g.primary || g.choices[0];
    g.choices = [g.primary, ...g.choices.filter((ch) => ch !== g.primary)];
  }
  return [...groups.values()];
}

export function pickedChoice(cues, picks, group) {
  const g = optionGroups(cues).find((x) => x.group === group);
  if (!g) return null;
  return g.choices.includes(picks?.[group]) ? picks[group] : g.primary;
}

// The cues that actually run: everything outside option groups, plus the
// picked choice in each group.
export function activeCues(cues, picks = {}) {
  const picked = Object.fromEntries(optionGroups(cues).map((g) => [g.group, g.choices.includes(picks?.[g.group]) ? picks[g.group] : g.primary]));
  return cues.filter((c) => !c.option || picked[c.option.group] === c.option.choice);
}

function normalizePicks(raw) {
  const out = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) if (cleanText(k, 40) && cleanText(v, 30)) out[cleanText(k, 40)] = cleanText(v, 30);
  }
  return out;
}

export function normalizePlan(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Not a cue file.');
  const list = Array.isArray(raw) ? raw : raw.cues;
  if (!Array.isArray(list)) throw new Error('No "cues" list in that file.');
  const seen = new Set();
  const cues = [];
  for (const item of list) {
    const c = normalizeCue(item);
    if (!c) continue;
    if (seen.has(c.id)) c.id = newId();
    seen.add(c.id);
    cues.push(c);
  }
  const audio = raw.audio && typeof raw.audio === 'object' ? raw.audio : {};
  const tempo = normalizeTempo(raw.tempo);
  // Sections share the id space with cues: the merge and delete key on ids.
  const sections = (Array.isArray(raw.sections) ? raw.sections : []).map(normalizeSection).filter(Boolean);
  for (const s of sections) {
    if (seen.has(s.id)) s.id = newId();
    seen.add(s.id);
  }
  return {
    title: typeof raw.title === 'string' ? raw.title.slice(0, 120) : '',
    audio: {
      name: typeof audio.name === 'string' ? audio.name : '',
      duration: Number.isFinite(audio.duration) ? audio.duration : null,
    },
    cues: sortCues(cues),
    tempo,
    sections: sortSections(sections, tempo),
    optionPicks: normalizePicks(raw.optionPicks),
    skipped: list.length - cues.length,
  };
}

export function serializePlan({ title, audio, cues, tempo, sections, optionPicks }) {
  return {
    app: 'lighting-cue-builder',
    version: 1,
    title: title || '',
    audio: { name: audio?.name || '', duration: audio?.duration ?? null },
    exportedAt: new Date().toISOString(),
    lights: GROUPS.map((g) => ({ group: g.id, lights: g.lights })),
    tempo: normalizeTempo(tempo),
    optionPicks: normalizePicks(optionPicks),
    sections: sortSections(sections || [], tempo).map(({ id, name, bar, time, updatedAt }) => ({ id, name, bar, time, updatedAt })),
    cues: sortCues(cues).map(({ id, time, end, outFade, lights, action, color, colorName, level, transition, fade, othersOff, note, repeat, option, updatedAt }) =>
      ({ id, time, end, outFade: outFade ?? null, lights, action, color, colorName, level, transition, fade, othersOff, note, repeat: repeat ?? null, option: option ?? null, updatedAt })),
  };
}

/* ── state at time t ──────────────────────────────────────────────────── */

// Each cue becomes one or two events: the GO at `time`, and — if it has an
// end — an "out" at `end` that takes its own lights dark with the same
// transition. "All others off" applies to every light the cue doesn't name.
function eventsFor(cues) {
  const events = [];
  sortCues(cues).forEach((c, order) => {
    const dur = c.transition === 'fade' ? c.fade : 0;
    const level = c.action === 'on' ? (c.level ?? 100) / 100 : 0;
    // An Off cue keeps whatever colour each light already had.
    const targets = c.lights.map((l) => ({ light: l, level, color: c.action === 'on' ? c.color : null }));
    if (c.othersOff) {
      for (const l of ALL_LIGHTS) if (!c.lights.includes(l)) targets.push({ light: l, level: 0, color: null });
    }
    if (c.repeat && c.action === 'on') {
      pushFlashes(events, c, order, dur, level);
      return;
    }
    events.push({ at: c.time, dur, targets, cue: c.id, order, kind: 'go' });
    if (c.end !== null && c.action === 'on' && c.lights.length) {
      events.push({
        at: c.end, dur: c.outFade ?? dur, cue: c.id, order, kind: 'out',
        targets: c.lights.map((l) => ({ light: l, level: 0, color: null })),
      });
    }
  });
  return events.sort((a, b) => a.at - b.at || a.order - b.order);
}

function pushFlashes(events, c, order, dur, level) {
  const gap = flashGap(c.repeat);
  const onFor = gap * c.repeat.onFrac;
  // Never "dim" above the flash itself.
  const low = Math.min(c.repeat.dimTo || 0, c.level ?? 100) / 100;
  // A fade longer than the flash would never arrive; cap it inside the flash.
  const d = Math.min(dur, onFor * 0.9);
  flashTimes(c).forEach((at, k) => {
    const color = c.repeat.keepColor ? null : k % 2 === 1 && c.repeat.altColor ? c.repeat.altColor : c.color;
    const targets = c.lights.map((l) => ({ light: l, level, color }));
    // "All others off" is a one-time clear at the start of the run.
    if (c.othersOff && k === 0) {
      for (const l of ALL_LIGHTS) if (!c.lights.includes(l)) targets.push({ light: l, level: 0, color: null });
    }
    events.push({ at, dur: d, targets, cue: c.id, order, kind: 'go' });
    if (c.repeat.onFrac < 1) {
      events.push({ at: at + onFor, dur: c.outFade ?? d, cue: c.id, order, kind: 'out', targets: c.lights.map((l) => ({ light: l, level: low, color: null })) });
    }
  });
}

function mix(a, b, k) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex(ca.map((v, i) => v + (cb[i] - v) * k));
}

function sample(seg, t) {
  if (!seg) return { level: 0, color: '#ffffff' };
  const k = seg.dur > 0 ? Math.min(1, Math.max(0, (t - seg.start) / seg.dur)) : 1;
  return {
    level: k >= 1 ? seg.to.level : seg.from.level + (seg.to.level - seg.from.level) * k,
    color: k >= 1 ? seg.to.color : mix(seg.from.color, seg.to.color, k),
  };
}

// → { lights: { [n]: { level 0..1, color, cue } }, activeCue }
export function stateAt(cues, t) {
  const segs = {};
  let activeCue = null;
  for (const ev of eventsFor(cues)) {
    if (ev.at > t) break;
    if (ev.kind === 'go') activeCue = ev.cue;
    for (const tg of ev.targets) {
      const now = sample(segs[tg.light], ev.at);
      // Going dark keeps the colour so a fade-out reads as that colour dimming.
      const color = tg.color ?? now.color;
      // A light that is off takes its new colour instantly; only the level fades.
      const fromColor = now.level <= 0.001 ? color : now.color;
      segs[tg.light] = { start: ev.at, dur: ev.dur, from: { level: now.level, color: fromColor }, to: { level: tg.level, color }, cue: ev.cue };
    }
  }
  const lights = {};
  for (const l of ALL_LIGHTS) {
    const s = sample(segs[l], t);
    lights[l] = { level: s.level, color: s.color, cue: segs[l]?.cue ?? null };
  }
  return { lights, activeCue };
}

/* ── sections ─────────────────────────────────────────────────────────── */

// Sections mark where each song in the mix starts. A section is placed
// either by time or by bar — bars because that's what GarageBand's ruler
// shows. A bar-placed section moves with the tempo setting.
// CHECK: assumes the exported audio starts at bar 1 with no lead-in, and
// that the project uses one tempo and time signature throughout.

export const DEFAULT_TEMPO = { bpm: 120, beatsPerBar: 4 };

export function normalizeTempo(raw) {
  const bpm = Number(raw?.bpm);
  const bpb = Math.round(Number(raw?.beatsPerBar));
  return {
    bpm: Number.isFinite(bpm) && bpm >= 20 && bpm <= 400 ? Math.round(bpm * 100) / 100 : DEFAULT_TEMPO.bpm,
    beatsPerBar: Number.isFinite(bpb) && bpb >= 1 && bpb <= 16 ? bpb : DEFAULT_TEMPO.beatsPerBar,
  };
}

export function barToTime(bar, tempo) {
  const { bpm, beatsPerBar } = normalizeTempo(tempo);
  return ((bar - 1) * beatsPerBar * 60) / bpm;
}

export function timeToBar(time, tempo) {
  const { bpm, beatsPerBar } = normalizeTempo(tempo);
  return 1 + (time * bpm) / (60 * beatsPerBar);
}

// "b15", "bar 15.5", "15.5b" → { bar }. "1:23.4", "83.4" → { time }.
export function parseStart(text) {
  const t = String(text ?? '').trim();
  const m = t.match(/^(?:b(?:ar)?\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*b(?:ar)?)$/i);
  if (m) {
    const bar = Number(m[1] ?? m[2]);
    return bar >= 1 ? { bar, time: null } : null;
  }
  const time = parseTime(t);
  return time === null ? null : { bar: null, time };
}

export function formatStart(sec) {
  return sec.bar !== null && sec.bar !== undefined ? `b${Math.round(sec.bar * 100) / 100}` : formatTime(sec.time);
}

export function normalizeSection(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const bar = Number(raw.bar);
  const hasBar = raw.bar !== null && raw.bar !== undefined && Number.isFinite(bar) && bar >= 1;
  const time = hasBar ? null : parseTime(raw.time);
  if (!hasBar && time === null) return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId(),
    name: typeof raw.name === 'string' ? raw.name.slice(0, 60) : '',
    bar: hasBar ? Math.round(bar * 100) / 100 : null,
    time: hasBar ? null : round2(time),
    updatedAt: stampOf(raw.updatedAt),
  };
}

export function sectionStart(sec, tempo) {
  return sec.bar !== null ? barToTime(sec.bar, tempo) : sec.time;
}

export function sortSections(sections, tempo) {
  return [...sections].sort((a, b) => sectionStart(a, tempo) - sectionStart(b, tempo));
}

// The section playing at time t, or null before the first one.
export function sectionAt(sections, tempo, t) {
  let hit = null;
  for (const s of sortSections(sections, tempo)) {
    if (sectionStart(s, tempo) <= t + 1e-6) hit = s; else break;
  }
  return hit;
}

// One section per line: a start, then a name. "b14.85 Rustage intro",
// "0:37.4 - Raven solo". Blank lines and lines starting with # are skipped.
export function parseSectionLines(text) {
  const sections = [];
  const bad = [];
  String(text ?? '').split(/\r?\n/).forEach((line, i) => {
    const l = line.trim();
    if (!l || l.startsWith('#')) return;
    const m = l.match(/^(b(?:ar)?\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*b(?:ar)?(?![a-z])|(?:\d+:)?\d+(?:\.\d+)?)\s*[-–—:|]?\s*(.*)$/i);
    const start = m && parseStart(m[1]);
    if (!start) { bad.push(i + 1); return; }
    sections.push(normalizeSection({ ...start, name: m[2].trim() }));
  });
  return { sections, bad };
}

/* ── readable cue sheet ───────────────────────────────────────────────── */

export function lightsLabel(lights) {
  if (!lights.length) return '—';
  if (lights.length === ALL_LIGHTS.length) return 'ALL (1–12)';
  const set = new Set(lights);
  const parts = [];
  const rest = new Set(lights);
  for (const g of GROUPS) {
    if (g.lights.length > 1 && g.lights.every((l) => set.has(l))) {
      parts.push(`All ${g.id} (${g.lights.join(',')})`);
      g.lights.forEach((l) => rest.delete(l));
    }
  }
  if (rest.size) parts.push([...rest].sort((a, b) => a - b).join(', '));
  return parts.join(' + ');
}

export function transitionLabel(cue) {
  const verb = cue.action === 'on' ? 'ON' : 'OFF';
  const how = cue.transition === 'fade' ? `Fade ${verb} ${cue.fade}s` : `Snap ${verb}`;
  return how;
}

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s + ' ' : s + ' '.repeat(n - s.length);
}

export function cueSheet({ title, audio, cues, tempo, sections = [], optionPicks = {} }) {
  const sorted = sortCues(activeCues(cues, optionPicks));
  const secs = sortSections(sections, tempo);
  const groups = optionGroups(cues);
  const rows = sorted.map((c, i) => cueRow(c, String(i + 1)));
  // Each option group's backup choices, printed after the group's last cue.
  const backups = groups.map((g) => {
    const picked = g.choices.includes(optionPicks[g.group]) ? optionPicks[g.group] : g.primary;
    const inGroup = sorted.map((c, i) => [c, i]).filter(([c]) => c.option?.group === g.group);
    const after = inGroup.length ? inGroup[inGroup.length - 1][1] : -1;
    const first = inGroup.length ? inGroup[0][1] + 1 : 0;
    const replaces = !inGroup.length ? 'nothing' : first === after + 1 ? `cue ${first}` : `cues ${first}–${after + 1}`;
    const alts = g.choices.filter((ch) => ch !== picked).map((ch) => ({
      choice: ch,
      rows: sortCues(cues.filter((c) => c.option?.group === g.group && c.option.choice === ch)).map((c, j) => cueRow(c, `B${j + 1}`)),
    }));
    return { g, picked, after, replaces, alts };
  });
  const allRows = [...rows, ...backups.flatMap((b) => b.alts.flatMap((a) => a.rows))];
  return renderSheet({ title, audio, sorted, secs, tempo, rows, allRows, backups, groups });
}

function cueRow(c, label) {
  if (c.repeat) {
    const r = c.repeat;
    const color = r.keepColor ? 'each light keeps its colour'
      : `${colorLabel(c)} ${c.color.toUpperCase()}` + (r.altColor ? ` / ${colorLabel({ color: r.altColor, colorName: '' })} ${r.altColor.toUpperCase()} alternating` : '');
    const extras = [c.othersOff ? 'ALL OTHERS OFF at first flash' : '', c.note].filter(Boolean);
    return [label, `${formatTime(c.time, 1)}–${formatTime(flashEnd(c), 1)}`, lightsLabel(c.lights), `${c.level ?? 100}%`, color, flashLabel(c), extras.join(' · ')];
  }
  // A hit: on for a blink, then straight into its fade-out. A range would
  // read "0:28.5–0:28.5" at this resolution, so give the exact start instead.
  if (c.end !== null && c.outFade !== null && c.outFade !== undefined && c.end - c.time < 0.2 && c.action === 'on') {
    const color = `${colorLabel(c)} ${c.color.toUpperCase()}`;
    const extras = [c.othersOff ? 'ALL OTHERS OFF' : '', c.note].filter(Boolean);
    const total = Math.round((c.end - c.time + c.outFade) * 100) / 100;
    return [label, formatTime(c.time, 2), lightsLabel(c.lights), `${c.level ?? 100}%`, color, `${transitionLabel(c)}, fade straight out over ${total}s`, extras.join(' · ')];
  }
  const time = c.end !== null ? `${formatTime(c.time, 1)}–${formatTime(c.end, 1)}` : formatTime(c.time, 1);
  const color = c.action === 'off' ? '—' : `${colorLabel(c)} ${c.color.toUpperCase()}`;
  let transition = transitionLabel(c);
  if (c.end !== null && c.action === 'on') {
    const outFor = c.outFade ?? (c.transition === 'fade' ? c.fade : 0);
    transition += outFor > 0 ? `, fade out ${outFor}s at end` : ', snap out at end';
  }
  const extras = [];
  if (c.othersOff) extras.push('ALL OTHERS OFF');
  if (c.note) extras.push(c.note);
  const level = c.action === 'off' ? '0%' : `${c.level ?? 100}%`;
  return [label, time, lightsLabel(c.lights), level, color, transition, extras.join(' · ')];
}

function renderSheet({ title, audio, sorted, secs, tempo, rows, allRows, backups, groups }) {
  const head = ['CUE', 'TIME', 'LIGHT(S)', 'LEVEL', 'COLOR', 'TRANSITION', 'NOTES'];
  const widths = head.map((h, col) => Math.max(h.length, ...allRows.map((r) => r[col].length)) + 2);
  widths[widths.length - 1] = 0;
  const line = (r) => r.map((cell, col) => (col === r.length - 1 ? cell : pad(cell, widths[col]))).join('').trimEnd();

  const out = [];
  out.push(`LIGHTING CUE SHEET${title ? ' — ' + title : ''}`);
  if (audio?.name) out.push(`Audio: ${audio.name}${audio.duration ? ` (${formatTime(audio.duration, 1)})` : ''}`);
  out.push(`Rig: Apparatus ${Object.entries(APPARATUS).map(([n, what]) => `${n} (${what})`).join(', ')} · Floor 1, 2, 4, 5, 6, 8, 9, 12 · Backdrop 11`);
  out.push(`Times are from the start of the track (m:ss.s). ${sorted.length} cue${sorted.length === 1 ? '' : 's'}${groups.length ? `, plus backup option${groups.length === 1 ? '' : 's'} marked B` : ''}.`);
  out.push('');
  out.push(line(head));
  out.push(line(head.map((h, i) => '-'.repeat(Math.max(h.length, (widths[i] || 12) - 2)))));
  let shown = null;
  rows.forEach((r, i) => {
    const sec = sectionAt(secs, tempo, sorted[i].time);
    if (sec && sec !== shown) {
      out.push('');
      out.push(`— ${sec.name || 'Untitled section'} (from ${formatTime(sectionStart(sec, tempo), 1)}) —`);
      shown = sec;
    }
    out.push(line(r));
    // Spell out every flash so the tech can program or check them one by one.
    if (sorted[i].repeat) {
      const ts = flashTimes(sorted[i]).map((t) => formatTime(t, 2));
      for (let j = 0; j < ts.length; j += 8) out.push(`${' '.repeat(widths[0])}${j === 0 ? 'flashes at ' : '           '}${ts.slice(j, j + 8).join('  ')}`);
    }
    for (const b of backups) {
      if (b.after !== i) continue;
      for (const a of b.alts) {
        out.push('');
        out.push(`  ┌ BACKUP for “${b.g.label}” — if “${b.picked}” is too much, skip ${b.replaces} and run these instead (“${a.choice}”):`);
        a.rows.forEach((br) => out.push(line(br)));
        out.push('  └ end of backup');
        out.push('');
      }
    }
  });
  if (secs.length) {
    out.push('');
    out.push('SECTIONS');
    for (const s of secs) out.push(`  ${formatTime(sectionStart(s, tempo), 1)}  ${s.name || 'Untitled section'}`);
  }
  return out.join('\n') + '\n';
}

/* ── cue grid: one row per moment, one column per light ───────────────── */

// Short names for a grid cell: "lime", "white", or the nearest preset.
export function shortColorName(hex) {
  const h = String(hex).toLowerCase();
  const exact = [...LOGO_COLORS, ...PRESETS].find((p) => p.hex.toLowerCase() === h);
  return (exact ? exact.name : `~${nearestPreset(h).name}`).replace(/^(Titans|Open) /, '').toLowerCase();
}

// A grid cell's fill: the light's colour, darker the dimmer it is, mixed
// toward the "off" grey. Shared by the spreadsheet and the page's grid view.
export function cellColor(hex, level) {
  const k = Math.max(0.25, level / 100);
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return '#' + rgb.map((v) => Math.round(v * k + 40 * (1 - k)).toString(16).padStart(2, '0')).join('');
}

// Black or white text, whichever reads on that fill.
export function inkOn(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 140 ? '#000000' : '#ffffff';
}

const BEAT_WORDS = { 0.25: 'sixteenth', 0.5: 'eighth note', 1: 'beat', 2: '2 beats', 4: '4 beats' };

// Runs that share their timing are described once ("all lights: switch
// colours 8× every beat") rather than once per colour group.
function runEffects(runs) {
  const byTiming = new Map();
  for (const c of runs) {
    const r = c.repeat;
    const k = [r.count, r.beats, r.bpm, r.onFrac, r.dimTo, Boolean(r.altColor)].join('|');
    byTiming.set(k, [...(byTiming.get(k) || []), c]);
  }
  return [...byTiming.values()].map((g) => {
    const r = g[0].repeat;
    const lights = [...new Set(g.flatMap((c) => c.lights))].sort((a, b) => a - b);
    const who = lights.length === ALL_LIGHTS.length ? 'all lights' : `lights ${lights.join(', ')}`;
    const every = `every ${BEAT_WORDS[r.beats] || `${r.beats} beats`} (${flashGap(r).toFixed(2)}s)`;
    if (r.altColor && r.onFrac >= 1) return `${who}: switch colours ${r.count}× ${every}, each light swapping between its two colours`;
    if (r.onFrac < 1) return `${who}: flash ${r.count}× ${every}, on for ${Math.round(r.onFrac * 100)}% of each then ${r.dimTo ? `down to ${r.dimTo}%` : 'dark'}`;
    return `${who}: this look lands ${r.count} times, ${every}, taking turns with the next row`;
  }).join('; ');
}

// → [{ time, section, how, effect, notes, lights: [{ hex, name, level } | null] × 12 }]
// Each light shows what it looks like once the row's cues have landed: after
// the longest fade starting there, but never past the next row.
export function cueGrid({ cues, tempo, sections = [], optionPicks = {} }, { from = 0, to = Infinity } = {}) {
  const live = activeCues(cues, optionPicks);
  const times = [...new Set(live.map((c) => c.time))].sort((a, b) => a - b);
  return times.map((t, i) => ({ t, next: times[i + 1] })).filter(({ t }) => t >= from && t < to).map(({ t, next }) => {
    const here = sortCues(live.filter((c) => c.time === t));
    const settle = Math.max(0.02, ...here.filter((c) => c.transition === 'fade').map((c) => c.fade));
    const at = next === undefined ? t + settle : Math.min(t + settle, next - 0.01);
    const st = stateAt(live, at).lights;
    const fades = here.filter((c) => c.transition === 'fade' && !c.repeat).map((c) => c.fade);
    const outs = here.filter((c) => c.outFade && !c.repeat).map((c) => c.outFade);
    const how = [fades.length ? `fade ${Math.max(...fades)}s` : 'snap', outs.length ? `then fade out over ${Math.max(...outs)}s` : ''].filter(Boolean).join(', ');
    const sec = sectionAt(sections, tempo, t);
    return {
      time: formatTime(t),
      section: sec ? sec.name || 'Untitled section' : '',
      how,
      effect: runEffects(here.filter((c) => c.repeat)),
      notes: here.map((c) => c.note).filter(Boolean).join(' '),
      lights: ALL_LIGHTS.map((l) => {
        const s = st[l];
        return s && s.level > 0.02 ? { hex: s.color, name: shortColorName(s.color), level: Math.round(s.level * 100) } : null;
      }),
    };
  });
}

// The backup choice of each option group, as its own short stretch of grid.
export function backupGrids(plan) {
  return optionGroups(plan.cues).map((g) => {
    const alt = g.choices.find((ch) => ch !== pickedChoice(plan.cues, plan.optionPicks, g.group));
    if (!alt) return null;
    const ts = plan.cues.filter((c) => c.option?.group === g.group).map((c) => c.time);
    const rows = cueGrid({ ...plan, optionPicks: { ...plan.optionPicks, [g.group]: alt } }, { from: Math.min(...ts), to: Math.max(...ts) + 0.01 });
    return { label: g.label, choice: alt, rows };
  }).filter(Boolean);
}

/* ── run sheet: named looks, one plain instruction per cue ────────────── */

// Levels round to 5% so a fade that lands a hair short still matches.
function lightsAt(live, t) {
  const st = stateAt(live, t).lights;
  return ALL_LIGHTS.map((l) => {
    const s = st[l];
    return s && s.level > 0.02 ? { hex: s.color, name: shortColorName(s.color), level: Math.round(s.level * 20) * 5 } : null;
  });
}
const lookKey = (lights) => lights.map((x) => (x ? `${x.hex}@${x.level}` : '-')).join('|');

// A tech programs each distinct look once and the show becomes "go to
// Intro A, chase Intro A ⇄ Intro B…". Looks are named after the section they
// first appear in (Intro A, Intro B…), or "All orange" / "Blackout" when every
// light matches. A look that comes back later keeps its first name.
// → { looks: [{ name, lights, uses, first }], rows: [{ n, t, time, section, look, action, notes }] }
export function runSheet({ cues, tempo, sections = [], optionPicks = {} }) {
  const live = activeCues(cues, optionPicks);
  const times = [...new Set(live.map((c) => c.time))].sort((a, b) => a - b);
  const raw = times.map((t, i) => {
    const next = times[i + 1];
    const here = sortCues(live.filter((c) => c.time === t));
    const run = here.find((c) => c.repeat);
    const settle = Math.max(0.02, ...here.filter((c) => c.transition === 'fade').map((c) => c.fade));
    const at = next === undefined ? t + settle : Math.min(t + settle, next - 0.01);
    let kind = 'look';
    let samples = [lightsAt(live, at)];
    if (run?.repeat.altColor && run.repeat.onFrac >= 1 && run.repeat.count >= 2) {
      const [a, b] = flashTimes(run);
      kind = 'chase';
      samples = [lightsAt(live, a + 0.01), lightsAt(live, b + 0.01)];
    } else if (run?.repeat.onFrac < 1) {
      kind = 'strobe';
      samples = [lightsAt(live, t + 0.01)];
    } else if (run) {
      kind = 'repeat';
    }
    return { t, at, here, run, kind, samples };
  });

  // Name every look the first time it appears.
  const looks = new Map(); // key → { name?, lights, uses, first, short }
  const bySection = new Map(); // short section name → [keys]
  for (const r of raw) {
    for (const lights of r.samples) {
      const key = lookKey(lights);
      if (looks.has(key)) { looks.get(key).uses += 1; continue; }
      const lit = lights.filter(Boolean);
      const look = { lights, uses: 1, first: formatTime(r.t) };
      if (!lit.length) look.name = 'Blackout';
      else if (lit.length === ALL_LIGHTS.length && new Set(lit.map((x) => `${x.hex}@${x.level}`)).size === 1) {
        look.name = `All ${lit[0].name}${lit[0].level < 100 ? ` ${lit[0].level}%` : ''}`;
      } else {
        const sec = sectionAt(sections, tempo, r.at);
        // The opening song's looks come back at the end, so they get the
        // plainest name: Intro A, Intro B.
        const opening = sec && sec === sortSections(sections, tempo)[0];
        const short = opening ? 'Intro' : (sec?.name || 'Look').replace(/\s*\(.*\)\s*$/, '').replace(/ intro$/i, '');
        bySection.set(short, [...(bySection.get(short) || []), key]);
        look.short = short;
      }
      looks.set(key, look);
    }
  }
  for (const [short, keys] of bySection) {
    keys.forEach((k, i) => { looks.get(k).name = keys.length > 1 ? `${short} ${String.fromCharCode(65 + i)}` : short; });
  }

  const name = (lights) => looks.get(lookKey(lights)).name;
  const beatText = (r) => `every ${BEAT_WORDS[r.beats] || `${r.beats} beats`} (${flashGap(r).toFixed(2)}s)`;
  let lastSection = null;
  const rows = raw.map((r, i) => {
    const look = name(r.samples[0]);
    const fades = r.here.filter((c) => c.transition === 'fade' && !c.repeat).map((c) => c.fade);
    const outs = r.here.filter((c) => c.outFade && !c.repeat).map((c) => c.outFade);
    let action;
    if (r.kind === 'chase') action = `Chase ${look} ⇄ ${name(r.samples[1])}, ${beatText(r.run.repeat)}, ${r.run.repeat.count} steps`;
    else if (r.kind === 'strobe') action = `Strobe ${look}, ${beatText(r.run.repeat)}, ${r.run.repeat.count} flashes, dark between`;
    else if (r.kind === 'repeat') action = `${look}, and again ${beatText(r.run.repeat)}, ${r.run.repeat.count}× in all, taking turns with the next row`;
    else if (look === 'Blackout') action = fades.length ? `Fade to black over ${Math.max(...fades)}s` : 'Cut to black';
    else if (fades.length) action = `Fade to ${look} over ${Math.max(...fades)}s`;
    else action = `Snap to ${look}${outs.length ? `, then fade out over ${Math.max(...outs)}s` : ''}`;
    const sec = sectionAt(sections, tempo, r.t);
    const secName = sec ? sec.name || 'Untitled section' : '';
    const section = secName !== lastSection ? secName : '';
    lastSection = secName;
    return { n: i + 1, t: r.t, time: formatTime(r.t), section, look: r.kind === 'chase' ? `${look} ⇄ ${name(r.samples[1])}` : look, action, notes: r.here.map((c) => c.note).filter(Boolean).join(' ') };
  });
  return { looks: [...looks.values()].map(({ name: n, lights, uses, first }) => ({ name: n, lights, uses, first })), rows };
}

/* ── plan signature ───────────────────────────────────────────────────── */

// A short fingerprint of what a plan says: title, tempo, sections, cues.
// Leaves out edit stamps and the loaded audio's metadata, which change
// without anyone editing anything. Used to tell whether a browser's plan
// is still exactly the show plan it last took on.
export function planSignature(plan) {
  const strip = ({ updatedAt, ...rest }) => rest;
  const p = serializePlan(plan);
  const text = JSON.stringify({
    title: p.title, tempo: p.tempo, optionPicks: p.optionPicks,
    sections: p.sections.map(strip),
    cues: p.cues.map(strip),
  });
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return `${h.toString(36)}-${text.length.toString(36)}`;
}

/* ── share links ──────────────────────────────────────────────────────── */

function toB64Url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(str) {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

async function pipe(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeShare(plan) {
  const json = JSON.stringify(serializePlan(plan));
  const packed = await pipe(new TextEncoder().encode(json), new CompressionStream('deflate-raw'));
  return toB64Url(packed);
}

export async function decodeShare(token) {
  const bytes = await pipe(fromB64Url(token), new DecompressionStream('deflate-raw'));
  return normalizePlan(JSON.parse(new TextDecoder().decode(bytes)));
}

/* ── merging two copies of a plan ─────────────────────────────────────── */

// Two people edit their own copies and trade JSON files. Cues and sections
// keep their ids through export and import, so items are matched by id.
// With only the two copies (no common ancestor) the merge can't tell a
// deletion on one side from an addition on the other, or which side made an
// edit — so it reports every difference and pre-picks a default, and the
// person decides. The newer edit is the default where both copies have an item.

const CUE_FIELDS = ['time', 'end', 'outFade', 'lights', 'action', 'color', 'colorName', 'level', 'transition', 'fade', 'othersOff', 'note', 'repeat', 'option'];
const SECTION_FIELDS = ['name', 'bar', 'time'];

function sameItem(a, b, fields) {
  return fields.every((f) => JSON.stringify(a[f] ?? null) === JSON.stringify(b[f] ?? null));
}

function diffList(kind, mine, theirs, fields) {
  const out = [];
  const theirById = new Map(theirs.map((x) => [x.id, x]));
  const mineIds = new Set(mine.map((x) => x.id));
  for (const m of mine) {
    const t = theirById.get(m.id);
    if (!t) out.push({ kind, id: m.id, status: 'mine-only', mine: m, theirs: null, pick: 'mine' });
    else if (sameItem(m, t, fields)) out.push({ kind, id: m.id, status: 'same', mine: m, theirs: t, pick: 'mine' });
    else out.push({ kind, id: m.id, status: 'differ', mine: m, theirs: t, pick: (t.updatedAt || 0) > (m.updatedAt || 0) ? 'theirs' : 'mine' });
  }
  for (const t of theirs) {
    if (!mineIds.has(t.id)) out.push({ kind, id: t.id, status: 'theirs-only', mine: null, theirs: t, pick: 'theirs' });
  }
  return out;
}

// → { items, settings, counts }. Each item's `pick` is the default:
// 'mine' | 'theirs' to keep that version, 'drop' to leave it out.
export function diffPlans(mine, theirs) {
  const items = [
    ...diffList('cue', mine.cues, theirs.cues, CUE_FIELDS),
    ...diffList('section', mine.sections || [], theirs.sections || [], SECTION_FIELDS),
  ];
  const settings = [];
  if ((mine.title || '') !== (theirs.title || '')) {
    settings.push({ key: 'title', mine: mine.title || '', theirs: theirs.title, pick: mine.title ? 'mine' : 'theirs' });
  }
  const mt = normalizeTempo(mine.tempo);
  const tt = normalizeTempo(theirs.tempo);
  if (mt.bpm !== tt.bpm || mt.beatsPerBar !== tt.beatsPerBar) {
    settings.push({ key: 'tempo', mine: mt, theirs: tt, pick: 'mine' });
  }
  const counts = { same: 0, differ: 0, 'mine-only': 0, 'theirs-only': 0 };
  for (const it of items) counts[it.status] += 1;
  return { items, settings, counts };
}

// picks: { [itemId or settingKey]: 'mine' | 'theirs' | 'drop' }, overriding defaults.
export function applyMerge(mine, theirs, diff, picks = {}) {
  const choose = (it) => picks[it.id] ?? it.pick;
  const keep = (kind) => diff.items
    .filter((it) => it.kind === kind)
    .map((it) => {
      const p = choose(it);
      if (p === 'drop') return null;
      return p === 'theirs' ? (it.theirs ?? it.mine) : (it.mine ?? it.theirs);
    })
    .filter(Boolean)
    .map((x) => structuredClone(x));
  const setting = (key, fallback) => {
    const s = diff.settings.find((x) => x.key === key);
    if (!s) return fallback;
    return (picks[key] ?? s.pick) === 'theirs' ? s.theirs : s.mine;
  };
  const tempo = normalizeTempo(setting('tempo', mine.tempo));
  return {
    title: setting('title', mine.title || ''),
    audio: mine.audio,
    optionPicks: mine.optionPicks || {},
    tempo,
    cues: sortCues(keep('cue')),
    sections: sortSections(keep('section'), tempo),
  };
}
