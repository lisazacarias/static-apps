// Pure cue logic: the rig, time formatting, what every light is doing at a
// given moment, import/export normalisation and the plain-text cue sheet.
// No DOM in here, so the Node tests exercise exactly what the page runs.

export const GROUPS = [
  { id: 'apparatus', label: 'Apparatus spots', lights: [3, 7, 10] },
  { id: 'floor', label: 'Floor spots', lights: [1, 2, 4, 5, 6, 8, 9, 12] },
  { id: 'backdrop', label: 'Backdrop', lights: [11] },
];

export const ALL_LIGHTS = GROUPS.flatMap((g) => g.lights).sort((a, b) => a - b);

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
  const exact = PRESETS.find((p) => p.hex.toLowerCase() === cue.color.toLowerCase());
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
    transition: 'sharp',
    fade: DEFAULT_FADE,
    othersOff: false,
    note: '',
  };
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
    othersOff: Boolean(raw.othersOff),
    note: typeof raw.note === 'string' ? raw.note.slice(0, 200) : '',
  };
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
  return {
    title: typeof raw.title === 'string' ? raw.title.slice(0, 120) : '',
    audio: {
      name: typeof audio.name === 'string' ? audio.name : '',
      duration: Number.isFinite(audio.duration) ? audio.duration : null,
    },
    cues: sortCues(cues),
    skipped: list.length - cues.length,
  };
}

export function serializePlan({ title, audio, cues }) {
  return {
    app: 'lighting-cue-builder',
    version: 1,
    title: title || '',
    audio: { name: audio?.name || '', duration: audio?.duration ?? null },
    exportedAt: new Date().toISOString(),
    lights: GROUPS.map((g) => ({ group: g.id, lights: g.lights })),
    cues: sortCues(cues).map(({ id, time, end, lights, action, color, colorName, transition, fade, othersOff, note }) =>
      ({ id, time, end, lights, action, color, colorName, transition, fade, othersOff, note })),
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
    const level = c.action === 'on' ? 1 : 0;
    // An Off cue keeps whatever colour each light already had.
    const targets = c.lights.map((l) => ({ light: l, level, color: c.action === 'on' ? c.color : null }));
    if (c.othersOff) {
      for (const l of ALL_LIGHTS) if (!c.lights.includes(l)) targets.push({ light: l, level: 0, color: null });
    }
    events.push({ at: c.time, dur, targets, cue: c.id, order, kind: 'go' });
    if (c.end !== null && c.action === 'on' && c.lights.length) {
      events.push({
        at: c.end, dur, cue: c.id, order, kind: 'out',
        targets: c.lights.map((l) => ({ light: l, level: 0, color: null })),
      });
    }
  });
  return events.sort((a, b) => a.at - b.at || a.order - b.order);
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
    level: seg.from.level + (seg.to.level - seg.from.level) * k,
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

export function cueSheet({ title, audio, cues }) {
  const sorted = sortCues(cues);
  const rows = sorted.map((c, i) => {
    const time = c.end !== null ? `${formatTime(c.time, 1)}–${formatTime(c.end, 1)}` : formatTime(c.time, 1);
    const color = c.action === 'off' ? '—' : `${colorLabel(c)} ${c.color.toUpperCase()}`;
    let transition = transitionLabel(c);
    if (c.end !== null && c.action === 'on') {
      transition += c.transition === 'fade' ? `, fade out ${c.fade}s at end` : ', snap out at end';
    }
    const extras = [];
    if (c.othersOff) extras.push('ALL OTHERS OFF');
    if (c.note) extras.push(c.note);
    return [String(i + 1), time, lightsLabel(c.lights), color, transition, extras.join(' · ')];
  });
  const head = ['CUE', 'TIME', 'LIGHT(S)', 'COLOR', 'TRANSITION', 'NOTES'];
  const widths = head.map((h, col) => Math.max(h.length, ...rows.map((r) => r[col].length)) + 2);
  widths[widths.length - 1] = 0;
  const line = (r) => r.map((cell, col) => (col === r.length - 1 ? cell : pad(cell, widths[col]))).join('').trimEnd();

  const out = [];
  out.push(`LIGHTING CUE SHEET${title ? ' — ' + title : ''}`);
  if (audio?.name) out.push(`Audio: ${audio.name}${audio.duration ? ` (${formatTime(audio.duration, 1)})` : ''}`);
  out.push(`Rig: Apparatus 3, 7, 10 · Floor 1, 2, 4, 5, 6, 8, 9, 12 · Backdrop 11`);
  out.push(`Times are from the start of the track (m:ss.s). ${sorted.length} cue${sorted.length === 1 ? '' : 's'}.`);
  out.push('');
  out.push(line(head));
  out.push(line(head.map((h, i) => '-'.repeat(Math.max(h.length, (widths[i] || 12) - 2)))));
  rows.forEach((r) => out.push(line(r)));
  return out.join('\n') + '\n';
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
