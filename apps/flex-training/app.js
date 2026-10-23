import {
  occurrences, checklist, timerOptions, movementIndex, moveKey, cueText, cueSub,
  normalizeLog, isEmptyEntry, toIcs, ymd, fromYmd, addDays, weekStart,
} from './plan.js';
import ROUTINE from './routine.js';

// localStorage is shared by every app on the Pages origin — keep the prefix.
const LOG_KEY = 'flex-training:log'; // see normalizeLog in plan.js

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ── state ───────────────────────────────────────────────────────────── */

let log = loadLog();

function loadLog() {
  try { return normalizeLog(JSON.parse(localStorage.getItem(LOG_KEY))); } catch { return normalizeLog(null); }
}

function saveLog() {
  try { localStorage.setItem(LOG_KEY, JSON.stringify(log)); }
  catch { notify('Couldn’t save — this browser’s storage is full or blocked.', true); }
}

/* ── derived ─────────────────────────────────────────────────────────── */

function upcoming(from, days) {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return occurrences(ROUTINE, start, addDays(start, days));
}

function findOccurrence(key) {
  const date = fromYmd(key.slice(0, 10));
  return occurrences(ROUTINE, date, addDays(date, 1)).find((o) => o.key === key) || null;
}

function status(occ) {
  const e = log.entries[occ.key];
  if (e?.done) return 'done';
  if (e && !isEmptyEntry(e)) return 'started';
  return '';
}
const STATUS_LABEL = { done: 'Done', started: 'Started', '': '' };

const fmtTime = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const fmtDay = (d, opts = {}) => d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', ...opts });

/* ── routing ─────────────────────────────────────────────────────────── */

window.addEventListener('hashchange', render);

function render() {
  const [route, ...rest] = (location.hash.slice(1) || 'week').split('/');
  const arg = decodeURIComponent(rest.join('/'));
  const tab = { s: 'week', m: 'moves' }[route] || route;
  document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
  const view = $('view');
  if (route === 's') view.innerHTML = sessionView(arg);
  else if (route === 'moves') view.innerHTML = movesView();
  else if (route === 'm') view.innerHTML = moveView(arg);
  else if (route === 'history') view.innerHTML = historyView();
  else view.innerHTML = weekView(arg);
  if (route === 'moves') filterMoves();
  window.scrollTo(0, 0);
}

/* ── week ────────────────────────────────────────────────────────────── */

function weekView(arg) {
  const now = new Date();
  const monday = weekStart(/^\d{4}-\d{2}-\d{2}$/.test(arg) ? fromYmd(arg) : now);
  const occs = occurrences(ROUTINE, monday, addDays(monday, 7));
  const todays = occurrences(ROUTINE, new Date(now.getFullYear(), now.getMonth(), now.getDate()), addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), 1));
  const thisWeek = ymd(monday) === ymd(weekStart(now));
  const done = occs.filter((o) => status(o) === 'done').length;

  let html = '';
  if (thisWeek) {
    if (todays.length) {
      html += todays.map((o) => {
        const s = o.session;
        return `<div class="card today">
          <span class="label">Today · ${esc(fmtTime(o.start))}</span>
          <h2>${esc(o.session.title)}</h2>
          <p class="muted">${s.total ? `${s.total} min` : ''}${s.short?.minutes ? ` · short version ~${s.short.minutes} min` : ''}</p>
          <a class="link-button" href="#s/${encodeURIComponent(o.key)}">${status(o) === 'done' ? 'Done ✓ — open' : 'Start →'}</a>
        </div>`;
      }).join('');
    } else {
      const next = upcoming(now, 14).find((o) => o.start > now);
      html += `<div class="card today"><span class="label">Today</span><h2>Rest day</h2>${next ? `<p class="muted">Next: ${esc(next.session.title)}, ${esc(fmtDay(next.start))} at ${esc(fmtTime(next.start))}</p>` : ''}</div>`;
    }
  }

  html += `<div class="spread week-nav">
      <a class="btn" href="#week/${ymd(addDays(monday, -7))}" aria-label="Previous week">‹</a>
      <span class="range">${esc(monday.toLocaleDateString([], { month: 'short', day: 'numeric' }))} – ${esc(addDays(monday, 6).toLocaleDateString([], { month: 'short', day: 'numeric' }))}</span>
      <a class="btn" href="#week/${ymd(addDays(monday, 7))}" aria-label="Next week">›</a>
    </div>
    <p class="progress">${done} of ${occs.length} done${thisWeek ? ' this week' : ''}${thisWeek ? '' : ` · <a href="#week">this week</a>`}</p>`;

  for (let i = 0; i < 7; i++) {
    const day = addDays(monday, i);
    const list = occs.filter((o) => ymd(o.start) === ymd(day));
    html += `<div class="day${ymd(day) === ymd(now) ? ' is-today' : ''}">
      <div class="dname">${esc(day.toLocaleDateString([], { weekday: 'short' }))}<b>${day.getDate()}</b></div>
      <div>${list.length ? list.map(occRow).join('') : '<div class="rest">Rest</div>'}</div>
    </div>`;
  }
  html += `<div class="spread export">
      <span class="muted tiny">Changed the routine? Export it and import the file into Calendar.</span>
      <button id="exportBtn" class="btn" type="button">Export .ics</button>
    </div>`;
  return html;
}

function occRow(o) {
  const s = o.session;
  const st = status(o);
  return `<a class="occ" href="#s/${encodeURIComponent(o.key)}">
    <span><span class="name">${esc(o.session.title)}</span><br><span class="when">${esc(fmtTime(o.start))}${s.total ? ` · ${s.total} min` : ''}</span></span>
    ${st ? `<span class="chip ${st}">${STATUS_LABEL[st]}</span>` : ''}
  </a>`;
}

/* ── session ─────────────────────────────────────────────────────────── */

function entryFor(occ) {
  return log.entries[occ.key] || { date: ymd(occ.start), title: occ.session.title, variant: 'full', checked: [], notes: '', done: false, updated: 0 };
}

function sessionView(key) {
  const occ = findOccurrence(key);
  if (!occ) return `<a class="back" href="#week">‹ Week</a><p class="muted">That session isn’t in the plan any more.${log.entries[key] ? ` Your log for it is still under <a href="#history">History</a>.` : ''}</p>`;
  const s = { intro: [], notes: [], footer: [], ...occ.session };
  const e = entryFor(occ);
  const variant = e.variant === 'short' && s.short ? 'short' : 'full';
  const items = checklist(s, variant);
  const checked = new Set(e.checked);
  const count = items.filter((i) => checked.has(i.id)).length;

  let html = `<a class="back" href="#week/${ymd(weekStart(occ.start))}">‹ Week</a>
    <span class="label">${esc(fmtDay(occ.start, { weekday: 'long' }))} · ${esc(fmtTime(occ.start))}</span>
    <h2 class="title">${esc(occ.session.title)}</h2>`;
  if (s.intro.length) html += `<div class="info-box intro">${s.intro.map((l) => `<p>${esc(l)}</p>`).join('')}</div>`;
  if (s.short) {
    html += `<div class="row variant" role="group" aria-label="Which version">
      <button class="btn${variant === 'full' ? ' on' : ''}" data-variant="full" type="button">Full${s.total ? ` · ${s.total} min` : ''}</button>
      <button class="btn${variant === 'short' ? ' on' : ''}" data-variant="short" type="button">Short on time${s.short.minutes ? ` · ~${s.short.minutes} min` : ''}</button>
    </div>`;
  }
  html += `<p class="progress" id="progress" style="margin-top:12px">${count} of ${items.length} ticked</p>`;

  if (variant === 'short') {
    html += `<h3 class="sec">Short version</h3>${items.map((i) => moveRow(i, checked)).join('')}`;
    if (s.short.skip) html += `<p class="skip">Skipping: ${esc(s.short.skip)}</p>`;
  } else {
    for (const sec of s.sections) {
      html += `<h3 class="sec">${esc(sec.title)} <span class="mins">· ${sec.minutes} min</span></h3>`;
      if (sec.note) html += `<p class="sec-note">${esc(sec.note)}</p>`;
      html += items.filter((i) => i.section === sec).map((i) => moveRow(i, checked)).join('');
    }
  }
  if (s.footer.length) html += `<div class="info-box footer-note">${s.footer.map((l) => `<p>📌 ${esc(l)}</p>`).join('')}</div>`;

  html += `<h3 class="sec">Notes</h3><div class="notes-box">
    ${s.notes.length ? `<ul class="prompts">${s.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    <textarea id="notes" placeholder="How did it go? Measurements, breakthroughs, anything tight…">${esc(e.notes)}</textarea>
  </div>
  <div class="row done-bar">
    <button id="doneBtn" class="btn ${e.done ? 'on' : 'primary'}" type="button">${e.done ? 'Done ✓' : 'Mark session done'}</button>
    ${e.done ? '<span class="muted tiny">Tap again to undo.</span>' : ''}
  </div>`;
  return html;
}

function moveRow({ id, item }, checked) {
  const on = checked.has(id);
  const timers = timerOptions(item);
  const mk = moveKey(item.name);
  return `<div class="move${on ? ' checked' : ''}">
    <input type="checkbox" data-check="${esc(id)}" id="c-${esc(id)}" ${on ? 'checked' : ''} aria-label="${esc(item.name)} done">
    <div>
      <label class="mname" for="c-${esc(id)}">${esc(item.name)}</label><span class="mdur">${esc(item.duration)}</span>
      ${item.detail ? `<div class="mdetail">${esc(item.detail)}</div>` : ''}
      ${item.cues?.length ? `<details class="cues"><summary>Cues (${item.cues.length})</summary>${cueList(item.cues)}</details>` : ''}
      <div class="row move-tools">
        ${timers.map((t) => `<button class="btn" type="button" data-timer="${t.seconds}" data-label="${esc(item.name)} · ${esc(t.label)}">⏱ ${esc(t.label)}</button>`).join('')}
        <a href="#m/${encodeURIComponent(mk)}">About this movement →</a>
      </div>
    </div>
  </div>`;
}

const cueList = (cues) => `<ul>${cues.map((c) => `<li${cueSub(c) ? ' class="sub"' : ''}>${esc(cueText(c))}</li>`).join('')}</ul>`;

function updateEntry(occ, change) {
  const e = { ...entryFor(occ), ...change, title: occ.session.title, date: ymd(occ.start), updated: Date.now() };
  if (isEmptyEntry(e) && e.variant === 'full') delete log.entries[occ.key];
  else log.entries[occ.key] = e;
  saveLog();
}

function currentOcc() {
  const [route, ...rest] = location.hash.slice(1).split('/');
  return route === 's' ? findOccurrence(decodeURIComponent(rest.join('/'))) : null;
}

$('view').addEventListener('change', (ev) => {
  const id = ev.target.dataset?.check;
  if (id == null) return;
  const occ = currentOcc();
  if (!occ) return;
  const e = entryFor(occ);
  const set = new Set(e.checked);
  if (ev.target.checked) set.add(id); else set.delete(id);
  const items = checklist(occ.session, e.variant === 'short' ? 'short' : 'full');
  const all = items.every((i) => set.has(i.id));
  // Ticking the last movement marks the session done; unticking doesn't undo
  // a done you set yourself.
  updateEntry(occ, { checked: [...set], done: e.done || all });
  ev.target.closest('.move').classList.toggle('checked', ev.target.checked);
  if (all && !e.done) render();
  else $('progress').textContent = `${items.filter((i) => set.has(i.id)).length} of ${items.length} ticked`;
});

let notesTimer = null;
$('view').addEventListener('input', (ev) => {
  if (ev.target.id === 'notes') {
    const occ = currentOcc();
    if (!occ) return;
    const value = ev.target.value;
    clearTimeout(notesTimer);
    notesTimer = setTimeout(() => updateEntry(occ, { notes: value }), 300);
  } else if (ev.target.id === 'moveSearch') {
    filterMoves();
  }
});

$('view').addEventListener('click', (ev) => {
  const t = ev.target.closest('button');
  if (!t) return;
  if (t.dataset.timer) { startTimer(+t.dataset.timer, t.dataset.label); return; }
  if (t.dataset.variant) {
    const occ = currentOcc();
    if (occ) { updateEntry(occ, { variant: t.dataset.variant }); render(); }
    return;
  }
  if (t.id === 'doneBtn') {
    const occ = currentOcc();
    if (occ) { clearTimeout(notesTimer); updateEntry(occ, { done: !entryFor(occ).done, notes: $('notes').value }); render(); }
    return;
  }
  if (t.id === 'backupBtn') downloadBackup();
  if (t.id === 'exportBtn') download(toIcs(ROUTINE), 'Flex Training.ics', 'text/calendar');
  if (t.id === 'restoreBtn') $('backupFile').click();
});

/* ── movements ───────────────────────────────────────────────────────── */

let indexCache = null;
function index() {
  indexCache ||= movementIndex(ROUTINE);
  return indexCache;
}

function movesView() {
  return `<input id="moveSearch" class="search" type="search" placeholder="Search movements, e.g. couch, bridge, lats" aria-label="Search movements">
    <div class="mlist" id="mlist">${index().map((m) => `<a href="#m/${encodeURIComponent(m.key)}" data-name="${esc(m.name.toLowerCase())} ${esc(m.writeups.map((w) => w.name).join(' ').toLowerCase())}">
      <div class="card"><h2>${esc(m.name)}</h2><p class="meta">${esc(m.sessions.join(' · '))}</p></div></a>`).join('')}</div>`;
}

function filterMoves() {
  const q = ($('moveSearch')?.value || '').trim().toLowerCase();
  document.querySelectorAll('#mlist a').forEach((a) => { a.hidden = q && !a.dataset.name.includes(q); });
}

function moveView(key) {
  const m = index().find((x) => x.key === key);
  if (!m) return `<a class="back" href="#moves">‹ Movements</a><p class="muted">That movement isn’t in the current plan.</p>`;
  const doneDates = Object.values(log.entries)
    .filter((e) => e.checked.some((c) => moveKey(c.split(' / ').pop()) === key))
    .map((e) => e.date).sort();
  let html = `<a class="back" href="#moves">‹ Movements</a>
    <h2 class="title">${esc(m.name)}</h2>
    <p class="meta" style="margin-top:4px">In: ${esc(m.sessions.join(' · '))}</p>
    <p class="muted tiny">${doneDates.length ? `Ticked off ${doneDates.length} time${doneDates.length === 1 ? '' : 's'} · last ${esc(fmtDay(fromYmd(doneDates.at(-1))))}` : 'Not ticked off yet.'}</p>`;
  for (const w of m.writeups) {
    html += `<div class="card writeup">
      <span class="label">${esc(w.session)}${w.current ? '' : ' (earlier version)'}${w.name !== m.name ? ` — ${esc(w.name)}` : ''} · ${esc(w.duration)}</span>
      ${w.detail ? `<p>${esc(w.detail)}</p>` : ''}
      ${w.cues.length ? cueList(w.cues) : ''}
    </div>`;
  }
  return html;
}

/* ── history ─────────────────────────────────────────────────────────── */

function historyView() {
  const entries = Object.entries(log.entries).sort((a, b) => b[1].date.localeCompare(a[1].date) || b[1].updated - a[1].updated);
  let html = `<div class="spread" style="margin-bottom:12px">
      <span class="progress">${entries.filter(([, e]) => e.done).length} sessions done</span>
      <span class="row"><button id="backupBtn" class="btn" type="button">Download backup</button><button id="restoreBtn" class="btn" type="button">Restore backup</button></span>
    </div>`;
  if (!entries.length) return `${html}<p class="muted">Nothing logged yet. Open a session from the Week tab and tick things off.</p>`;
  html += '<div class="hist">';
  for (const [key, e] of entries) {
    html += `<a href="#s/${encodeURIComponent(key)}"><div class="card">
      <div class="spread"><h2>${esc(e.title || 'Session')}</h2>${e.done ? '<span class="chip done">Done</span>' : '<span class="chip started">Started</span>'}</div>
      <p class="meta">${esc(fmtDay(fromYmd(e.date)))}${e.variant === 'short' ? ' · short version' : ''} · ${e.checked.length} ticked</p>
      ${e.notes.trim() ? `<div class="notes">${esc(e.notes)}</div>` : ''}
    </div></a>`;
  }
  return `${html}</div>`;
}

function downloadBackup() {
  download(JSON.stringify(log, null, 2), `flex-training-log-${ymd(new Date())}.json`, 'application/json');
}

function download(text, name, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Restoring merges: for a session in both, whichever was edited last wins.
$('backupFile').addEventListener('change', async (ev) => {
  const file = ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  try {
    const incoming = normalizeLog(JSON.parse(await file.text()));
    let n = 0;
    for (const [k, e] of Object.entries(incoming.entries)) {
      if (!log.entries[k] || log.entries[k].updated <= e.updated) { log.entries[k] = e; n++; }
    }
    saveLog();
    notify(`Restored ${n} session${n === 1 ? '' : 's'}.`);
    render();
  } catch { notify('That doesn’t look like a Flex Training backup.', true); }
});

/* ── notices ─────────────────────────────────────────────────────────── */

let noticeTimer = null;
function notify(text, bad = false) {
  const n = $('notice');
  n.textContent = text;
  n.classList.toggle('bad', bad);
  n.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { n.hidden = true; }, 5000);
}

/* ── hold timer ──────────────────────────────────────────────────────── */

const timer = { total: 0, endAt: 0, left: 0, running: false, tick: null };
let audioCtx = null;
let wakeLock = null;

function startTimer(seconds, label) {
  // The tap that starts the timer is what lets iOS play the end beep.
  try { audioCtx ||= new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch { /* silent */ }
  timer.total = seconds;
  timer.left = seconds;
  $('timerLabel').textContent = label;
  $('timer').hidden = false;
  run();
}

function run() {
  timer.endAt = Date.now() + timer.left * 1000;
  timer.running = true;
  $('timer').classList.remove('finished');
  $('timerToggle').textContent = 'Pause';
  clearInterval(timer.tick);
  timer.tick = setInterval(paint, 200);
  keepAwake(true);
  paint();
}

function pause() {
  timer.left = Math.max(0, (timer.endAt - Date.now()) / 1000);
  timer.running = false;
  clearInterval(timer.tick);
  $('timerToggle').textContent = 'Resume';
  keepAwake(false);
}

function paint() {
  const left = timer.running ? Math.max(0, (timer.endAt - Date.now()) / 1000) : timer.left;
  const s = Math.ceil(left);
  $('timerTime').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  if (timer.running && left <= 0) {
    timer.running = false;
    timer.left = 0;
    clearInterval(timer.tick);
    $('timer').classList.add('finished');
    $('timerToggle').textContent = 'Again';
    keepAwake(false);
    chime();
  }
}

function chime() {
  try { navigator.vibrate?.([200, 100, 200]); } catch { /* no vibration */ }
  if (!audioCtx) return;
  for (let i = 0; i < 3; i++) {
    const t = audioCtx.currentTime + i * 0.28;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.22);
  }
}

async function keepAwake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen');
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { wakeLock = null; }
}

$('timerToggle').addEventListener('click', () => {
  if (timer.running) pause();
  else { if (timer.left <= 0) timer.left = timer.total; run(); }
});
$('timerReset').addEventListener('click', () => { pause(); timer.left = timer.total; paint(); $('timer').classList.remove('finished'); });
$('timerClose').addEventListener('click', () => { pause(); $('timer').hidden = true; });

render();
