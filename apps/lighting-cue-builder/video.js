// Video export: draw the stage onto a canvas every frame and record it,
// with the song, through the browser's own MediaRecorder. Nothing to
// install, but it records in real time, so a full show takes as long as
// the song.

const NS = 'http://www.w3.org/2000/svg';
export const VIDEO_W = 1600;
export const VIDEO_H = 900;
const PANEL = 300; // info column on the right
const VIEW = { x: 30, y: 70, w: 1560, h: 1030 }; // the stage SVG's viewBox

// H.264 mp4 first: QuickTime and phones play it. Chrome and Safari record
// it. Plain "video/mp4" goes last, because Chromium builds without H.264
// accept it but fill it with VP9, which QuickTime can't open; webm is the
// honest fallback there and in Firefox.
const TYPES = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];

export function videoSupported() {
  return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function'
    && typeof (window.AudioContext || window.webkitAudioContext) === 'function';
}

export function recorderType() {
  return TYPES.find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
}

export const videoExtension = (type) => (type.includes('mp4') ? 'mp4' : 'webm');

const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// The stage without its lights, as an image. An SVG drawn into a canvas
// can't see the page's stylesheet, so the .stage rules go inside it.
export async function stageBackground(svgEl) {
  const clone = svgEl.cloneNode(true);
  clone.querySelector('#lightsLayer')?.replaceChildren();
  const rules = [];
  for (const sheet of document.styleSheets) {
    let list;
    try { list = sheet.cssRules; } catch { continue; } // cross-origin font sheets
    for (const r of list) if (r.selectorText?.includes('.stage')) rules.push(r.cssText);
  }
  const style = document.createElementNS(NS, 'style');
  style.textContent = rules.join('\n').replace(/var\((--[\w-]+)\)/g, (_, v) => cssVar(v) || 'inherit');
  clone.prepend(style);
  clone.setAttribute('xmlns', NS);
  clone.setAttribute('width', VIEW.w);
  clone.setAttribute('height', VIEW.h);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
  await img.decode();
  return img;
}

function shapePath(ctx, s) {
  ctx.beginPath();
  if (s.rect) ctx.roundRect(s.x, s.y, s.w, s.h, 18);
  else ctx.ellipse(s.cx, s.cy, s.rx, s.ry, ((s.rot || 0) * Math.PI) / 180, 0, Math.PI * 2);
}

// One frame, matching renderStage: a dashed outline per light, then a
// blurred halo and a beam in the light's colour, then the numbers on top.
export function drawFrame(ctx, bg, state, { shapes, order, groupOf, apparatus, title, time, section }) {
  const k = Math.min((VIDEO_W - PANEL - 40) / VIEW.w, (VIDEO_H - 40) / VIEW.h);
  const ox = 20, oy = (VIDEO_H - VIEW.h * k) / 2;
  ctx.save();
  ctx.fillStyle = '#0a0607';
  ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);
  ctx.translate(ox, oy);
  ctx.scale(k, k);
  ctx.translate(-VIEW.x, -VIEW.y);
  ctx.drawImage(bg, VIEW.x, VIEW.y, VIEW.w, VIEW.h);
  const stroke = { apparatus: cssVar('--apparatus'), floor: cssVar('--floor'), backdrop: cssVar('--backdrop') };
  for (const n of order) {
    const s = shapes[n];
    shapePath(ctx, s);
    ctx.fillStyle = 'rgba(255,255,255,0.015)';
    ctx.fill();
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = stroke[groupOf(n)] || '#888';
    ctx.stroke();
    ctx.setLineDash([]);
    const { level, color } = state.lights[n];
    if (level <= 0.002) continue;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85 * level;
    if ('filter' in ctx) ctx.filter = `blur(${22 * k}px)`; // the SVG's #glow
    else { ctx.shadowColor = color; ctx.shadowBlur = 44 * k; }
    shapePath(ctx, s);
    ctx.fill();
    ctx.filter = 'none';
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.2 + 0.65 * level;
    shapePath(ctx, s);
    ctx.fill();
    ctx.restore();
  }
  const mono = cssVar('--font-mono') || 'monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.65)';
  ctx.lineWidth = 5;
  for (const n of order) {
    const s = shapes[n];
    const on = state.lights[n].level > 0.002;
    ctx.fillStyle = on ? '#fff' : '#cbbfc0';
    ctx.font = `600 36px ${mono}`;
    const label = n === 11 ? '11 · BACKDROP' : String(n);
    ctx.strokeText(label, s.lx, s.ly);
    ctx.fillText(label, s.lx, s.ly);
    if (apparatus[n]) {
      ctx.font = `500 20px ${mono}`;
      ctx.strokeText(apparatus[n].toUpperCase(), s.lx, s.ly + 30);
      ctx.fillText(apparatus[n].toUpperCase(), s.lx, s.ly + 30);
    }
  }
  ctx.restore();
  // info column
  const x = VIDEO_W - PANEL + 10;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = cssVar('--text-bright') || '#f3e6e2';
  ctx.font = `600 34px ${cssVar('--font-display') || 'serif'}`;
  wrapText(ctx, title || 'Lighting cues', x, 90, PANEL - 30, 40);
  ctx.font = `600 54px ${mono}`;
  ctx.fillText(time, x, VIDEO_H / 2);
  ctx.fillStyle = cssVar('--accent') || '#e7a08a';
  ctx.font = `500 24px ${cssVar('--font-body') || 'sans-serif'}`;
  if (section) wrapText(ctx, `▸ ${section}`, x, VIDEO_H / 2 + 50, PANEL - 30, 30);
}

function wrapText(ctx, text, x, y, width, lineHeight) {
  let line = '';
  for (const word of String(text).split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > width && line) { ctx.fillText(line, x, y); line = word; y += lineHeight; }
    else line = test;
  }
  if (line) ctx.fillText(line, x, y);
}

// The song has to reach the recorder as a stream. Once an element feeds
// WebAudio it can't be unhooked, so this happens once and the speakers stay
// connected too.
let route = null;
function audioRoute(audio) {
  if (!route) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const src = ctx.createMediaElementSource(audio);
    const dest = ctx.createMediaStreamDestination();
    src.connect(ctx.destination);
    src.connect(dest);
    route = { ctx, dest };
  }
  return route;
}

// → { start(), stop(), done: Promise<Blob>, type }
// draw() paints the current moment onto canvas; called every animation frame.
export function recorder({ audio, canvas, draw, fps = 30 }) {
  const { ctx, dest } = audioRoute(audio);
  const type = recorderType();
  const stream = new MediaStream([...canvas.captureStream(fps).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const rec = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: 8_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise((resolve) => { rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || type || 'video/webm' })); });
  let raf = 0;
  let stopped = false;
  const loop = () => { draw(); if (!stopped) raf = requestAnimationFrame(loop); };
  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    audio.pause();
    if (rec.state !== 'inactive') rec.stop();
  };
  return {
    type: rec.mimeType || type,
    done,
    stop,
    async start() {
      await ctx.resume();
      audio.addEventListener('ended', stop, { once: true });
      draw();
      rec.start(1000);
      loop();
      await audio.play();
    },
  };
}
