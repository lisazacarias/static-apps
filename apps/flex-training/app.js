import {
  CLASS_TYPES, LOADS, DAY_NAMES, versionOf, deloadInfo, normalizeWeeks, normalizeWeek, emptyWeek, weekFromExample, copyWeek, isPlanned,
  occurrences, checkWeek, checklist, timerOptions, movementIndex, moveKey, cueText, cueSub,
  normalizeLog, isEmptyEntry, toIcs, suggestWeek, playPhases, nextToDo, ymd, fromYmd, addDays, weekStart,
} from './plan.js';
import ROUTINE from './routine.js';
import FORM from './form.js';

// localStorage is shared by every app on the Pages origin — keep the prefix.
const LOG_KEY = 'flex-training:log';     // see normalizeLog in plan.js
const WEEKS_KEY = 'flex-training:weeks'; // see normalizeWeeks in plan.js

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SESSION = Object.fromEntries(ROUTINE.sessions.map((s) => [s.id, s]));
const SESSION_IDS = ROUTINE.sessions.map((s) => s.id);
const CLASS = Object.fromEntries(CLASS_TYPES.map((c) => [c.id, c]));
const REF = Object.fromEntries(ROUTINE.guide.references.map((r) => [r.n, r]));

// Plan text with its [n] citations turned into links to the source.
const rich = (s) => esc(s).replace(/\[(\d+)\]/g, (m, n) => (REF[n]
  ? `<a class="ref" href="${esc(REF[n].url)}" target="_blank" rel="noopener" title="${esc(REF[n].text)}">[${n}]</a>`
  : m));

/* ── state ───────────────────────────────────────────────────────────── */

let log = load(LOG_KEY, normalizeLog);
let weeks = load(WEEKS_KEY, (raw) => normalizeWeeks(raw, SESSION_IDS));
let editing = null; // Monday (YYYY-MM-DD) of the week being edited

function load(key, normalize) {
  try { return normalize(JSON.parse(localStorage.getItem(key))); } catch { return normalize(null); }
}

function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { notify('Couldn’t save — this browser’s storage is full or blocked.', true); }
}
const saveLog = () => save(LOG_KEY, log);
const saveWeeks = () => save(WEEKS_KEY, weeks);

function setWeek(monday, week) {
  weeks.weeks[monday] = normalizeWeek(week, SESSION_IDS);
  saveWeeks();
}

/* ── derived ─────────────────────────────────────────────────────────── */

const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };

// A day's sessions: what's planned, plus anything logged that wasn't.
function sessionsOn(date) {
  const planned = occurrences(ROUTINE, weeks, date, addDays(date, 1));
  const ids = new Set(planned.map((o) => o.session.id));
  const extra = Object.keys(log.entries)
    .filter((k) => k.startsWith(`${ymd(date)}|`) && SESSION[k.slice(11)] && !ids.has(k.slice(11)))
    .map((k) => ({ key: k, session: SESSION[k.slice(11)], date, time: '', unplanned: true }));
  return [...planned, ...extra];
}

function parseKey(key) {
  const [date, id] = key.split('|');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !SESSION[id]) return null;
  const d = fromYmd(date);
  return sessionsOn(d).find((o) => o.key === key) || { key, session: SESSION[id], date: d, time: '', unplanned: true };
}

const weekOf = (date) => weeks.weeks[ymd(weekStart(date))];
const isDeload = (date) => deloadInfo(weeks, weekStart(date)).deload;

function status(key) {
  const e = log.entries[key];
  if (e?.done) return 'done';
  if (e && !isEmptyEntry(e)) return 'started';
  return '';
}
const STATUS_LABEL = { done: 'Done', started: 'Started', '': '' };

const fmtTime = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
const fmtDay = (d, opts = {}) => d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', ...opts });
const fmtClock = (sec) => { const n = Math.ceil(sec); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; };
const fmtShort = (d) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
const sessionHref = (date, id) => `#s/${encodeURIComponent(`${ymd(date)}|${id}`)}`;

/* ── routing ─────────────────────────────────────────────────────────── */

window.addEventListener('hashchange', () => render());

function render(keepScroll = false) {
  const [route, ...rest] = (location.hash.slice(1) || 'week').split('/');
  const arg = decodeURIComponent(rest.join('/'));
  const tab = { s: 'week', play: 'week', m: 'moves' }[route] || route;
  if (route !== 'play') closePlayer();
  document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
  const view = $('view');
  const y = window.scrollY;
  if (route === 'play') { openPlayer(arg); view.innerHTML = sessionView(arg); }
  else if (route === 's') view.innerHTML = sessionView(arg);
  else if (route === 'sessions') view.innerHTML = sessionsView();
  else if (route === 'moves') view.innerHTML = movesView();
  else if (route === 'm') view.innerHTML = moveView(arg);
  else if (route === 'guide') view.innerHTML = guideView();
  else if (route === 'history') view.innerHTML = historyView();
  else view.innerHTML = weekView(arg);
  if (route === 'moves') filterMoves();
  window.scrollTo(0, keepScroll ? y : 0);
}

/* ── week ────────────────────────────────────────────────────────────── */

function weekView(arg) {
  const now = today();
  const monday = weekStart(/^\d{4}-\d{2}-\d{2}$/.test(arg) ? fromYmd(arg) : now);
  const mk = ymd(monday);
  const week = weeks.weeks[mk];
  const planned = isPlanned(week);
  const edit = editing === mk || !planned;
  const thisWeek = mk === ymd(weekStart(now));
  const past = addDays(monday, 7) <= now;

  let html = '';
  if (thisWeek) {
    const list = sessionsOn(now);
    html += list.length
      ? list.map((o) => `<div class="card today">
          <span class="label">Today${o.time ? ` · ${esc(fmtTime(o.time))}` : ''}${isDeload(now) ? ' · deload week' : ''}</span>
          <h2>${esc(o.session.title)}</h2>
          <p class="muted">${esc(o.session.length)}${o.session.versions ? ` · ${o.session.versions.map((v) => `${v.minutes}-min`).join(' or ')} version available` : ''}</p>
          ${status(o.key) === 'done'
            ? `<a class="link-button" href="${sessionHref(now, o.session.id)}">Done ✓ — open</a>`
            : `<a class="link-button" href="#play/${encodeURIComponent(o.key)}">${log.entries[o.key]?.resume ? '▶ Resume' : '▶ Start'}</a> <a class="tiny" href="${sessionHref(now, o.session.id)}">See the whole session</a>`}
        </div>`).join('')
      : `<div class="card today"><span class="label">Today</span><h2>${week?.days[(now.getDay() + 6) % 7].classes.length ? 'Class day' : 'Nothing planned'}</h2>
          <p class="muted">${week?.days[(now.getDay() + 6) % 7].classes.length ? `Before class, do <a href="${sessionHref(now, 'class-prep')}">Class-day prep</a>.` : `Any session is in the <a href="#sessions">Sessions</a> tab.`}</p></div>`;
  }

  html += `<div class="spread week-nav">
      <a class="btn" href="#week/${ymd(addDays(monday, -7))}" aria-label="Previous week">‹</a>
      <span class="range">${esc(fmtShort(monday))} – ${esc(fmtShort(addDays(monday, 6)))}</span>
      <a class="btn" href="#week/${ymd(addDays(monday, 7))}" aria-label="Next week">›</a>
    </div>`;
  if (!thisWeek) html += `<p class="progress"><a href="#week">Back to this week</a></p>`;

  if (!planned) {
    const prev = Object.keys(weeks.weeks).filter((k) => k < mk && isPlanned(weeks.weeks[k])).sort().at(-1);
    html += `<div class="card plan-start">
      <h2>Plan this week</h2>
      <p class="muted">Add the week’s classes below and the sessions are suggested around them, following the placement rules. Or start from:</p>
      <div class="row">
        <button class="btn" type="button" id="suggestBtn">Suggest with no classes</button>
        ${prev ? `<button class="btn primary" type="button" data-start="copy:${prev}">Copy week of ${esc(fmtShort(fromYmd(prev)))}</button>` : ''}
        ${ROUTINE.guide.examples.map((ex, i) => `<button class="btn" type="button" data-start="example:${i}" title="${esc(ex.title)}">Example week ${'AB'[i] || i + 1}</button>`).join('')}
      </div>
    </div>`;
  }

  if (!past) html += addClassCard();

  const { minimums, flags } = checkWeek(ROUTINE, weeks, monday);
  const doneIn = (id) => [0, 1, 2, 3, 4, 5, 6].filter((i) => status(`${ymd(addDays(monday, i))}|${id}`) === 'done').length;
  html += `<div class="minimums">
      <span class="label">Weekly minimums</span>
      <div class="row">${minimums.map((m) => {
        const done = doneIn(m.session);
        const cls = done >= m.count ? 'done' : m.planned >= m.count ? 'planned' : 'missing';
        return `<span class="min ${cls}" title="${esc(m.serves)}">${esc(SESSION[m.session].title)} <b>${cls === 'done' ? '✓' : cls === 'planned' ? 'planned' : 'not planned'}</b></span>`;
      }).join('')}</div>
    </div>`;

  const dl = deloadInfo(weeks, monday);
  html += `<div class="spread week-tools">
      <label class="deload">Deload
        <select class="add" id="deloadSel" aria-label="Deload week">
          <option value=""${dl.setting === '' ? ' selected' : ''}>Automatic · ${dl.setting === '' && dl.deload ? 'this week' : 'not this week'}</option>
          <option value="on"${dl.setting === 'on' ? ' selected' : ''}>Deload this week</option>
          <option value="off"${dl.setting === 'off' ? ' selected' : ''}>Not this week</option>
        </select></label>
      <span class="row">
        ${planned ? `<button class="btn${edit ? ' on' : ''}" type="button" id="editBtn">${edit ? 'Done editing' : 'Edit week'}</button>` : ''}
        ${planned ? `<button class="btn" type="button" id="exportBtn">Export .ics</button>` : ''}
      </span>
    </div>`;
  if (planned && !past) html += `<p class="auto-note tiny"><button class="btn" type="button" id="suggestBtn">Suggest again</button> ✦ Sessions are re-suggested whenever a class changes. Ones you’ve done or started stay put${thisWeek ? ', and nothing goes on days that have passed' : ''}.</p>`;
  if (dl.deload) html += `<p class="info-box tiny"><b>Deload week${dl.setting === 'on' ? '' : ', every 4th'}.</b> Sessions open on their short version. ${rich(ROUTINE.guide.deload)}</p>`;
  else if (dl.next) html += `<p class="muted tiny deload-next">Next deload: week of ${esc(fmtShort(fromYmd(dl.next)))}.</p>`;

  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    const day = week?.days[i] || emptyWeek().days[i];
    const list = sessionsOn(date);
    const dayFlags = flags.filter((f) => f.day === i);
    html += `<div class="day${ymd(date) === ymd(now) ? ' is-today' : ''}">
      <div class="dname">${esc(date.toLocaleDateString([], { weekday: 'short' }))}<b>${date.getDate()}</b></div>
      <div>
        ${day.classes.length || edit ? `<div class="row classes">${day.classes.map((c) => classChip(c, i, edit)).join('')}
          ${edit ? `<select class="add" data-addclass="${i}" aria-label="Add a class on ${DAY_NAMES[i]}"><option value="">+ class</option>${CLASS_TYPES.filter((c) => !day.classes.some((x) => x.id === c.id)).map((c) => `<option value="${c.id}">${esc(c.label)}</option>`).join('')}</select>` : ''}</div>` : ''}
        ${list.map((o) => occRow(o, i, edit)).join('')}
        ${!list.length && !edit ? `<div class="rest">${day.classes.length ? 'Class-day prep before class' : 'Rest'}</div>` : ''}
        ${edit ? `<select class="add" data-addsession="${i}" aria-label="Add a session on ${DAY_NAMES[i]}"><option value="">+ session</option>${ROUTINE.sessions.filter((s) => !day.sessions.some((p) => p.id === s.id)).map((s) => `<option value="${s.id}">${esc(s.title)} (${esc(s.length)})</option>`).join('')}</select>` : ''}
        ${dayFlags.map((f) => `<p class="flag ${f.level}"><b>Rule ${f.rule}.</b> ${esc(f.text)}</p>`).join('')}
      </div>
    </div>`;
  }
  return html;
}

// A class on the week view. Its time and length are optional; with them the
// rule checks count exact hours instead of whole days.
function classChip(c, dayIndex, edit) {
  const label = esc(CLASS[c.id].label);
  const hard = c.load !== 'light';
  if (!edit) {
    return `<span class="class${hard ? ' hard' : ''}" title="${esc(LOADS[c.load])}">${label}${c.double ? ' ×2' : ''}${c.time ? ` · ${esc(fmtTime(c.time))}` : ''}${hard ? ` · hard${c.load === 'both' ? '' : ` ${c.load}`}` : ''}</span>`;
  }
  const key = `${dayIndex}:${c.id}`;
  return `<span class="class editing${hard ? ' hard' : ''}">${label}
    <input type="time" class="time" value="${esc(c.time)}" data-classtime="${key}" aria-label="${label} start time">
    <input type="number" class="hours" min="0.5" max="12" step="0.5" value="${c.hours}" data-classhours="${key}" aria-label="${label} length in hours"><span class="tiny">h</span>
    <select class="add" data-classload="${key}" aria-label="${label} load">${Object.entries(LOADS).map(([k, v]) => `<option value="${k}"${k === c.load ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>
    <label class="tiny dbl"><input type="checkbox" data-classdouble="${key}"${c.double ? ' checked' : ''}> double</label>
    <button type="button" class="x" data-unclass="${key}" aria-label="Remove ${label}">×</button></span>`;
}

// One place to add a class on any days of the week: pick the class, tap
// the days, optionally a time and length. Kept between renders so adding
// the same class to more weeks is quick.
const addForm = { type: CLASS_TYPES[0].id, days: new Set(), time: '', hours: '' };

function addClassCard() {
  const t = CLASS_TYPES.find((c) => c.id === addForm.type);
  return `<div class="card add-class">
    <h2>Add a class</h2>
    <div class="row">
      <select id="acType" class="add big" aria-label="Class">${CLASS_TYPES.map((c) => `<option value="${c.id}"${c.id === addForm.type ? ' selected' : ''}>${esc(c.label)}</option>`).join('')}</select>
    </div>
    <div class="day-picks" role="group" aria-label="Days">${DAY_NAMES.map((d, i) => `<button type="button" class="day-pick${addForm.days.has(i) ? ' on' : ''}" data-acday="${i}" aria-pressed="${addForm.days.has(i)}">${d.slice(0, 3)}</button>`).join('')}</div>
    <div class="row">
      <label class="tiny">Start <input id="acTime" type="time" class="time" value="${esc(addForm.time)}"></label>
      <label class="tiny">Length <input id="acHours" type="number" class="hours" min="0.5" max="12" step="0.25" placeholder="${t.hours}" value="${esc(addForm.hours)}"> h</label>
      <button id="acAdd" class="btn primary" type="button"${addForm.days.size ? '' : ' disabled'}>Add${addForm.days.size > 1 ? ` to ${addForm.days.size} days` : ''}</button>
    </div>
    <p class="tiny muted">Time and length are optional; with them the rules check exact hours. Sessions are re-suggested after.</p>
  </div>`;
}

function addClasses() {
  const monday = currentMonday();
  const week = normalizeWeek(weeks.weeks[monday] || {}, SESSION_IDS);
  const hours = parseFloat(addForm.hours);
  for (const i of addForm.days) {
    const day = week.days[i];
    const existing = day.classes.find((c) => c.id === addForm.type);
    const c = existing || { id: addForm.type };
    if (addForm.time) c.time = addForm.time;
    if (hours > 0) c.hours = hours;
    if (!existing) day.classes.push(c);
  }
  setWeek(monday, week);
  suggest(monday);
  const n = addForm.days.size;
  notify(`Added ${CLASS_TYPES.find((c) => c.id === addForm.type).label.toLowerCase()} on ${n} day${n === 1 ? '' : 's'}.`);
  addForm.days.clear();
  render(true);
}

function occRow(o, dayIndex, edit) {
  const st = status(o.key);
  const right = edit && !o.unplanned
    ? `<span class="row"><input type="time" class="time" value="${esc(o.time)}" data-time="${dayIndex}:${o.session.id}" aria-label="Start time"><button type="button" class="x" data-unplan="${dayIndex}:${o.session.id}" aria-label="Remove ${esc(o.session.title)}">×</button></span>`
    : st === 'done' ? `<span class="chip done">${STATUS_LABEL[st]}</span>`
    : `<span class="row">${st ? `<span class="chip ${st}">${STATUS_LABEL[st]}</span>` : ''}<a class="play-link" href="#play/${encodeURIComponent(o.key)}" aria-label="${log.entries[o.key]?.resume ? 'Resume' : 'Start'} ${esc(o.session.title)}">▶</a></span>`;
  return `<div class="occ">
    <a href="${sessionHref(o.date, o.session.id)}"><span class="name">${esc(o.session.title)}</span><br><span class="when">${o.time ? `${esc(fmtTime(o.time))} · ` : ''}${esc(o.session.length)}${o.unplanned ? ' · not planned' : ''}</span></a>
    ${right}
  </div>`;
}

// A change to a day's classes or sessions. Changing a class re-suggests the
// week's sessions; a session you change yourself stays until the next one.
function changeWeek(dayIndex, f, what = 'sessions') {
  const monday = currentMonday();
  const week = normalizeWeek(weeks.weeks[monday] || {}, SESSION_IDS);
  f(week.days[dayIndex], week);
  setWeek(monday, week);
  if (what === 'classes') suggest(monday);
  editing = monday;
  render(true);
}

// Re-suggests a week's sessions. What you've done or started that week —
// planned or not — stays on its day, and in the current week nothing new
// goes on a day that's passed. A past week is left alone.
function suggest(monday) {
  const start = fromYmd(monday);
  const now = today();
  if (addDays(start, 7) <= now) return;
  const week = weeks.weeks[monday] || emptyWeek();
  const keep = week.days.map((d, i) => {
    const date = ymd(addDays(start, i));
    const planned = d.sessions.filter((s) => status(`${date}|${s.id}`));
    const logged = Object.keys(log.entries)
      .filter((k) => k.startsWith(`${date}|`) && SESSION[k.slice(11)] && status(k) && !planned.some((s) => s.id === k.slice(11)))
      .map((k) => ({ id: k.slice(11), time: '' }));
    return [...planned, ...logged];
  });
  const from = monday === ymd(weekStart(now)) ? (now.getDay() + 6) % 7 : 0;
  setWeek(monday, suggestWeek(ROUTINE, weeks, start, { keep, from }));
}

function currentMonday() {
  const [route, arg] = location.hash.slice(1).split('/');
  return ymd(weekStart(route === 'week' && /^\d{4}-\d{2}-\d{2}$/.test(arg || '') ? fromYmd(arg) : today()));
}

/* ── sessions menu ───────────────────────────────────────────────────── */

const KIND_LABEL = { big: 'Big session', short: 'Short session', prep: 'Before class' };

function sessionsView() {
  const now = today();
  return `<p class="muted tiny" style="margin-bottom:12px">Every session in the plan. Start one now, planned or not.</p>
    ${ROUTINE.sessions.map((s) => {
      const key = `${ymd(now)}|${s.id}`;
      const st = status(key);
      return `<div class="card session-card">
      <span class="label">${KIND_LABEL[s.kind]} · ${esc(s.length)}${(s.versions || []).map((v) => ` · ${v.minutes}-min ${v.id === 'short' ? '' : `${v.id} `}version`).join('')}</span>
      <h2><a href="${sessionHref(now, s.id)}">${esc(s.title)}</a></h2>
      ${s.about?.[0] ? `<p class="muted">${esc(s.about[0].replace(/\s*\[\d+\]/g, ''))}</p>` : ''}
      <div class="row">
        ${st === 'done' ? '<span class="chip done">Done today</span>' : `<a class="btn primary" href="#play/${encodeURIComponent(key)}">${log.entries[key]?.resume ? '▶ Resume' : '▶ Start'}</a>`}
        <a class="btn" href="${sessionHref(now, s.id)}">See the session</a>
      </div>
    </div>`;
    }).join('')}`;
}

/* ── session ─────────────────────────────────────────────────────────── */

// In a deload week a session opens on its short version, as the plan says.
const defaultVariant = (o) => (isDeload(o.date) && o.session.versions ? o.session.versions[0].id : 'full');

function entryFor(o) {
  return log.entries[o.key] || { date: ymd(o.date), title: o.session.title, variant: defaultVariant(o), checked: [], notes: '', done: false, updated: 0 };
}

function sessionView(key) {
  const o = parseKey(key);
  if (!o) return `<a class="back" href="#week">‹ Week</a><p class="muted">That session isn’t in the plan any more.${log.entries[key] ? ` Your log for it is still under <a href="#history">History</a>.` : ''}</p>`;
  const s = o.session;
  const e = entryFor(o);
  const version = versionOf(s, e.variant);
  const variant = version ? version.id : 'full';
  const items = checklist(s, variant);
  const checked = new Set(e.checked);
  const count = items.filter((i) => checked.has(i.id)).length;
  const monday = weekStart(o.date);
  const dayIndex = (o.date.getDay() + 6) % 7;
  // A session opened from the Sessions tab isn't in the plan, so check the
  // week as if it were.
  let weeksToCheck = weeks;
  if (o.unplanned) {
    const week = normalizeWeek(weeks.weeks[ymd(monday)] || {}, SESSION_IDS);
    week.days[dayIndex].sessions.push({ id: s.id, time: '' });
    weeksToCheck = { ...weeks, weeks: { ...weeks.weeks, [ymd(monday)]: week } };
  }
  const flags = checkWeek(ROUTINE, weeksToCheck, monday).flags.filter((f) => f.session === s.id && f.day === dayIndex);

  let html = `<a class="back" href="#week/${ymd(monday)}">‹ Week</a>
    <span class="label">${esc(fmtDay(o.date, { weekday: 'long' }))}${o.time ? ` · ${esc(fmtTime(o.time))}` : ''} · ${esc(s.length)}</span>
    <h2 class="title">${esc(s.title)}</h2>
    ${(s.about || []).map((p) => `<p class="about">${rich(p)}</p>`).join('')}`;
  if (isDeload(o.date) && s.deload) html += `<div class="info-box"><b>Deload week.</b> ${rich(s.deload)}</div>`;
  html += flags.map((f) => `<p class="flag ${f.level}"><b>Rule ${f.rule}.</b> ${esc(f.text)}</p>`).join('');
  html += (s.notes || []).map((n) => `<div class="info-box note"><b>${esc(n.label)}.</b> ${rich(n.text)}</div>`).join('');
  if (s.versions) {
    html += `<div class="row variant" role="group" aria-label="Which version">
      <button class="btn${variant === 'full' ? ' on' : ''}" data-variant="full" type="button">Full · ${esc(s.length)}</button>
      ${s.versions.map((v) => `<button class="btn${variant === v.id ? ' on' : ''}" data-variant="${v.id}" type="button">${esc(v.label.replace(/^(\d+)-minute/, '$1-min'))}</button>`).join('')}
    </div>`;
  }
  const r = e.resume;
  html += `<div class="row start-bar">
      <a class="btn primary" href="#play/${encodeURIComponent(o.key)}">${r ? `▶ Resume · ${Math.min(r.index + 1, items.length)} of ${items.length}${r.left ? `, ${fmtClock(r.left)} left` : ''}` : count ? '▶ Continue' : '▶ Start'}</a>
      <span class="progress" id="progress">${count} of ${items.length} ticked</span>
    </div>`;

  if (version) {
    html += `<h3 class="sec">${esc(version.label)}</h3>${items.map((i) => moveRow(i, checked)).join('')}`;
    if (version.skip) html += `<p class="skip">Skipping: ${esc(version.skip)}</p>`;
  } else {
    for (const sec of s.sections) {
      if (sec.title) html += `<h3 class="sec">${esc(sec.title)}${sec.minutes ? ` <span class="mins">· ${sec.minutes} min</span>` : ''}</h3>`;
      if (sec.note) html += `<p class="sec-note">${rich(sec.note)}</p>`;
      html += items.filter((i) => i.section === sec).map((i) => moveRow(i, checked)).join('');
    }
    for (const p of s.after || []) html += `<p class="about">${rich(p)}</p>`;
    if (s.deload && !isDeload(o.date)) html += `<p class="skip"><b>Deload week:</b> ${rich(s.deload)}</p>`;
  }

  html += `<details class="stop"><summary>Stop rules</summary>
    <p class="tiny muted">${esc(ROUTINE.guide.stopIntro)}</p>
    <ul>${ROUTINE.guide.stopRules.map((r) => `<li><b>${esc(r.area)}.</b> ${rich(r.text)}</li>`).join('')}</ul>
  </details>
  <h3 class="sec">Notes</h3><div class="notes-box">
    <textarea id="notes" placeholder="How did it go? Depth, anything tight, anything that pinched…">${esc(e.notes)}</textarea>
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
      ${item.detail ? `<div class="mdetail">${rich(item.detail)}</div>` : ''}
      ${item.cues?.length || FORM[mk] ? `<details class="cues"><summary>How to do it</summary>${item.cues?.length ? cueList(item.cues) : ''}${FORM[mk] ? formHtml(FORM[mk], true) : ''}</details>` : ''}
      <div class="row move-tools">
        ${timers.map((t) => `<button class="btn" type="button" data-timer="${t.seconds}" data-label="${esc(item.name)} · ${esc(t.label)}">⏱ ${esc(t.label)}</button>`).join('')}
        <a href="#m/${encodeURIComponent(mk)}">About this movement →</a>
      </div>
    </div>
  </div>`;
}

// A movement's form notes. `compact` drops the source line, for inside a
// session where the full page is one tap away.
function formHtml(f, compact = false) {
  return `<div class="form">
    ${f.guess ? `<p class="guess">Best guess: ${esc(f.guess)}</p>` : ''}
    ${f.setup ? `<p><b>Setup.</b> ${esc(f.setup)}</p>` : ''}
    <ol>${f.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
    ${f.cues?.length ? `<p class="form-h">Cues</p><ul>${f.cues.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${f.avoid?.length ? `<p class="form-h">Avoid</p><ul class="avoid">${f.avoid.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${compact ? '' : `<p class="tiny muted">${f.fromPlan ? 'Condensed from the cues in the earlier version of your plan.' : 'General form notes added in the app, not from your plan.'} The plan’s times and reps below are what to follow.</p>`}
  </div>`;
}

const cueList = (cues) => `<ul>${cues.map((c) => `<li${cueSub(c) ? ' class="sub"' : ''}>${rich(cueText(c))}</li>`).join('')}</ul>`;

function updateEntry(o, change) {
  const e = { ...entryFor(o), ...change, title: o.session.title, date: ymd(o.date), updated: Date.now() };
  if (isEmptyEntry(e) && e.variant === defaultVariant(o)) delete log.entries[o.key];
  else log.entries[o.key] = e;
  saveLog();
}

function currentOcc() {
  const [route, ...rest] = location.hash.slice(1).split('/');
  return route === 's' || route === 'play' ? parseKey(decodeURIComponent(rest.join('/'))) : null;
}

/* ── events ──────────────────────────────────────────────────────────── */

$('view').addEventListener('change', (ev) => {
  const t = ev.target;
  if (t.id === 'acType') { addForm.type = t.value; render(true); return; }
  if (t.dataset.addclass) { const i = +t.dataset.addclass; changeWeek(i, (d) => d.classes.push({ id: t.value }), 'classes'); return; }
  const classKey = t.dataset.classtime || t.dataset.classhours || t.dataset.classload || t.dataset.classdouble;
  if (classKey) {
    const [i, id] = classKey.split(':');
    changeWeek(+i, (d) => {
      const c = d.classes.find((x) => x.id === id);
      if (!c) return;
      if (t.dataset.classtime) c.time = t.value;
      else if (t.dataset.classhours) { if (+t.value > 0) c.hours = +t.value; }
      else if (t.dataset.classload) c.load = t.value;
      else c.double = t.checked;
    }, 'classes');
    return;
  }
  if (t.dataset.addsession) { const i = +t.dataset.addsession; changeWeek(i, (d) => d.sessions.push({ id: t.value, time: '' })); return; }
  if (t.dataset.time) {
    const [i, id] = t.dataset.time.split(':');
    changeWeek(+i, (d) => { const p = d.sessions.find((x) => x.id === id); if (p) p.time = t.value; });
    return;
  }
  if (t.id === 'deloadSel') {
    const monday = currentMonday();
    setWeek(monday, { ...(weeks.weeks[monday] || emptyWeek()), deload: t.value });
    render(true);
    return;
  }
  const id = t.dataset?.check;
  if (id == null) return;
  const o = currentOcc();
  if (!o) return;
  const e = entryFor(o);
  const set = new Set(e.checked);
  if (t.checked) set.add(id); else set.delete(id);
  const items = checklist(o.session, e.variant);
  const all = items.every((i) => set.has(i.id));
  // Ticking the last movement marks the session done; unticking doesn't undo
  // a done you set yourself.
  updateEntry(o, { checked: [...set], done: e.done || all });
  t.closest('.move').classList.toggle('checked', t.checked);
  if (all && !e.done) render(true);
  else $('progress').textContent = `${items.filter((i) => set.has(i.id)).length} of ${items.length} ticked`;
});

// Notes save on every keystroke, so a re-render or closing the tab can't
// drop what was just typed.
$('view').addEventListener('input', (ev) => {
  if (ev.target.id === 'acTime') { addForm.time = ev.target.value; return; }
  if (ev.target.id === 'acHours') { addForm.hours = ev.target.value; return; }
  if (ev.target.id === 'notes') {
    const o = currentOcc();
    if (o) updateEntry(o, { notes: ev.target.value });
  } else if (ev.target.id === 'moveSearch') {
    filterMoves();
  }
});

$('view').addEventListener('click', (ev) => {
  const t = ev.target.closest('button');
  if (!t) return;
  if (t.dataset.timer) { startTimer(+t.dataset.timer, t.dataset.label); return; }
  if (t.dataset.acday) {
    const i = +t.dataset.acday;
    if (addForm.days.has(i)) addForm.days.delete(i); else addForm.days.add(i);
    t.classList.toggle('on', addForm.days.has(i));
    t.setAttribute('aria-pressed', addForm.days.has(i));
    const add = $('acAdd');
    add.disabled = !addForm.days.size;
    add.textContent = addForm.days.size > 1 ? `Add to ${addForm.days.size} days` : 'Add';
    return;
  }
  if (t.id === 'acAdd') { addClasses(); return; }
  if (t.dataset.variant) {
    const o = currentOcc();
    if (o) { updateEntry(o, { variant: t.dataset.variant }); render(true); }
    return;
  }
  if (t.dataset.unclass) { const [i, c] = t.dataset.unclass.split(':'); changeWeek(+i, (d) => { d.classes = d.classes.filter((x) => x.id !== c); }, 'classes'); return; }
  if (t.dataset.unplan) { const [i, id] = t.dataset.unplan.split(':'); changeWeek(+i, (d) => { d.sessions = d.sessions.filter((x) => x.id !== id); }); return; }
  if (t.dataset.start) {
    const [kind, arg] = t.dataset.start.split(':');
    const monday = currentMonday();
    setWeek(monday, kind === 'copy' ? copyWeek(weeks.weeks[arg]) : weekFromExample(ROUTINE.guide.examples[+arg]));
    editing = monday;
    render(true);
    return;
  }
  if (t.dataset.useExample) {
    const monday = ymd(weekStart(today()));
    if (isPlanned(weeks.weeks[monday]) && !confirm('Replace this week’s plan with this example?')) return;
    setWeek(monday, weekFromExample(ROUTINE.guide.examples[+t.dataset.useExample]));
    editing = monday;
    location.hash = '#week';
    return;
  }
  if (t.id === 'suggestBtn') {
    const monday = currentMonday();
    suggest(monday);
    editing = monday;
    render(true);
    return;
  }
  if (t.id === 'editBtn') { const m = currentMonday(); editing = editing === m ? null : m; render(true); return; }
  if (t.id === 'exportBtn') {
    const monday = fromYmd(currentMonday());
    download(toIcs(ROUTINE, weeks, monday, addDays(monday, 7)), `Flex Training ${ymd(monday)}.ics`, 'text/calendar');
    return;
  }
  if (t.id === 'doneBtn') {
    const o = currentOcc();
    if (o) { updateEntry(o, { done: !entryFor(o).done, notes: $('notes').value }); render(true); }
    return;
  }
  if (t.id === 'backupBtn') downloadBackup();
  if (t.id === 'restoreBtn') $('backupFile').click();
});

/* ── movements ───────────────────────────────────────────────────────── */

let indexCache = null;
const index = () => (indexCache ||= movementIndex(ROUTINE));

function movesView() {
  return `<input id="moveSearch" class="search" type="search" placeholder="Search movements, e.g. couch, bridge, lats" aria-label="Search movements">
    <div class="mlist" id="mlist">${index().map((m) => `<a href="#m/${encodeURIComponent(m.key)}" data-name="${esc(m.name.toLowerCase())} ${esc(m.uses.map((w) => w.name).join(' ').toLowerCase())}">
      <div class="card"><h2>${esc(m.name)}</h2><p class="meta">${esc(m.sessions.join(' · '))}</p></div></a>`).join('')}</div>`;
}

function filterMoves() {
  const q = ($('moveSearch')?.value || '').trim().toLowerCase();
  document.querySelectorAll('#mlist a').forEach((a) => { a.hidden = q && !a.dataset.name.includes(q); });
}

function moveView(key) {
  const m = index().find((x) => x.key === key);
  if (!m) return `<a class="back" href="#moves">‹ Movements</a><p class="muted">That movement isn’t in the plan.</p>`;
  const doneDates = Object.values(log.entries)
    .filter((e) => e.checked.some((c) => moveKey(c.split(' / ').pop()) === key))
    .map((e) => e.date).sort();
  let html = `<a class="back" href="#moves">‹ Movements</a>
    <h2 class="title">${esc(m.name)}</h2>
    <p class="meta" style="margin-top:4px">In: ${esc(m.sessions.join(' · '))}</p>
    <p class="muted tiny">${doneDates.length ? `Ticked off ${doneDates.length} time${doneDates.length === 1 ? '' : 's'} · last ${esc(fmtDay(fromYmd(doneDates.at(-1))))}` : 'Not ticked off yet.'}</p>`;
  if (FORM[key]) html += `<h3 class="sec">How to do it</h3><div class="card">${formHtml(FORM[key])}</div>`;
  html += `<h3 class="sec">In your sessions</h3><div class="card uses"><ul>${m.uses.map((u) => `<li>
      <b>${esc(u.session)}</b>${u.version ? ` <span class="muted">· ${esc(u.version)}</span>` : ''}${u.name !== m.name ? ` <span class="muted">· ${esc(u.name)}</span>` : ''}
      <span class="mdur">${esc(u.duration)}</span>${u.detail ? `<br>${rich(u.detail)}` : ''}
      ${u.cues.length ? cueList(u.cues) : ''}
    </li>`).join('')}</ul></div>`;
  return html;
}

/* ── guide ───────────────────────────────────────────────────────────── */

function guideView() {
  const g = ROUTINE.guide;
  const sessionName = (id) => esc(SESSION[id].title);
  return `<p class="about">${rich(g.intro)}</p>
    <h3 class="sec">What counts as hard</h3>
    <p class="about">${rich(g.hard.intro)}</p>
    <div class="card"><table class="tbl hard-tbl">
      <tr class="head"><td>Class</td><td>Heart rate</td><td>Soreness next day</td><td>Counts as</td></tr>
      ${g.hard.table.map((r) => `<tr><td><b>${esc(r.klass)}</b></td><td class="tiny">Zone 3+: ${esc(r.zone3)}<br>Zone 5: ${esc(r.zone5)}<br>Peak: ${esc(r.peak)}</td><td>${esc(r.soreness)}</td><td>${esc(r.counts)}</td></tr>`).join('')}
    </table></div>
    ${g.hard.notes.map((n) => `<p class="about tiny">${rich(n)}</p>`).join('')}
    <ul class="steps">${g.hard.meaning.map((l) => `<li>${rich(l)}</li>`).join('')}</ul>
    <p class="about tiny muted">In the Week tab, each class starts at its usual load. Change it for a class that leaves you sore.</p>
    <h3 class="sec">How to build your week</h3>
    <ol class="steps">${g.howTo.map((l) => `<li>${rich(l)}</li>`).join('')}</ol>
    <h3 class="sec">Weekly minimums</h3>
    <p class="about">${rich(g.minimumsNote)}</p>
    <div class="card"><table class="tbl">${g.minimums.map((m) => `<tr><td><b>${sessionName(m.session)}</b> ×${m.count}<br><span class="muted tiny">${esc(SESSION[m.session].length)} · ${esc(m.load.toLowerCase())}</span></td><td>${esc(m.serves)}</td></tr>`).join('')}</table></div>
    <h3 class="sec">Placement rules</h3>
    ${g.rules.map((r, i) => `<div class="card rule"><p><b>${i + 1}. ${rich(r.rule)}</b> ${rich(r.why)}</p><p class="meta">Evidence: ${rich(r.evidence)}</p></div>`).join('')}
    <h3 class="sec">Example weeks</h3>
    ${g.examples.map((ex, n) => `<div class="card">
      <div class="spread"><h2>${esc(ex.title)}</h2><button class="btn" type="button" data-use-example="${n}">Use for this week</button></div>
      <table class="tbl">${ex.days.map((d) => `<tr><td><b>${DAY_NAMES[d.day].slice(0, 3)}</b>${d.classes.length ? `<br><span class="muted tiny">${d.classes.map((c) => esc(CLASS[c].label)).join(', ')}</span>` : ''}</td>
        <td>${d.sessions.length ? d.sessions.map(sessionName).join(' + ') : '<span class="muted">None</span>'}<br><span class="muted tiny">${esc(d.why)}</span></td></tr>`).join('')}</table>
    </div>`).join('')}
    <h3 class="sec">Busy week</h3>
    <p class="about">${rich(g.busyWeek.intro)}</p>
    <ul class="steps">${g.busyWeek.items.map((l) => `<li>${rich(l)}</li>`).join('')}</ul>
    <h3 class="sec">Deload and progress log</h3>
    <p class="about"><b>Deload.</b> ${rich(g.deload)}</p>
    <p class="about"><b>Progress log.</b> ${rich(g.progressLog)}</p>
    <h3 class="sec">Stop rules</h3>
    <p class="about">${rich(g.stopIntro)}</p>
    <ul class="steps">${g.stopRules.map((r) => `<li><b>${esc(r.area)}.</b> ${rich(r.text)}</li>`).join('')}</ul>
    <h3 class="sec">Questions for a physio or coach</h3>
    <ul class="steps">${g.questions.map((l) => `<li>${rich(l)}</li>`).join('')}</ul>
    <p class="about muted">${rich(g.caveat)}</p>
    <h3 class="sec">References</h3>
    <p class="tiny muted">R = research (systematic review, meta-analysis, trial or cohort study). C = clinical, coaching or consensus source.</p>
    <ol class="refs">${g.references.map((r) => `<li value="${r.n}"><span class="chip">${r.kind}</span> ${esc(r.text)}. <a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.site)}</a></li>`).join('')}</ol>`;
}

/* ── history ─────────────────────────────────────────────────────────── */

function historyView() {
  const entries = Object.entries(log.entries).sort((a, b) => b[1].date.localeCompare(a[1].date) || b[1].updated - a[1].updated);
  let html = `<div class="spread" style="margin-bottom:12px">
      <span class="progress">${entries.filter(([, e]) => e.done).length} sessions done</span>
      <span class="row"><button id="backupBtn" class="btn" type="button">Download backup</button><button id="restoreBtn" class="btn" type="button">Restore backup</button></span>
    </div>`;
  if (!entries.length) return `${html}<p class="muted">Nothing logged yet. Open a session from the Week or Sessions tab and tick things off.</p>`;
  html += '<div class="hist">';
  for (const [key, e] of entries) {
    html += `<a href="#s/${encodeURIComponent(key)}"><div class="card">
      <div class="spread"><h2>${esc(e.title || 'Session')}</h2>${e.done ? '<span class="chip done">Done</span>' : '<span class="chip started">Started</span>'}</div>
      <p class="meta">${esc(fmtDay(fromYmd(e.date)))}${e.variant !== 'full' ? ` · ${esc(versionOf(SESSION[key.slice(11)] || {}, e.variant)?.label || 'short version')}` : ''} · ${e.checked.length} ticked</p>
      ${e.notes.trim() ? `<div class="notes">${esc(e.notes)}</div>` : ''}
    </div></a>`;
  }
  return `${html}</div>`;
}

// The backup holds the log and the planned weeks.
function downloadBackup() {
  download(JSON.stringify({ log, weeks }, null, 2), `flex-training-backup-${ymd(new Date())}.json`, 'application/json');
}

function download(text, name, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Restoring merges. For a session in both, whichever was edited last wins;
// a week planned here is kept over the backup's.
$('backupFile').addEventListener('change', async (ev) => {
  const file = ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  try {
    const raw = JSON.parse(await file.text());
    const incoming = normalizeLog(raw.log || raw);
    const incomingWeeks = normalizeWeeks(raw.weeks, SESSION_IDS);
    let n = 0;
    for (const [k, e] of Object.entries(incoming.entries)) {
      if (!log.entries[k] || log.entries[k].updated <= e.updated) { log.entries[k] = e; n++; }
    }
    for (const [k, w] of Object.entries(incomingWeeks.weeks)) if (!isPlanned(weeks.weeks[k])) weeks.weeks[k] = w;
    saveLog();
    saveWeeks();
    notify(`Restored ${n} session${n === 1 ? '' : 's'}.`);
    render();
  } catch { notify('That doesn’t look like a Flex Training backup.', true); }
});

/* ── guided player ───────────────────────────────────────────────────── */

// Full-screen, one movement at a time: a "Get ready" countdown, then the
// timer (split per side where the plan gives one). When it runs out the
// movement is ticked and the next one starts. Where you are is saved to
// the log entry (resume), so closing it or losing the page picks up there.
let play = null; // { o, items, index, phases, phase, left, running, endAt, tick, saved }

function openPlayer(key) {
  if (play && play.o.key === key) { paintPlayer(); return; }
  closePlayer();
  const o = parseKey(key);
  if (!o) return;
  try { audioCtx ||= new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch { /* silent */ }
  const e = entryFor(o);
  const items = checklist(o.session, e.variant);
  const checked = new Set(e.checked);
  const r = e.resume && e.resume.index < items.length ? e.resume : null;
  const index = r ? r.index : Math.max(0, nextToDo(items, checked, -1));
  play = { o, items, index, phases: playPhases(items[index].item), phase: 0, left: 0, running: false, endAt: 0, tick: null, saved: 0 };
  if (r) {
    play.phase = Math.min(r.phase, play.phases.length - 1);
    // A resumed "Get ready" starts over; a resumed hold keeps its time.
    play.left = play.phases[play.phase].ready ? play.phases[play.phase].seconds : r.left;
  } else {
    play.left = play.phases[0].seconds;
  }
  $('player').hidden = false;
  document.body.classList.add('playing');
  paintPlayer();
  if (!r) runPlayer(); // a fresh start counts straight in; a resume waits for you
  keepAwake(true);
}

function closePlayer() {
  if (!play) return;
  pausePlayer();
  savePlayer();
  play = null;
  $('player').hidden = true;
  document.body.classList.remove('playing');
  if (!timer.running) keepAwake(false);
}

const playLeft = () => (play.running ? Math.max(0, (play.endAt - Date.now()) / 1000) : play.left);

function savePlayer() {
  if (!play || play.done) return;
  play.saved = Date.now();
  updateEntry(play.o, { resume: { index: play.index, phase: play.phase, left: Math.round(playLeft()) } });
}

function runPlayer() {
  play.endAt = Date.now() + play.left * 1000;
  play.running = true;
  clearInterval(play.tick);
  play.tick = setInterval(tickPlayer, 200);
  tickPlayer();
}

function pausePlayer() {
  if (!play || !play.running) return;
  play.left = playLeft();
  play.running = false;
  clearInterval(play.tick);
}

function tickPlayer() {
  if (!play) return;
  const left = playLeft();
  $('playTime').textContent = fmtClock(left);
  $('playToggle').textContent = play.running ? 'Pause' : 'Resume';
  if (play.running && Date.now() - play.saved > 5000) savePlayer();
  if (play.running && left <= 0) {
    if (play.phase < play.phases.length - 1) {
      // Next step: "Get ready" → hold, or first side → second side.
      if (!play.phases[play.phase].ready) chime();
      play.phase++;
      play.left = play.phases[play.phase].seconds;
      // Start the new step's clock before repainting: the repaint reads it.
      runPlayer();
      paintPlayer();
    } else {
      chime();
      finishMovement(true);
    }
  }
}

// Ticks the current movement (when `tick`) and moves on to the next one
// not yet ticked, starting its countdown.
function finishMovement(tick) {
  pausePlayer();
  const { o, items } = play;
  const e = entryFor(o);
  const checked = new Set(e.checked);
  if (tick) checked.add(items[play.index].id);
  const next = nextToDo(items, checked, play.index);
  const all = items.every((i) => checked.has(i.id));
  if (next < 0 && all) {
    const { resume, ...rest } = e;
    log.entries[o.key] = { ...rest, checked: [...checked], done: true, updated: Date.now(), title: o.session.title, date: ymd(o.date) };
    saveLog();
    showFinished();
    return;
  }
  // Wrap round to anything skipped earlier.
  const to = next >= 0 ? next : nextToDo(items, checked, -1);
  updateEntry(o, { checked: [...checked] });
  goTo(to, true);
}

function goTo(index, autostart) {
  pausePlayer();
  play.index = index;
  play.phases = playPhases(play.items[index].item);
  play.phase = 0;
  play.left = play.phases[0].seconds;
  paintPlayer();
  savePlayer();
  if (autostart) runPlayer();
}

function showFinished() {
  const key = play.o.key;
  clearInterval(play.tick);
  $('playBody').innerHTML = `<div class="play-done">
    <p class="label">${esc(play.o.session.title)}</p>
    <h2 class="title">Session done ✓</h2>
    <p class="muted">Everything’s ticked off. Add a note about how it went?</p>
    <a class="btn primary" href="${sessionHref(play.o.date, play.o.session.id)}">Back to the session</a>
  </div>`;
  $('playTime').textContent = '';
  play.running = false;
  play.done = key;
}

function paintPlayer() {
  if (!play) return;
  const { o, items, index, phases, phase } = play;
  const { item, section, id } = items[index];
  const checked = new Set(entryFor(o).checked);
  const step = phases[phase];
  const mk = moveKey(item.name);
  const upNext = nextToDo(items, new Set([...checked, id]), index);
  $('playHead').textContent = `${o.session.title} · ${index + 1} of ${items.length}${section?.title ? ` · ${section.title}` : ''}`;
  $('playStep').textContent = step.ready ? 'Get ready' : step.label || (checked.has(id) ? 'Already ticked' : '');
  $('player').classList.toggle('ready', !!step.ready);
  $('playBody').innerHTML = `
    <h2 class="title">${esc(item.name)}</h2>
    <p class="mdur">${esc(item.duration)}</p>
    ${item.detail ? `<p class="mdetail">${rich(item.detail)}</p>` : ''}
    ${item.cues?.length ? cueList(item.cues) : ''}
    ${FORM[mk] ? `<h3 class="sec">How to do it</h3>${formHtml(FORM[mk], true)}` : ''}
    ${upNext >= 0 ? `<p class="up-next">Next: ${esc(items[upNext].item.name)}</p>` : ''}`;
  $('playBody').scrollTop = 0;
  $('playBack').disabled = index === 0;
  tickPlayer();
}

$('playToggle').addEventListener('click', () => {
  if (!play || play.done) return;
  if (play.running) { pausePlayer(); savePlayer(); } else runPlayer();
  tickPlayer();
});
$('playDone').addEventListener('click', () => { if (play && !play.done) finishMovement(true); });
$('playSkip').addEventListener('click', () => {
  if (!play || play.done) return;
  // Skipping the last one goes back round to anything skipped earlier.
  const checked = new Set(entryFor(play.o).checked);
  let next = nextToDo(play.items, checked, play.index);
  if (next < 0) next = nextToDo(play.items, checked, -1);
  if (next >= 0 && next !== play.index) goTo(next, true);
});
$('playBack').addEventListener('click', () => { if (play && !play.done && play.index > 0) goTo(play.index - 1, false); });
$('playClose').addEventListener('click', () => {
  const key = play?.o.key;
  location.hash = key ? `#s/${encodeURIComponent(key)}` : '#week';
});
// Save where you are if the page is hidden or closed mid-hold.
document.addEventListener('visibilitychange', () => { if (document.hidden && play && !play.done) savePlayer(); });
window.addEventListener('pagehide', () => { if (play && !play.done) savePlayer(); });

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
