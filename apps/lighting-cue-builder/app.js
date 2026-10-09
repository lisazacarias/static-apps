import {
  GROUPS, ALL_LIGHTS, PRESETS, groupOf, formatTime, parseTime, blankCue, sortCues,
  normalizePlan, serializePlan, stateAt, cueSheet, lightsLabel, colorLabel,
  transitionLabel, encodeShare, decodeShare, DEFAULT_FADE,
  APPARATUS, LOGO_COLORS, normalizeRepeat, flashGap, flashTimes, flashEnd, flashesPerSecond, fitTaps,
  DEFAULT_TEMPO, normalizeTempo, parseStart, formatStart, normalizeSection,
  sectionStart, sortSections, sectionAt, parseSectionLines, timeToBar,
  diffPlans, applyMerge, planSignature, activeCues, optionGroups,
} from './cues.js';

// localStorage is shared by every app on the Pages origin — keep the prefix.
const STORE_KEY = 'lighting-cue-builder:plan';
const DB_NAME = 'lighting-cue-builder';
const ZOOM_WINDOW = 8; // seconds shown in the detail waveform
const PEAKS_PER_SEC = 200;

const $ = (id) => document.getElementById(id);

/* ── stage geometry, traced from the venue diagram ───────────────────── */

const SHAPES = {
  1: { cx: 660, cy: 490, rx: 44, ry: 78, rot: 12, lx: 646, ly: 520 },
  2: { cx: 727, cy: 632, rx: 78, ry: 70, lx: 721, ly: 636 },
  3: { cx: 762, cy: 470, rx: 80, ry: 88, lx: 762, ly: 524 },
  4: { cx: 868, cy: 495, rx: 52, ry: 86, rot: -28, lx: 880, ly: 512 },
  5: { cx: 997, cy: 690, rx: 60, ry: 68, lx: 995, ly: 702 },
  6: { cx: 995, cy: 557, rx: 62, ry: 64, lx: 997, ly: 565 },
  7: { cx: 897, cy: 667, rx: 88, ry: 90, lx: 894, ly: 648 },
  8: { cx: 912, cy: 830, rx: 50, ry: 68, lx: 903, ly: 830 },
  9: { cx: 817, cy: 770, rx: 46, ry: 56, rot: -38, lx: 814, ly: 782 },
  10: { cx: 729, cy: 865, rx: 98, ry: 82, lx: 727, ly: 824 },
  11: { rect: true, x: 520, y: 972, w: 536, h: 84, lx: 788, ly: 1026 },
  12: { cx: 637, cy: 748, rx: 50, ry: 80, lx: 633, ly: 761 },
};
// Painter's order: backdrop under floor under apparatus, as in the diagram.
const DRAW_ORDER = [11, 1, 2, 4, 5, 6, 8, 9, 12, 3, 7, 10];

/* ── state ───────────────────────────────────────────────────────────── */

// Checked before anything saves: a browser that has never saved a plan
// starts from the show plan rather than an empty list.
const firstVisit = (() => { try { return localStorage.getItem(STORE_KEY) === null; } catch { return false; } })();
let plan = loadPlan();          // { title, audio:{name,duration}, cues, tempo, sections }
let ownPlan = null;             // stashed while viewing a shared link
let viewingShared = false;
let presenting = false;
let editing = null;             // { draft, isNew } while the editor is open
let undo = null;                // { plan, label }
let peaks = null;               // Float32Array, PEAKS_PER_SEC buckets
let loop = null;                // { center, start, end }
let lastFrame = { t: -1, key: '' };
let dirtyStage = true;
let dirtyWave = true;

const audio = new Audio();
audio.preload = 'auto';
let audioURL = null;
let audioName = '';

/* ── persistence ─────────────────────────────────────────────────────── */

function loadPlan() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return normalizePlan(JSON.parse(raw));
  } catch { /* fall through to an empty plan */ }
  return emptyPlan();
}

function emptyPlan() {
  return { title: '', audio: { name: '', duration: null }, cues: [], tempo: { ...DEFAULT_TEMPO }, sections: [], optionPicks: {} };
}

function planFrom(p) {
  return { title: p.title, audio: p.audio, cues: p.cues, tempo: normalizeTempo(p.tempo), sections: p.sections || [], optionPicks: p.optionPicks || {} };
}

function savePlan() {
  if (viewingShared) return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(serializePlan(plan)));
    $('saveState').textContent = `Saved in this browser · ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. Export JSON to keep a backup or send a copy.`;
  } catch {
    $('saveState').textContent = 'Could not save in this browser (private window or storage full) — export JSON to keep your work.';
  }
}

function commit() {
  plan.cues = sortCues(plan.cues);
  plan.sections = sortSections(plan.sections, plan.tempo);
  savePlan();
  showExpectedAudio();
  renderSections();
  renderCueList();
  dirtyStage = dirtyWave = true;
}

function snapshot(label) {
  undo = { plan: structuredClone(plan), label };
}

// The audio itself lives in IndexedDB so a reload doesn't mean re-picking
// the file. It never leaves the device.
function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('audio');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(value) {
  try {
    const db = await idb();
    await new Promise((res, rej) => {
      const tx = db.transaction('audio', 'readwrite');
      tx.objectStore('audio').put(value, 'current');
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  } catch {
    // The cue list still saves; only the audio needs re-picking after a reload.
    notify('This browser couldn’t keep a copy of the audio (private window or storage full) — you’ll need to pick the file again after a reload. Your cues are unaffected.');
  }
}
async function idbGet() {
  try {
    const db = await idb();
    return await new Promise((res, rej) => {
      const req = db.transaction('audio').objectStore('audio').get('current');
      req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error);
    });
  } catch { return null; }
}

/* ── notices ─────────────────────────────────────────────────────────── */

let noticeTimer = 0;
function notify(msg, { error = false, withUndo = false, sticky = false, action = null } = {}) {
  const el = $('notice');
  el.className = 'notice' + (error ? ' is-error' : '');
  el.textContent = msg;
  if (action) {
    const b = document.createElement('button');
    b.className = 'btn small';
    b.style.marginLeft = '10px';
    b.textContent = action.label;
    b.onclick = () => { el.hidden = true; action.run(); };
    el.append(b);
  }
  if (withUndo && undo) {
    const b = document.createElement('button');
    b.className = 'btn small';
    b.style.marginLeft = '10px';
    b.textContent = 'Undo';
    b.onclick = () => {
      plan = undo.plan; undo = null;
      $('title').value = plan.title;
      syncTempoInputs();
      commit();
      notify('Undone.');
    };
    el.append(b);
  }
  el.hidden = false;
  clearTimeout(noticeTimer);
  if (!sticky) noticeTimer = setTimeout(() => { el.hidden = true; }, withUndo ? 9000 : 5000);
}

/* ── audio ───────────────────────────────────────────────────────────── */

async function loadAudio(blob, name, { persist = true } = {}) {
  if (audioURL) URL.revokeObjectURL(audioURL);
  audioURL = URL.createObjectURL(blob);
  audioName = name;
  loop = null;
  audio.src = audioURL;
  audio.playbackRate = Number($('rate').value);
  $('audioEmpty').hidden = true;
  $('audioLoaded').hidden = false;
  $('trackName').textContent = name;
  $('trackName').title = name;
  peaks = null;
  dirtyWave = true;
  if (persist) idbPut({ name, blob });
  if (plan.audio.name && plan.audio.name !== name && plan.cues.length) {
    notify(`Heads up: this cue list was built against "${plan.audio.name}", and you loaded "${name}". Times may not line up.`, { sticky: false });
  }
  // The waveform is a nicety: decode it in the background so playback and
  // the stage never wait on it (a 5 MB track takes a second or more).
  const forURL = audioURL;
  blob.arrayBuffer().then(computePeaks).then((p) => {
    if (audioURL === forURL) { peaks = p; dirtyWave = true; }
  }).catch(() => {
    notify('Playback works, but this browser could not draw the waveform for that file.');
  });
}

async function computePeaks(buf) {
  // An OfflineAudioContext decodes without needing a click first, which a
  // live AudioContext does in Safari.
  const ctx = window.OfflineAudioContext
    ? new OfflineAudioContext(1, 1, 44100)
    : new (window.AudioContext || window.webkitAudioContext)();
  try {
    const decoded = await ctx.decodeAudioData(buf);
    const per = Math.max(1, Math.floor(decoded.sampleRate / PEAKS_PER_SEC));
    const n = Math.ceil(decoded.length / per);
    const out = new Float32Array(n);
    const chans = [];
    for (let c = 0; c < decoded.numberOfChannels; c++) chans.push(decoded.getChannelData(c));
    for (let i = 0; i < n; i++) {
      let m = 0;
      const end = Math.min(decoded.length, (i + 1) * per);
      for (let j = i * per; j < end; j += 2) {
        for (const ch of chans) { const v = Math.abs(ch[j]); if (v > m) m = v; }
      }
      out[i] = m;
    }
    let max = 0;
    for (const v of out) if (v > max) max = v;
    if (max > 0) for (let i = 0; i < n; i++) out[i] /= max;
    return out;
  } finally {
    ctx.close?.();
  }
}

function duration() {
  return Number.isFinite(audio.duration) ? audio.duration : 0;
}

function now() {
  return audio.currentTime || 0;
}

function seek(t) {
  const d = duration();
  t = Math.max(0, d ? Math.min(d, t) : t);
  if (loop && (t < loop.start - 0.01 || t > loop.end + 0.01)) setLoop(false);
  audio.currentTime = t;
  dirtyStage = true;
}

function togglePlay() {
  if (!audio.src) return;
  if (audio.paused) audio.play().catch(() => notify('The browser blocked playback — click Play again.', { error: true }));
  else audio.pause();
}

function setLoop(on) {
  if (on) {
    const len = Number($('loopLen').value);
    const center = loop ? loop.center : now();
    loop = { center, start: Math.max(0, center - len), end: Math.min(duration() || Infinity, center + len) };
    audio.currentTime = loop.start;
    if (audio.paused) togglePlay();
  } else {
    loop = null;
  }
  $('loopBtn').setAttribute('aria-pressed', String(Boolean(loop)));
  dirtyWave = true;
}

audio.addEventListener('play', () => { $('playBtn').textContent = '❚❚ Pause'; });
audio.addEventListener('pause', () => { $('playBtn').textContent = '▶ Play'; });
audio.addEventListener('loadedmetadata', () => {
  $('timeTotal').textContent = formatTime(duration());
  if (!viewingShared && (plan.audio.name !== audioName || plan.audio.duration !== duration())) {
    plan.audio = { name: audioName, duration: Math.round(duration() * 100) / 100 };
    savePlan();
  }
  dirtyWave = true;
});
audio.addEventListener('seeked', () => { dirtyStage = true; });
audio.addEventListener('error', () => {
  if (audio.src) notify('That file could not be played in this browser. Try an MP3, M4A or WAV.', { error: true });
});

function bindFileInput(input) {
  input.addEventListener('change', () => {
    const f = input.files?.[0];
    if (f) loadAudio(f, f.name);
    input.value = '';
  });
}
bindFileInput($('audioFile'));
bindFileInput($('audioFile2'));

const drop = $('audioEmpty');
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('dragover'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('dragover'); }));
drop.addEventListener('drop', (e) => {
  const f = [...(e.dataTransfer?.files || [])].find((x) => x.type.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|aac|flac)$/i.test(x.name));
  if (f) loadAudio(f, f.name);
  else notify('That doesn\'t look like an audio file.', { error: true });
});

/* ── waveform ────────────────────────────────────────────────────────── */

function sizeCanvas(cv) {
  const r = cv.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(r.width * dpr));
  const h = Math.max(1, Math.round(r.height * dpr));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  return { w, h, dpr };
}

function peakAt(t0, t1) {
  if (!peaks) return 0;
  const a = Math.max(0, Math.floor(t0 * PEAKS_PER_SEC));
  const b = Math.min(peaks.length, Math.max(a + 1, Math.ceil(t1 * PEAKS_PER_SEC)));
  let m = 0;
  for (let i = a; i < b; i++) if (peaks[i] > m) m = peaks[i];
  return m;
}

function drawWave(cv, t0, t1, { ticks = false, labels = false } = {}) {
  const { w, h, dpr } = sizeCanvas(cv);
  const g = cv.getContext('2d');
  g.clearRect(0, 0, w, h);
  const span = t1 - t0;
  if (span <= 0) return;
  const x = (t) => ((t - t0) / span) * w;

  if (loop) {
    g.fillStyle = 'rgba(212,169,106,0.14)';
    g.fillRect(x(loop.start), 0, x(loop.end) - x(loop.start), h);
  }

  if (ticks) {
    g.fillStyle = 'rgba(158,130,131,0.55)';
    g.font = `${10 * dpr}px "Fira Code", monospace`;
    for (let s = Math.ceil(t0 * 2) / 2; s <= t1; s += 0.5) {
      const whole = Math.abs(s - Math.round(s)) < 1e-6;
      g.fillRect(Math.round(x(s)), 0, 1, whole ? 8 * dpr : 4 * dpr);
      if (whole && s >= 0) g.fillText(formatTime(s, 0), x(s) + 3 * dpr, 10 * dpr);
    }
  }

  const mid = h / 2;
  const cur = now();
  const step = Math.max(1, Math.round(dpr));
  for (let px = 0; px < w; px += step) {
    const ta = t0 + (px / w) * span;
    const tb = t0 + ((px + step) / w) * span;
    if (tb < 0 || ta > (duration() || Infinity)) continue;
    const v = peaks ? peakAt(ta, tb) : 0.04;
    const hh = Math.max(1, v * (h * 0.44));
    g.fillStyle = ta < cur ? 'rgba(232,180,182,0.75)' : 'rgba(143,180,212,0.55)';
    g.fillRect(px, mid - hh, step, hh * 2);
  }

  sortSections(plan.sections, plan.tempo).forEach((sec, i) => {
    const st = sectionStart(sec, plan.tempo);
    if (st < t0 || st > t1) return;
    const sx = Math.round(x(st));
    g.fillStyle = sectionColor(i);
    g.fillRect(sx, 0, Math.max(1, dpr), h);
    g.fillRect(sx, 0, 6 * dpr, 3 * dpr);
    if (labels) {
      g.font = `${10 * dpr}px "Mulish", sans-serif`;
      g.fillText(sec.name || 'Section', sx + 4 * dpr, 22 * dpr);
    }
  });

  for (const [i, c] of sortCues(runningCues()).entries()) {
    const marks = [[c.time, true]];
    if (c.repeat) flashTimes(c).slice(1).forEach((t) => marks.push([t, false]));
    else if (c.end !== null) marks.push([c.end, false]);
    for (const [t, isStart] of marks) {
      if (t < t0 || t > t1) continue;
      const cx = Math.round(x(t));
      g.fillStyle = c.action === 'off' ? '#9a8a8b' : c.color;
      g.globalAlpha = isStart ? 0.95 : 0.5;
      g.fillRect(cx, 0, Math.max(1, dpr * (isStart ? 2 : 1)), h);
      if (c.transition === 'fade' && isStart) {
        g.globalAlpha = 0.18;
        g.fillRect(cx, 0, x(t + c.fade) - cx, h);
      }
      g.globalAlpha = 1;
      if (labels && isStart) {
        g.font = `600 ${11 * dpr}px "Fira Code", monospace`;
        g.fillStyle = '#f5eeee';
        g.fillText(`Q${i + 1}`, cx + 4 * dpr, h - 6 * dpr);
      }
    }
  }
}

function renderWaves() {
  const d = duration();
  if (!audio.src) return;
  drawWave($('wave'), 0, d || 1);
  const t = now();
  drawWave($('zoom'), t - ZOOM_WINDOW / 2, t + ZOOM_WINDOW / 2, { ticks: true, labels: true });
  $('playhead').style.left = d ? `calc(${(t / d) * 100}% - 1px)` : '0';
}

function scrubber(wrap, toTime) {
  let down = null;
  wrap.addEventListener('pointerdown', (e) => {
    if (!audio.src) return;
    wrap.setPointerCapture(e.pointerId);
    down = { x: e.clientX, t: now(), moved: false };
    toTime(e, down, false);
  });
  wrap.addEventListener('pointermove', (e) => { if (down) toTime(e, down, true); });
  const end = (e) => { if (down) { toTime(e, down, 'up'); down = null; } };
  wrap.addEventListener('pointerup', end);
  wrap.addEventListener('pointercancel', () => { down = null; });
}

scrubber($('waveWrap'), (e) => {
  const r = $('waveWrap').getBoundingClientRect();
  seek(((e.clientX - r.left) / r.width) * duration());
});

// The detail strip drags like tape: pull left to move forward. A click
// without a drag jumps to the clicked moment.
scrubber($('zoomWrap'), (e, down, phase) => {
  const r = $('zoomWrap').getBoundingClientRect();
  const spp = ZOOM_WINDOW / r.width;
  const dx = e.clientX - down.x;
  if (Math.abs(dx) > 3) down.moved = true;
  if (phase === true && down.moved) seek(down.t - dx * spp);
  if (phase === 'up' && !down.moved) seek(down.t + (e.clientX - (r.left + r.width / 2)) * spp);
});

/* ── stage ───────────────────────────────────────────────────────────── */

const SVGNS = 'http://www.w3.org/2000/svg';
const lightEls = {};

function svg(tag, attrs) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function shapeEl(s, extra = {}) {
  if (s.rect) return svg('rect', { x: s.x, y: s.y, width: s.w, height: s.h, rx: 18, ...extra });
  return svg('ellipse', {
    cx: s.cx, cy: s.cy, rx: s.rx, ry: s.ry,
    ...(s.rot ? { transform: `rotate(${s.rot} ${s.cx} ${s.cy})` } : {}),
    ...extra,
  });
}

function buildStage() {
  const layer = $('lightsLayer');
  const labels = svg('g', {});
  for (const n of DRAW_ORDER) {
    const s = SHAPES[n];
    const g = svg('g', { class: `light g-${groupOf(n)}`, 'data-light': n });
    const title = svg('title', {});
    title.textContent = `Light ${n} · ${GROUPS.find((x) => x.id === groupOf(n)).label}${APPARATUS[n] ? ` (${APPARATUS[n]})` : ''}`;
    const halo = shapeEl(s, { class: 'halo', filter: 'url(#glow)', opacity: 0 });
    const beam = shapeEl(s, { class: 'beam', opacity: 0 });
    const off = shapeEl(s, { class: 'off-shape' });
    g.append(title, halo, beam, off);
    layer.append(g);
    const num = svg('text', { x: s.lx, y: s.ly, class: 'num', 'text-anchor': 'middle', 'dominant-baseline': 'middle' });
    num.textContent = n === 11 ? '11 · BACKDROP' : String(n);
    const ng = svg('g', { class: `light g-${groupOf(n)}` });
    ng.append(num);
    if (APPARATUS[n]) {
      const sub = svg('text', { x: s.lx, y: s.ly + 30, class: 'num sub', 'text-anchor': 'middle', 'dominant-baseline': 'middle' });
      sub.textContent = APPARATUS[n].toUpperCase();
      ng.append(sub);
    }
    labels.append(ng);
    lightEls[n] = { g, halo, beam, off, ng, last: '' };
    g.addEventListener('click', () => onStageLightClick(n));
  }
  layer.append(labels);
}

function renderStage(state, selected) {
  for (const n of ALL_LIGHTS) {
    const el = lightEls[n];
    const { level, color } = state.lights[n];
    const sel = selected?.has(n) || false;
    const key = `${level.toFixed(3)}|${color}|${sel}`;
    if (key === el.last) continue;
    el.last = key;
    const on = level > 0.002;
    el.beam.setAttribute('fill', color);
    el.halo.setAttribute('fill', color);
    el.beam.setAttribute('opacity', on ? (0.2 + 0.65 * level).toFixed(3) : 0);
    el.halo.setAttribute('opacity', on ? (0.85 * level).toFixed(3) : 0);
    el.halo.style.display = on ? '' : 'none';
    el.g.classList.toggle('is-on', on);
    el.ng.classList.toggle('is-on', on);
    el.g.classList.toggle('is-selected', sel);
  }
}

function onStageLightClick(n) {
  if (presenting) return;
  if (editing) {
    const box = document.querySelector(`#lightPicker input[value="${n}"]`);
    if (box) { box.checked = !box.checked; readForm(); }
    return;
  }
  openEditor(null, { lights: [n] });
}

/* ── frame loop ──────────────────────────────────────────────────────── */

function previewTime() {
  // While editing, show the cue's own look: just after its transition lands.
  // While listening inside the editor, play the draft live so a flash run
  // can be watched against the music.
  if (!editing || !audio.paused) return now();
  const d = editing.draft;
  return d.time + (d.transition === 'fade' ? d.fade : 0) + 0.001;
}

// What plays: only the picked version of each option group.
function runningCues() {
  return activeCues(plan.cues, plan.optionPicks);
}

function previewCues() {
  if (!editing) return runningCues();
  const others = runningCues().filter((c) => c.id !== editing.draft.id);
  return [...others, editing.draft];
}

let lastActive = undefined;
function frame() {
  // Schedule the next frame first: one bad frame mustn't freeze the stage.
  requestAnimationFrame(frame);
  try { drawFrame(); } catch (err) { console.error(err); }
}

function drawFrame() {
  if (loop && !audio.paused && audio.currentTime >= loop.end) audio.currentTime = loop.start;
  const t = now();
  const moved = t !== lastFrame.t;
  if (moved || dirtyStage) {
    const pt = previewTime();
    const st = stateAt(previewCues(), pt);
    renderStage(st, editing ? new Set(editing.draft.lights) : null);
    $('timeNow').textContent = formatTime(t);
    const sec = sectionAt(plan.sections, plan.tempo, t);
    const secLabel = sec ? `▸ ${sec.name || 'Untitled section'}` : '';
    if ($('sectionNow').textContent !== secLabel) {
      $('sectionNow').textContent = secLabel;
      document.querySelectorAll('.sec-row').forEach((r) => r.classList.toggle('is-current', r.dataset.id === sec?.id));
    }
    $('addCueTime').textContent = formatTime(t);
    const live = editing ? stateAt(runningCues(), t) : st;
    if (live.activeCue !== lastActive) {
      lastActive = live.activeCue;
      markActive(live.activeCue);
    }
    $('activeCueLabel').textContent = editing
      ? `Previewing cue at ${formatTime(editing.draft.time)}`
      : activeLabel(live.activeCue);
    dirtyStage = false;
  }
  if (moved || dirtyWave) { renderWaves(); dirtyWave = false; }
  lastFrame.t = t;
}

function activeLabel(id) {
  if (!id) return plan.cues.length ? 'Before first cue · all dark' : 'No cues yet · all dark';
  const sorted = sortCues(plan.cues);
  const i = sorted.findIndex((c) => c.id === id);
  return `Cue ${i + 1} of ${sorted.length} · ${formatTime(sorted[i].time)}`;
}

function markActive(id) {
  const sorted = sortCues(plan.cues);
  const idx = sorted.findIndex((c) => c.id === id);
  for (const list of [$('cueList'), $('cueListRO')]) {
    list.querySelectorAll('.cue').forEach((row, i) => {
      row.classList.toggle('is-active', i === idx);
      row.classList.toggle('is-past', idx >= 0 && i < idx);
    });
  }
}

/* ── cue list ────────────────────────────────────────────────────────── */

function describe(c) {
  if (c.repeat) {
    const r = c.repeat;
    const colors = `${colorLabel(c)}${r.altColor ? ` / ${colorLabel({ color: r.altColor, colorName: '' })}` : ''}`;
    const on = r.onFrac >= 1 ? 'held' : `${Math.round(r.onFrac * 100)}% on${r.dimTo ? `, dims to ${r.dimTo}%` : ''}${c.transition === 'fade' ? ', fading' : ''}`;
    return {
      what: `Flash ×${r.count} · ${c.lights.length ? lightsLabel(c.lights) : 'no lights'}`,
      how: `${r.bpm} BPM, ${flashGap(r).toFixed(3)}s apart · ${on} · ${c.level}% · ${colors}`,
    };
  }
  const what = `${transitionLabel(c)} · ${c.lights.length ? lightsLabel(c.lights) : 'no lights'}`;
  const bits = [];
  if (c.action === 'on') bits.push(`${c.level}% · ${colorLabel(c)} ${c.color.toUpperCase()}`);
  if (c.end !== null) bits.push(`out at ${formatTime(c.end)}${c.outFade ? `, fading ${c.outFade}s` : ''}`);
  return { what, how: bits.join(' · ') };
}

// The switch above an option group: which version plays, and goes on the
// cue sheet as the main cues. The rest are listed there as backups.
function optionHeader(g) {
  const picked = g.choices.includes(plan.optionPicks?.[g.group]) ? plan.optionPicks[g.group] : g.primary;
  const h = document.createElement('div');
  h.className = 'option-head';
  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = `Option · ${g.label}`;
  h.append(label);
  const seg = document.createElement('span');
  seg.className = 'option-choices';
  for (const ch of g.choices) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn small';
    b.textContent = ch === g.primary ? ch : `${ch} (backup)`;
    b.setAttribute('aria-pressed', String(ch === picked));
    b.onclick = () => {
      plan.optionPicks = { ...plan.optionPicks, [g.group]: ch };
      // A shared preview never saves; anywhere else the pick is part of the plan.
      if (viewingShared) { renderCueList(); dirtyStage = dirtyWave = true; } else commit();
    };
    seg.append(b);
  }
  h.append(seg);
  return h;
}

function renderCueList() {
  const sorted = sortCues(plan.cues);
  $('cueCount').textContent = sorted.length ? `· ${sorted.length}` : '';
  for (const [list, readOnly] of [[$('cueList'), false], [$('cueListRO'), true]]) {
    list.replaceChildren();
    if (!sorted.length) {
      const e = document.createElement('div');
      e.className = 'cue-empty';
      e.textContent = readOnly
        ? 'No cues in this plan yet.'
        : 'No cues yet. Play the track, and hit “Add cue here” (or press C) at each moment you want the lights to change.';
      list.append(e);
      continue;
    }
    let shownSec = null;
    const groups = optionGroups(plan.cues);
    const running = new Set(runningCues().map((c) => c.id));
    const shownGroups = new Set();
    sorted.forEach((c, i) => {
      const sec = sectionAt(plan.sections, plan.tempo, c.time);
      if (sec && sec !== shownSec) {
        shownSec = sec;
        const h = document.createElement('div');
        h.className = 'cue-section-head';
        const n = document.createElement('span');
        n.textContent = sec.name || 'Untitled section';
        const at = document.createElement('span');
        at.className = 'at';
        at.textContent = `from ${formatTime(sectionStart(sec, plan.tempo))}`;
        h.append(n, at);
        list.append(h);
      }
      if (c.option && !shownGroups.has(c.option.group)) {
        shownGroups.add(c.option.group);
        list.append(optionHeader(groups.find((g) => g.group === c.option.group)));
      }
      const row = document.createElement('div');
      row.className = 'cue';
      if (c.option) row.classList.add('in-option');
      if (c.option && !running.has(c.id)) row.classList.add('is-alt');
      const { what, how } = describe(c);
      row.innerHTML = `
        <span class="cue-n">Q${i + 1}</span>
        <button class="cue-time" type="button" title="Jump here"></button>
        <span class="cue-swatch"></span>
        <div class="cue-desc"><div class="what"></div><div class="how"></div><div class="note"></div></div>
        ${readOnly ? '' : `<div class="cue-actions">
          <button class="btn small" data-act="edit" type="button">Edit</button>
          <button class="btn small" data-act="dup" type="button" title="Copy this cue to the current playback time">Copy to now</button>
          <button class="btn small danger" data-act="del" type="button" aria-label="Delete cue ${i + 1}">✕</button>
        </div>`}`;
      const until = c.repeat ? flashEnd(c) : c.end;
      row.querySelector('.cue-time').textContent = until !== null ? `${formatTime(c.time)}–${formatTime(until)}` : formatTime(c.time);
      row.querySelector('.cue-time').onclick = () => seek(c.time);
      const sw = row.querySelector('.cue-swatch');
      if (c.action === 'off') sw.classList.add('off'); else sw.style.background = c.color;
      row.querySelector('.what').textContent = what;
      const howEl = row.querySelector('.how');
      howEl.textContent = how;
      if (c.othersOff) {
        const p = document.createElement('span');
        p.className = 'pill'; p.textContent = 'all others off';
        howEl.append(p);
      }
      if (c.option) {
        const p = document.createElement('span');
        p.className = 'pill option-pill';
        p.textContent = running.has(c.id) ? c.option.choice : `${c.option.choice} · not in use`;
        howEl.append(p);
      }
      row.querySelector('.note').textContent = c.note;
      if (!readOnly) {
        row.querySelector('[data-act="edit"]').onclick = () => openEditor(c);
        row.querySelector('[data-act="dup"]').onclick = () => {
          const copy = { ...structuredClone(c), id: undefined, option: null };
          const len = c.end !== null ? c.end - c.time : null;
          copy.time = Math.round(now() * 100) / 100;
          copy.end = len !== null ? copy.time + len : null;
          openEditor(null, copy);
        };
        row.querySelector('[data-act="del"]').onclick = () => {
          snapshot('delete');
          plan.cues = plan.cues.filter((x) => x.id !== c.id);
          commit();
          notify(`Deleted cue at ${formatTime(c.time)}.`, { withUndo: true });
        };
      }
      list.append(row);
    });
  }
  lastActive = undefined;
  dirtyStage = true;
}

/* ── editor ──────────────────────────────────────────────────────────── */

const editor = $('editor');
const form = $('cueForm');

function buildEditor() {
  const picker = $('lightPicker');
  for (const g of GROUPS) {
    const row = document.createElement('div');
    row.className = 'pick-group';
    const lab = document.createElement('span');
    lab.className = 'label'; lab.textContent = g.label;
    row.append(lab);
    for (const n of g.lights) {
      const chip = document.createElement('label');
      chip.className = `chip g-${g.id}`;
      chip.innerHTML = `<input type="checkbox" name="light" value="${n}"><span>${n}</span>${APPARATUS[n] ? `<small>${APPARATUS[n]}</small>` : ''}`;
      if (APPARATUS[n]) chip.title = `Light ${n} — ${APPARATUS[n]}`;
      row.append(chip);
    }
    picker.append(row);
  }
  for (const [box, list] of [[$('swatches'), PRESETS], [$('swatchesLogo'), LOGO_COLORS]]) for (const p of list) {
    const sw = box;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'swatch'; b.title = p.name;
    b.style.background = p.hex; b.dataset.hex = p.hex; b.dataset.name = p.name;
    b.setAttribute('aria-label', p.name);
    // Logo colours carry their name onto the cue sheet.
    b.onclick = () => { $('fColor').value = p.hex; $('fColorName').value = LOGO_COLORS.includes(p) ? p.name : ''; readForm(); };
    sw.append(b);
  }
}

function openEditor(cue, preset = {}) {
  if (presenting) return;
  const isNew = !cue;
  const draft = isNew ? { ...blankCue(now()), ...preset } : structuredClone(cue);
  if (isNew && !preset.color) {
    // Start from the previous cue's colour — runs of cues tend to share one.
    const prev = sortCues(plan.cues).filter((c) => c.time <= draft.time && c.action === 'on').pop();
    if (prev) { draft.color = prev.color; draft.colorName = prev.colorName; }
  }
  if (!draft.id) draft.id = blankCue().id;
  editing = { draft, isNew };
  $('editorTitle').textContent = isNew ? 'New cue' : 'Edit cue';
  $('fDelete').hidden = isNew;
  $('fTime').value = formatTime(draft.time);
  $('fEnd').value = draft.end !== null ? formatTime(draft.end) : '';
  $('fOutFade').value = draft.outFade ?? '';
  form.querySelectorAll('input[name="light"]').forEach((b) => { b.checked = draft.lights.includes(Number(b.value)); });
  form.querySelector(`input[name="action"][value="${draft.action}"]`).checked = true;
  form.querySelector(`input[name="transition"][value="${draft.transition}"]`).checked = true;
  $('fFade').value = draft.fade;
  $('fColor').value = draft.color;
  $('fColorName').value = draft.colorName;
  $('fOthersOff').checked = draft.othersOff;
  // A new run starts from the last run's tempo — runs in one song share it.
  const lastRun = sortCues(plan.cues).filter((c) => c.repeat && c.id !== draft.id).pop()?.repeat;
  const r = draft.repeat || { bpm: lastRun?.bpm ?? 120, beats: lastRun?.beats ?? 1, count: 16, onFrac: 0.5, altColor: null };
  $('fFlash').checked = Boolean(draft.repeat);
  $('fBpm').value = r.bpm;
  $('fBeats').value = String(r.beats);
  $('fCount').value = r.count;
  $('fOnFrac').value = String(r.onFrac);
  $('fDimTo').value = String(r.dimTo ?? 0);
  $('fAlt').checked = Boolean(r.altColor);
  if (r.altColor) $('fAltColor').value = r.altColor;
  taps = [];
  $('tapInfo').textContent = 'Listen, then tap on each hit (or press T). Four or more taps set the tempo and the start.';
  $('fLevel').value = draft.level;
  $('fLevelRange').value = draft.level;
  $('fNote').value = draft.note;
  $('formError').hidden = true;
  if (!audio.paused) audio.pause();
  syncFormUi();
  editor.show();
  document.body.classList.add('editor-open');
  $('fTime').focus();
  $('fTime').select();
  dirtyStage = true;
}

function closeEditor() {
  editing = null;
  editor.close();
  document.body.classList.remove('editor-open');
  dirtyStage = true;
  for (const n of ALL_LIGHTS) lightEls[n].last = '';
}

function syncFormUi() {
  const d = editing.draft;
  syncEditorSection();
  $('fadeLenWrap').hidden = d.transition !== 'fade';
  for (const id of ['colorField', 'levelField', 'flashField']) {
    $(id).classList.toggle('is-disabled', d.action === 'off');
    $(id).disabled = d.action === 'off';
  }
  syncFlashUi();
  document.querySelectorAll('#swatches .swatch, #swatchesLogo .swatch').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.hex === d.color)));
}

// Read the form into the draft without validating, so the stage previews
// every change as it's made.
function readForm() {
  if (!editing) return;
  const d = editing.draft;
  const t = parseTime($('fTime').value);
  if (t !== null) d.time = Math.round(t * 100) / 100;
  const e = parseTime($('fEnd').value);
  d.end = e !== null && e > d.time ? Math.round(e * 100) / 100 : null;
  d.lights = [...form.querySelectorAll('input[name="light"]:checked')].map((b) => Number(b.value)).sort((a, b) => a - b);
  d.action = form.querySelector('input[name="action"]:checked').value;
  d.transition = form.querySelector('input[name="transition"]:checked').value;
  const f = Number($('fFade').value);
  d.fade = Number.isFinite(f) && f > 0 ? Math.min(60, Math.round(f * 100) / 100) : DEFAULT_FADE;
  d.color = $('fColor').value.toLowerCase();
  d.colorName = $('fColorName').value.trim();
  const lv = Math.round(Number($('fLevel').value));
  d.level = Number.isFinite(lv) && lv >= 1 ? Math.min(lv, 100) : 100;
  d.othersOff = $('fOthersOff').checked;
  d.note = $('fNote').value.trim();
  d.repeat = $('fFlash').checked && d.action === 'on'
    ? normalizeRepeat({
      bpm: $('fBpm').value, beats: $('fBeats').value, count: $('fCount').value,
      onFrac: $('fOnFrac').value, altColor: $('fAlt').checked ? $('fAltColor').value : null,
      dimTo: $('fDimTo').value,
    })
    : null;
  if (d.repeat) d.end = null;
  const of = $('fOutFade').value.trim();
  d.outFade = (d.end !== null || d.repeat) && of !== '' && Number(of) >= 0 ? Math.min(30, Math.round(Number(of) * 100) / 100) : null;
  syncFormUi();
  dirtyStage = true;
}

let taps = [];

function syncFlashUi() {
  const d = editing.draft;
  const on = $('fFlash').checked && d.action === 'on';
  $('flashBody').hidden = !on;
  $('fEnd').disabled = on;
  $('fEndNow').disabled = on;
  // Fade-out only means something once there's an End to fade out at.
  $('outFadeWrap').hidden = !on && d.end === null;
  $('fAltColor').disabled = !$('fAlt').checked;
  if (!on || !d.repeat) { $('flashWarn').hidden = true; $('flashSummary').textContent = ''; return; }
  const r = d.repeat;
  const fadeFor = d.transition === 'fade' ? Math.min(d.fade, flashGap(r) * r.onFrac * 0.9) : 0;
  $('flashSummary').textContent = `${r.count} flashes, ${flashGap(r).toFixed(3)}s apart: ${formatTime(d.time)} to ${formatTime(flashTimes(d).at(-1))}`
    + (r.onFrac < 1 ? `, each bright ${(flashGap(r) * r.onFrac).toFixed(2)}s` : ', each held until the next')
    + (r.onFrac < 1 && r.dimTo ? `, ${r.dimTo}% between` : '')
    + (fadeFor ? `, ${fadeFor.toFixed(2)}s fades.` : '.');
  const fps = flashesPerSecond(r);
  // A dim-to-half pulse is a much gentler change than full on/off.
  const strobing = (r.onFrac < 1 && r.dimTo < 50) || r.altColor;
  $('flashWarn').hidden = !(strobing && fps > 3);
  $('flashWarn').textContent = `That's ${fps.toFixed(1)} flashes a second — above the usual 3-per-second photosensitivity guideline. Consider flashing every 2 beats, and check the venue's strobe-warning rules.`;
}

// Tap along while it plays: each tap is one flash. A pause of over 2.5s
// starts a fresh set of taps.
function tap() {
  if (!editing) return;
  if (audio.paused) { $('tapInfo').textContent = 'Press Listen first, then tap along on each hit.'; return; }
  const t = now();
  if (taps.length && t - taps[taps.length - 1] > 2.5) taps = [];
  if (taps.length && t <= taps[taps.length - 1]) taps = [];
  taps.push(t);
  const fit = fitTaps(taps);
  if (!fit) { $('tapInfo').textContent = `${taps.length} tap${taps.length === 1 ? '' : 's'} — keep going…`; return; }
  // Taps mark flashes; the song's tempo is flashes per minute × beats per flash.
  const beats = Number($('fBeats').value);
  $('fBpm').value = Math.round(fit.bpm * beats * 10) / 10;
  $('fTime').value = formatTime(fit.first);
  $('tapInfo').textContent = `${fit.taps} taps → ${$('fBpm').value} BPM, first flash at ${formatTime(fit.first)}. Keep tapping to refine.`;
  readForm();
}

$('fTap').onclick = tap;
// A gentle beat: fade up, ease down to 35%, never fully dark.
$('fSoftPulse').onclick = () => {
  form.querySelector('input[name="transition"][value="fade"]').checked = true;
  $('fFade').value = 2; // capped to fit inside each flash
  $('fOnFrac').value = '0.5';
  $('fDimTo').value = '35';
  readForm();
};
$('fListen').onclick = () => {
  if (!audio.src) return;
  if (!audio.paused) { audio.pause(); $('fListen').textContent = '▶ Listen from start'; return; }
  taps = [];
  audio.currentTime = Math.max(0, editing.draft.time - 2);
  audio.play().catch(() => {});
};
audio.addEventListener('play', () => { $('fListen').textContent = '❚❚ Stop'; });
audio.addEventListener('pause', () => { $('fListen').textContent = '▶ Listen from start'; dirtyStage = true; });
$('fFlash').addEventListener('change', () => {
  // Flashing needs something to flash.
  if ($('fFlash').checked && form.querySelector('input[name="action"][value="off"]').checked) {
    form.querySelector('input[name="action"][value="on"]').checked = true;
  }
});

function syncEditorSection() {
  const sec = editing && sectionAt(plan.sections, plan.tempo, editing.draft.time);
  $('fSection').textContent = sec ? `In ${sec.name || 'untitled section'}.` : '';
}

function validate() {
  const errs = [];
  const t = parseTime($('fTime').value);
  if (t === null) errs.push('Start time should look like 1:23.45 or 83.45.');
  else if (duration() && t > duration()) errs.push(`Start is past the end of the track (${formatTime(duration())}).`);
  // A flash run times itself, so End is switched off and not checked.
  const endRaw = $('fFlash').checked ? '' : $('fEnd').value.trim();
  if (endRaw) {
    const e = parseTime(endRaw);
    if (e === null) errs.push('End time should look like 1:23.45, or be left blank.');
    else if (t !== null && e <= t) errs.push('End has to be after the start.');
  }
  const d = editing.draft;
  if (!d.lights.length && !d.othersOff) errs.push('Pick at least one light — or tick “All others off” for a blackout.');
  if (d.action === 'off' && endRaw) errs.push('An “Off” cue can’t have an end time — leave End blank.');
  if ($('fFlash').checked && d.action === 'on' && !d.repeat) errs.push('For a flash run, set a tempo between 20 and 400 BPM and at least 2 flashes.');
  return errs;
}

// The slider and the number box mirror each other; whichever moved wins.
$('fLevelRange').addEventListener('input', () => { $('fLevel').value = $('fLevelRange').value; });
$('fLevel').addEventListener('input', () => { $('fLevelRange').value = $('fLevel').value; });
document.querySelectorAll('[data-level]').forEach((b) => {
  b.onclick = () => { $('fLevel').value = $('fLevelRange').value = b.dataset.level; readForm(); };
});
form.addEventListener('input', readForm);
form.addEventListener('change', readForm);
form.addEventListener('submit', (e) => {
  e.preventDefault();
  readForm();
  const errs = validate();
  if (errs.length) {
    $('formError').textContent = errs.join(' ');
    $('formError').hidden = false;
    return;
  }
  const d = editing.draft;
  snapshot('edit');
  d.updatedAt = Date.now();
  plan.cues = [...plan.cues.filter((c) => c.id !== d.id), structuredClone(d)];
  const wasNew = editing.isNew;
  closeEditor();
  commit();
  notify(wasNew ? `Cue added at ${formatTime(d.time)}.` : `Cue at ${formatTime(d.time)} updated.`, { withUndo: true });
});

$('fCancel').onclick = closeEditor;
$('fDelete').onclick = () => {
  const d = editing.draft;
  snapshot('delete');
  plan.cues = plan.cues.filter((c) => c.id !== d.id);
  closeEditor();
  commit();
  notify(`Deleted cue at ${formatTime(d.time)}.`, { withUndo: true });
};
$('fTimeNow').onclick = () => { $('fTime').value = formatTime(now()); readForm(); };
$('fEndNow').onclick = () => { $('fEnd').value = formatTime(now()); readForm(); };
$('fClose').onclick = closeEditor;
// Listen on the document, not the editor: the editor isn't modal, so focus
// is often on the stage or the page when someone reaches for Esc.
document.addEventListener('keydown', (e) => {
  if (!editing || e.metaKey || e.ctrlKey || e.altKey) return;
  const typing = ['TEXTAREA', 'SELECT'].includes(e.target.tagName) || (e.target.tagName === 'INPUT' && !['checkbox', 'radio', 'range', 'color'].includes(e.target.type));
  if ((e.key === 't' || e.key === 'T') && !typing && $('fFlash').checked) { e.preventDefault(); tap(); }
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !editing) return;
  if ($('sheetDialog').open || $('pasteDialog').open || $('mergeDialog').open) return;
  e.preventDefault();
  closeEditor();
});
document.querySelectorAll('[data-pick]').forEach((b) => {
  b.onclick = () => {
    const which = b.dataset.pick;
    const g = GROUPS.find((x) => x.id === which);
    // Decide once, before changing anything: a whole group already on turns
    // off, otherwise the group turns on.
    const groupOn = g ? !g.lights.every((l) => form.querySelector(`input[name="light"][value="${l}"]`).checked) : null;
    form.querySelectorAll('input[name="light"]').forEach((box) => {
      const n = Number(box.value);
      if (which === 'all') box.checked = true;
      else if (which === 'none') box.checked = false;
      else if (g.lights.includes(n)) box.checked = groupOn;
    });
    readForm();
  };
});

/* ── transport wiring ────────────────────────────────────────────────── */

$('playBtn').onclick = togglePlay;
document.querySelectorAll('[data-nudge]').forEach((b) => { b.onclick = () => seek(now() + Number(b.dataset.nudge)); });
$('loopBtn').onclick = () => setLoop(!loop);
$('loopLen').onchange = () => { if (loop) setLoop(true); };
$('rate').onchange = () => { audio.playbackRate = Number($('rate').value); };
$('addCue').onclick = () => openEditor(null);

function jumpCue(dir) {
  const t = now();
  const times = sortCues(plan.cues).map((c) => c.time);
  const target = dir > 0 ? times.find((x) => x > t + 0.02) : [...times].reverse().find((x) => x < t - 0.02);
  if (target !== undefined) seek(target);
}

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = e.target.tagName;
  if (editing || ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.target.isContentEditable) return;
  if (document.querySelector('dialog[open]')) return;
  if (!audio.src) return;
  const k = e.key;
  // A focused button would also take the Space as a click — drop focus first.
  if (k === ' ') { e.preventDefault(); if (tag === 'BUTTON') e.target.blur(); togglePlay(); }
  else if (k === 'ArrowLeft') { e.preventDefault(); seek(now() - (e.shiftKey ? 1 : 0.1)); }
  else if (k === 'ArrowRight') { e.preventDefault(); seek(now() + (e.shiftKey ? 1 : 0.1)); }
  else if (k === 'l' || k === 'L') setLoop(!loop);
  else if ((k === 'c' || k === 'C') && !presenting) { e.preventDefault(); openEditor(null); }
  else if (k === '[') jumpCue(-1);
  else if (k === ']') jumpCue(1);
});

/* ── sections ────────────────────────────────────────────────────────── */

const SECTION_COLORS = ['#d4a96a', '#7dbfa0', '#8fb4d4', '#c2747a', '#b79cff', '#e8b4b6'];
function sectionColor(i) { return SECTION_COLORS[i % SECTION_COLORS.length]; }

function syncTempoInputs() {
  $('tempoBpm').value = plan.tempo.bpm;
  $('tempoBpb').value = plan.tempo.beatsPerBar;
}

function onTempoChange() {
  if (viewingShared) return;
  plan.tempo = normalizeTempo({ bpm: $('tempoBpm').value, beatsPerBar: $('tempoBpb').value });
  syncTempoInputs(); // show what's actually in use if the entry was out of range
  commit();
}
$('tempoBpm').addEventListener('change', onTempoChange);
$('tempoBpb').addEventListener('change', onTempoChange);

function renderSections() {
  const list = $('sectionList');
  list.replaceChildren();
  const secs = sortSections(plan.sections, plan.tempo);
  if (!secs.length) {
    const e = document.createElement('div');
    e.className = 'section-empty';
    e.textContent = 'No sections yet. Add one at the playhead, or paste a list.';
    list.append(e);
  }
  secs.forEach((sec, i) => {
    const row = document.createElement('div');
    row.className = 'sec-row';
    row.dataset.id = sec.id;
    row.innerHTML = `
      <span class="sec-dot"></span>
      <input class="sec-name" type="text" maxlength="60" placeholder="Song name" aria-label="Section name">
      <input class="sec-start" type="text" aria-label="Section start (time or bar)" title="A time like 1:23.4, or a bar like b15">
      <button class="sec-at" type="button" title="Jump here"></button>
      <button class="btn small sec-now" type="button" title="Move this section to the playhead">⌖</button>
      <button class="btn small danger sec-del" type="button" aria-label="Delete section">✕</button>`;
    row.querySelector('.sec-dot').style.background = sectionColor(i);
    const name = row.querySelector('.sec-name');
    name.value = sec.name;
    // Typing a name only saves — re-rendering would steal focus mid-word.
    name.addEventListener('input', () => { sec.name = name.value.trim(); sec.updatedAt = Date.now(); savePlan(); dirtyWave = true; });
    name.addEventListener('change', () => commit());
    const start = row.querySelector('.sec-start');
    start.value = formatStart(sec);
    start.addEventListener('change', () => {
      const parsed = parseStart(start.value);
      if (!parsed) { start.classList.add('is-bad'); return; }
      Object.assign(sec, normalizeSection({ ...sec, ...parsed }), { updatedAt: Date.now() });
      commit();
    });
    const at = row.querySelector('.sec-at');
    at.textContent = formatTime(sectionStart(sec, plan.tempo), 1);
    at.onclick = () => seek(sectionStart(sec, plan.tempo));
    row.querySelector('.sec-now').onclick = () => {
      // Keep the section in bars if it was in bars, so tempo edits still move it.
      const t = now();
      Object.assign(sec, sec.bar !== null
        ? { bar: Math.round(timeToBar(t, plan.tempo) * 100) / 100, time: null }
        : { time: Math.round(t * 100) / 100 }, { updatedAt: Date.now() });
      commit();
    };
    row.querySelector('.sec-del').onclick = () => {
      snapshot('delete section');
      plan.sections = plan.sections.filter((x) => x.id !== sec.id);
      commit();
      notify(`Deleted section “${sec.name || 'untitled'}”.`, { withUndo: true });
    };
    list.append(row);
  });
  dirtyWave = true;
}

$('addSection').onclick = () => {
  plan.sections.push(normalizeSection({ name: '', time: Math.round(now() * 100) / 100, updatedAt: Date.now() }));
  commit();
  const rows = [...document.querySelectorAll('.sec-row')];
  const fresh = rows.find((r) => r.querySelector('.sec-name').value === '');
  fresh?.querySelector('.sec-name').focus();
};

$('pasteSections').onclick = () => {
  $('pasteError').hidden = true;
  $('pasteDialog').showModal();
};
$('pasteCancel').onclick = () => $('pasteDialog').close();
function pasteApply(replace) {
  const { sections, bad } = parseSectionLines($('pasteText').value);
  if (bad.length) {
    $('pasteError').textContent = `Couldn't read line${bad.length === 1 ? '' : 's'} ${bad.join(', ')}. Each line needs a start (1:23.4 or b15), then a name.`;
    $('pasteError').hidden = false;
    return;
  }
  if (!sections.length) { $('pasteDialog').close(); return; }
  snapshot('sections');
  const stamp = Date.now();
  sections.forEach((x) => { x.updatedAt = stamp; });
  plan.sections = replace ? sections : [...plan.sections, ...sections];
  $('pasteDialog').close();
  $('pasteText').value = '';
  commit();
  notify(`${replace ? 'Set' : 'Added'} ${sections.length} section${sections.length === 1 ? '' : 's'}.`, { withUndo: true });
}
$('pasteAdd').onclick = () => pasteApply(false);
$('pasteReplace').onclick = () => pasteApply(true);

/* ── title ───────────────────────────────────────────────────────────── */

$('title').addEventListener('input', () => {
  if (viewingShared) return;
  plan.title = $('title').value;
  savePlan();
});

/* ── import / export ─────────────────────────────────────────────────── */

function slug(s) {
  return (s || 'lighting-cues').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'lighting-cues';
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

$('exportJson').onclick = () => {
  download(`${slug(plan.title)}-cues-${stamp()}.json`, JSON.stringify(serializePlan(plan), null, 2), 'application/json');
};

$('importJson').addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (!f) return;
  let incoming;
  try {
    incoming = normalizePlan(JSON.parse(await f.text()));
  } catch (err) {
    notify(`Couldn't read that file: ${err.message}`, { error: true });
    return;
  }
  bringIn(incoming, `“${f.name}”`);
});

// Nothing of mine to lose → just take theirs. Otherwise review a merge.
function bringIn(incoming, source) {
  if (!plan.cues.length && !plan.sections.length) {
    adopt(incoming, `Imported ${incoming.cues.length} cue${incoming.cues.length === 1 ? '' : 's'} from ${source}.`);
    return;
  }
  openMerge(incoming, source);
}

function adopt(incoming, msg) {
  snapshot('import');
  plan = planFrom(incoming);
  if (pendingShowSig) { rememberShowPlan(pendingShowSig); pendingShowSig = null; }
  syncTempoInputs();
  if (audioName) plan.audio = { name: audioName, duration: Math.round(duration() * 100) / 100 };
  $('title').value = plan.title;
  commit();
  let extra = '';
  if (incoming.skipped) extra += ` ${incoming.skipped} unreadable cue${incoming.skipped === 1 ? ' was' : 's were'} skipped.`;
  if (incoming.audio.name && audioName && incoming.audio.name !== audioName) extra += ` It was made with “${incoming.audio.name}”, not the track you have loaded.`;
  notify(msg + extra, { withUndo: true });
}

/* ── merge review ────────────────────────────────────────────────────── */

let merging = null; // { incoming, diff, source }

function itemSummary(kind, x) {
  if (kind === 'section') {
    return `${x.name || 'Untitled section'} — starts ${formatStart(x)}${x.bar !== null ? ` (${formatTime(sectionStart(x, plan.tempo), 1)})` : ''}`;
  }
  const { what, how } = describe(x);
  const extra = [how, x.othersOff ? 'all others off' : '', x.note ? `“${x.note}”` : ''].filter(Boolean).join(' · ');
  return `${x.end !== null ? `${formatTime(x.time)}–${formatTime(x.end)}` : formatTime(x.time)} · ${what}${extra ? ' · ' + extra : ''}`;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function choiceRow(name, value, label, checked, type = 'radio') {
  const l = el('label', 'merge-choice');
  const i = document.createElement('input');
  i.type = type; i.name = name; i.value = value; i.checked = checked;
  l.append(i, el('span', '', label));
  return l;
}

function openMerge(incoming, source) {
  const diff = diffPlans(plan, incoming);
  merging = { incoming, diff, source };
  const { counts } = diff;
  const body = $('mergeBody');
  body.replaceChildren();
  $('mergeTitle').textContent = `Bring in ${source}`;
  const what = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  $('mergeSummary').textContent = counts.differ + counts['mine-only'] + counts['theirs-only'] + diff.settings.length === 0
    ? 'Both copies are identical — nothing to merge.'
    : `${what(counts.same, 'item')} ${counts.same === 1 ? 'matches' : 'match'}. Review the rest below — the defaults keep everything and prefer the more recent edit.`;

  const group = (title, hint, items, build) => {
    if (!items.length) return;
    const g = el('div', 'merge-group');
    g.append(el('h4', '', `${title} · ${items.length}`));
    if (hint) g.append(el('p', 'muted tiny', hint));
    items.forEach((it) => g.append(build(it)));
    body.append(g);
  };
  const label = (it) => (it.kind === 'section' ? 'Section' : 'Cue');

  group('Different in the two copies', 'Pick which version to keep. The newer edit is pre-selected.',
    diff.items.filter((i) => i.status === 'differ'), (it) => {
      const row = el('div', 'merge-item');
      row.append(el('div', 'merge-kind', label(it)));
      const newer = (it.theirs.updatedAt || 0) > (it.mine.updatedAt || 0) ? 'theirs' : (it.mine.updatedAt || 0) > (it.theirs.updatedAt || 0) ? 'mine' : null;
      row.append(choiceRow(`pick-${it.id}`, 'mine', `Yours${newer === 'mine' ? ' (newer)' : ''}: ${itemSummary(it.kind, it.mine)}`, it.pick === 'mine'));
      row.append(choiceRow(`pick-${it.id}`, 'theirs', `Theirs${newer === 'theirs' ? ' (newer)' : ''}: ${itemSummary(it.kind, it.theirs)}`, it.pick === 'theirs'));
      return row;
    });
  group('Only in their copy', 'New from them, most likely. Untick any you don’t want.',
    diff.items.filter((i) => i.status === 'theirs-only'), (it) => {
      const row = el('div', 'merge-item');
      row.append(choiceRow(`pick-${it.id}`, 'theirs', `${label(it)}: ${itemSummary(it.kind, it.theirs)}`, true, 'checkbox'));
      return row;
    });
  group('Only in your copy', 'Either you added these, or they deleted them. Untick any they removed on purpose.',
    diff.items.filter((i) => i.status === 'mine-only'), (it) => {
      const row = el('div', 'merge-item');
      row.append(choiceRow(`pick-${it.id}`, 'mine', `${label(it)}: ${itemSummary(it.kind, it.mine)}`, true, 'checkbox'));
      return row;
    });
  group('Settings', 'Bar-based sections move with the tempo.', diff.settings, (st) => {
    const row = el('div', 'merge-item');
    const show = (v) => (st.key === 'tempo' ? `${v.bpm} BPM, ${v.beatsPerBar}/bar` : `“${v}”`);
    row.append(el('div', 'merge-kind', st.key === 'tempo' ? 'Tempo' : 'Title'));
    row.append(choiceRow(`pick-${st.key}`, 'mine', `Yours: ${show(st.mine)}`, st.pick === 'mine'));
    row.append(choiceRow(`pick-${st.key}`, 'theirs', `Theirs: ${show(st.theirs)}`, st.pick === 'theirs'));
    return row;
  });

  $('mergeApply').textContent = 'Merge';
  $('mergeDialog').showModal();
}

function readPicks() {
  const picks = {};
  for (const it of merging.diff.items) {
    if (it.status === 'same') continue;
    const inputs = [...$('mergeBody').querySelectorAll(`input[name="pick-${CSS.escape(it.id)}"]`)];
    if (it.status === 'differ') picks[it.id] = inputs.find((i) => i.checked)?.value ?? it.pick;
    else picks[it.id] = inputs[0]?.checked ? it.pick : 'drop';
  }
  for (const st of merging.diff.settings) {
    const sel = $('mergeBody').querySelector(`input[name="pick-${st.key}"]:checked`);
    if (sel) picks[st.key] = sel.value;
  }
  return picks;
}

$('mergeCancel').onclick = () => { merging = null; pendingShowSig = null; $('mergeDialog').close(); };
$('mergeReplace').onclick = () => {
  const { incoming, source } = merging;
  merging = null;
  $('mergeDialog').close();
  adopt(incoming, `Replaced your plan with ${source}.`);
};
$('mergeApply').onclick = () => {
  const { incoming, diff, source } = merging;
  const merged = applyMerge(plan, incoming, diff, readPicks());
  merging = null;
  $('mergeDialog').close();
  const before = plan.cues.length;
  adopt({ ...merged, audio: plan.audio, skipped: incoming.skipped || 0 },
    `Merged ${source}: ${merged.cues.length} cue${merged.cues.length === 1 ? '' : 's'} now (was ${before}).`);
};

$('exportSheet').onclick = () => {
  if (!plan.cues.length) { notify('Add some cues first — the sheet would be empty.'); return; }
  $('sheetText').value = cueSheet(plan);
  $('sheetDialog').showModal();
};
$('sheetClose').onclick = () => $('sheetDialog').close();
$('sheetDownload').onclick = () => download(`${slug(plan.title)}-cue-sheet.txt`, $('sheetText').value, 'text/plain');
$('sheetCopy').onclick = async () => {
  try {
    await navigator.clipboard.writeText($('sheetText').value);
    $('sheetCopy').textContent = 'Copied ✓';
  } catch {
    $('sheetText').select();
    document.execCommand('copy');
    $('sheetCopy').textContent = 'Copied ✓';
  }
  setTimeout(() => { $('sheetCopy').textContent = 'Copy to clipboard'; }, 2000);
};

/* ── share link + presentation mode ──────────────────────────────────── */

$('shareLink').onclick = async () => {
  if (!plan.cues.length) { notify('Add some cues first.'); return; }
  try {
    const token = await encodeShare(plan);
    const url = `${location.origin}${location.pathname}#present&plan=${token}`;
    await navigator.clipboard.writeText(url);
    notify(`Preview link copied. It opens in presentation mode with these ${plan.cues.length} cues baked in — the viewer loads their own copy of “${plan.audio.name || 'the track'}”. Links are a snapshot: re-copy after changes.`);
  } catch {
    notify('Couldn\'t build or copy the link in this browser. Export JSON instead.', { error: true });
  }
};

function setPresenting(on) {
  presenting = on;
  if (on && editing) closeEditor();
  document.body.classList.toggle('presenting', on);
  document.body.classList.toggle('edit-mode', !on);
  $('title').readOnly = on || viewingShared;
  $('presentToggle').setAttribute('aria-pressed', String(on));
  $('presentToggle').textContent = on ? 'Exit presentation' : 'Presentation mode';
  dirtyStage = dirtyWave = true;
}
$('presentToggle').onclick = () => setPresenting(!presenting);

async function openSharedFromHash() {
  const h = location.hash.slice(1);
  if (!h) return false;
  const params = new URLSearchParams(h);
  const token = params.get('plan');
  if (!token) {
    if (params.has('present')) setPresenting(true);
    return false;
  }
  try {
    const shared = await decodeShare(token);
    ownPlan = plan;
    plan = planFrom(shared);
    viewingShared = true;
    $('sharedBanner').hidden = false;
    $('title').value = plan.title;
    $('title').readOnly = true;
    if (params.has('present')) setPresenting(true);
    renderCueList();
    return true;
  } catch {
    notify('That preview link looks damaged — showing your own cue list instead.', { error: true });
    return false;
  }
}

function leaveShared() {
  viewingShared = false;
  plan = ownPlan || loadPlan();
  ownPlan = null;
  history.replaceState(null, '', location.pathname + location.search);
  $('sharedBanner').hidden = true;
  $('title').readOnly = false;
  $('title').value = plan.title;
  syncTempoInputs();
  setPresenting(false);
  showExpectedAudio();
  renderSections();
  renderCueList();
  dirtyStage = dirtyWave = true;
}

$('leaveShared').onclick = leaveShared;
$('adoptShared').onclick = () => {
  const shared = plan;
  leaveShared();
  bringIn({ ...structuredClone(shared), skipped: 0 }, 'the shared link');
};
window.addEventListener('hashchange', () => { if (location.hash.includes('plan=')) location.reload(); });

/* ── boot ────────────────────────────────────────────────────────────── */

function showExpectedAudio() {
  const name = plan.audio.name;
  $('expectedAudio').textContent = name
    ? `This cue list was made with “${name}”${plan.audio.duration ? ` (${formatTime(plan.audio.duration, 1)})` : ''}. Drop that file here, or`
    : 'Drop an audio file here, or';
}

// The plan worked out so far for this show, shipped with the app so a
// partner opening the link starts from it instead of importing files.
async function fetchShowPlan() {
  const res = await fetch('starter-plan.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return normalizePlan(await res.json());
}

// Which show plan this browser last took on, and what its own plan looked
// like right after. If the plan is still untouched when a newer show plan
// ships, it updates on its own; once edited, it offers a merge instead.
const SHOW_KEY = 'lighting-cue-builder:show-plan';
let pendingShowSig = null;

function rememberShowPlan(showSig) {
  try { localStorage.setItem(SHOW_KEY, JSON.stringify({ show: showSig, plan: planSignature(plan) })); } catch { /* best effort */ }
}

function lastShowPlan() {
  try { return JSON.parse(localStorage.getItem(SHOW_KEY)) || null; } catch { return null; }
}

function checkShowUpdate(show) {
  const sig = planSignature(show);
  const last = lastShowPlan();
  if (last?.show === sig) return;
  if (last && planSignature(plan) === last.plan) {
    pendingShowSig = sig;
    adopt(show, 'Updated to the latest show plan.');
    return;
  }
  notify('The show plan has been updated since this browser last loaded it.', {
    sticky: true,
    action: { label: 'Review & merge', run: () => { pendingShowSig = sig; bringIn(show, 'the latest show plan'); } },
  });
}

$('loadShowPlan').onclick = async () => {
  try {
    const show = await fetchShowPlan();
    pendingShowSig = planSignature(show);
    bringIn(show, 'the show plan');
  } catch {
    notify('Couldn’t load the show plan right now — check your connection and try again.', { error: true });
  }
};

// The show's track ships next to the app, so nobody has to find the file.
// A file someone picked themselves (kept in IndexedDB) still wins.
const SHOW_AUDIO = { url: 'show-audio.mp3', name: 'showcase deleted empty ending.mp3' };
async function loadShowAudio() {
  $('expectedAudio').textContent = 'Loading the show audio…';
  try {
    const res = await fetch(SHOW_AUDIO.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await loadAudio(await res.blob(), SHOW_AUDIO.name, { persist: false });
  } catch {
    showExpectedAudio(); // offline or missing: fall back to picking the file
  }
}

async function boot() {
  buildStage();
  buildEditor();
  document.body.classList.add('edit-mode');
  let show = null;
  if (!location.hash.includes('plan=')) {
    try { show = await fetchShowPlan(); } catch { /* offline or missing: carry on without it */ }
  }
  if (firstVisit && show) {
    plan = planFrom(show);
    rememberShowPlan(planSignature(show));
    notify('Loaded the show plan to start from. Your edits save in this browser; use Export JSON to send them back.');
  }
  $('title').value = plan.title;
  const shared = await openSharedFromHash();
  syncTempoInputs();
  renderSections();
  renderCueList();
  showExpectedAudio();
  if (!shared) savePlan();
  else $('saveState').textContent = '';
  if (!shared && !firstVisit && show) checkShowUpdate(show);
  new ResizeObserver(() => { dirtyWave = true; }).observe($('waveWrap'));
  requestAnimationFrame(frame);
  const stored = await idbGet();
  if (stored?.blob) await loadAudio(stored.blob, stored.name, { persist: false });
  else await loadShowAudio();
}

boot();
