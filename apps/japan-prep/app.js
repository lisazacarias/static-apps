import { ITEM, PHRASES, SIGNS, MENU, DECKS, DECK_ORDER, TOFUGU } from './content.js';
import { HINTS } from './kana.js';
import { genDrill, checkDrill, DRILL_MODES } from './numbers.js';
import { AGAIN, GOOD, EASY } from './srs.js';
import {
  normalizeState, nextCard, rate, summary, choices, gradeFor, streak, addDrill, mergeStates, exportBlob, looksLikeExport,
  splitCardId, ymd, daysBetween, teach, isTaught,
} from './session.js';
import { strokeUrl, drawable, parseStrokes, KANJIVG_CREDIT } from './strokes.js';
import { SCENES, SCENE, LEVELS, promptFor, sceneFor, claudeUrl } from './roleplay.js';
import { loadVoices, japaneseVoices, say, canSpeak, stopSpeaking } from './speech.js';

// localStorage is shared by every app on the Pages origin — keep the prefix.
// One key holds everything (see normalizeState in session.js).
const KEY = 'japan-prep:state';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

let noticeTimer;
let state = load();

function load() {
  try { return normalizeState(JSON.parse(localStorage.getItem(KEY))); } catch { return normalizeState(null); }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
  catch { notify('Couldn’t save — this browser’s storage is full or blocked. Download a backup from Settings.', true); return false; }
}
// First launch writes the start date, so unlock days count from today, and
// a record from an older plan is written back migrated (see PLAN in session.js).
// If storage is blocked outright the app still runs, from memory.
try {
  const stored = localStorage.getItem(KEY);
  if (!stored || JSON.parse(stored)?.settings?.plan !== state.settings.plan) save();
} catch { /* blocked or unreadable: run from memory */ }

function notify(msg, sticky = false) {
  const el = $('notice');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(noticeTimer);
  if (!sticky) noticeTimer = setTimeout(() => { el.hidden = true; }, 5000);
}

// Every play is a direct tap (or happens synchronously inside one).
function speak(text, rate = 1) {
  if (!canSpeak()) { notify('This browser has no Japanese voice. Try Safari or Chrome.'); return; }
  say(text, { rate, voiceURI: state.settings.voiceURI });
  if (isIOS && !state.settings.muteHintShown) {
    notify('🔇 No sound? Check the mute switch on the side of your phone.');
    state = { ...state, settings: { ...state.settings, muteHintShown: true } };
    save();
  }
}

const playButtons = (text, big = false) => `
  <span class="play-row">
    <button class="btn play${big ? ' big' : ''}" type="button" data-say="${esc(text)}" aria-label="Play">🔊 Hear it</button>
    <button class="btn play slow" type="button" data-say="${esc(text)}" data-rate="0.75" aria-label="Play slowly">0.75×</button>
  </span>`;

// Shared click handling for any [data-say] button.
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-say]');
  if (b) speak(b.dataset.say, Number(b.dataset.rate) || 1);
});

/* ── routing ─────────────────────────────────────────────────────────── */

const VIEWS = { today: renderToday, study: renderStudy, drill: renderDrill, roleplay: renderRoleplay, phrases: renderPhrases, settings: renderSettings };

function route() {
  const [name, arg] = (location.hash.slice(1) || 'today').split('/');
  const view = VIEWS[name] ? name : 'today';
  for (const a of document.querySelectorAll('.tabs a')) a.classList.toggle('on', a.dataset.tab === (view === 'study' ? 'today' : view));
  stopSpeaking();
  teardown?.();
  teardown = null;
  VIEWS[view](arg);
}
let teardown = null;
addEventListener('hashchange', route);

/* ── today ───────────────────────────────────────────────────────────── */

const fmtDate = (s) => new Date(`${s}T12:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

// Today's roleplay from the week plan, if it's a roleplay day and the
// trip hasn't started.
function todaysScene(sum, now) {
  if (sum.daysLeft < 0) return '';
  const pick = sceneFor({ week: sum.week, weekday: new Date(now).getDay(), daysLeft: sum.daysLeft });
  if (!pick) return '';
  const sc = SCENE[pick.scene];
  return `<a class="card roleplay-today" href="#roleplay/${pick.scene}-${pick.level}">
      <span class="label">Roleplay day</span>
      <strong>${sc.emoji} ${esc(sc.name)} · ${esc(LEVELS[pick.level].name)}</strong>
      <span class="tiny">About 10 minutes in the Claude app, after your cards →</span></a>`;
}

function renderToday() {
  const now = Date.now();
  const sum = summary(state, now);
  const due = DECK_ORDER.reduce((n, d) => n + sum.decks[d].due, 0);
  const fresh = DECK_ORDER.reduce((n, d) => n + sum.decks[d].fresh, 0);
  const tomorrow = DECK_ORDER.reduce((n, d) => n + sum.decks[d].tomorrow, 0);
  const left = sum.daysLeft;
  const days = state.settings.backupAt ? daysBetween(state.settings.backupAt, now) : null;
  const backupLine = state.logs.length === 0 ? ''
    : days === null ? '<strong>No backup yet.</strong> '
      : days > 7 ? `<strong>Last backup ${days} days ago.</strong> ` : `Last backup ${days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} ago`}. `;

  $('view').innerHTML = `
    ${isIOS && !standalone() ? `<div class="banner">On iPhone, <strong>Share → Add to Home Screen</strong> first, then study from the icon. Safari can wipe a website’s saved progress after a week without a visit; the Home Screen app keeps its own.</div>` : ''}
    <section class="hero">
      <div class="stat"><span class="num">${left >= 0 ? left : '🇯🇵'}</span><span class="label">${left >= 0 ? `day${left === 1 ? '' : 's'} to go` : 'trip under way'}</span></div>
      <div class="stat"><span class="num">${streak(state, now)}</span><span class="label">day streak</span></div>
      <div class="stat"><span class="num">${sum.week}</span><span class="label">week</span></div>
    </section>
    ${sum.sweep ? `<p class="sweep">Pre-trip sweep: no new cards. You’ll see anything you might not recall right now.</p>` : ''}
    <button id="start" class="btn primary start" type="button">Start today <span class="muted-on-primary">(≈25 min)</span></button>
    <p class="tiny center">${due} due · ${fresh} new · then 3 minutes of numbers · ${tomorrow} due tomorrow</p>
    ${todaysScene(sum, now)}
    ${sum.stage === 'final' ? `<div class="card checklist">
      <h2>Before you fly</h2>
      <ul>
        <li>Open the app once in airplane mode: cards, drills, audio and the phrasebook should all still work.</li>
        <li>Make sure it’s on your Home Screen, and study from that icon.</li>
        <li><a href="#settings">Download a backup</a>.</li>
        <li>Check opening hours for your specific dates.</li>
      </ul>
    </div>` : ''}

    <div class="card">
      <h2>Decks</h2>
      <table class="decks">
        <thead><tr><th></th><th>Due</th><th>New</th><th>Started</th></tr></thead>
        <tbody>${DECK_ORDER.map((d) => {
          const o = sum.decks[d];
          return `<tr><th>${esc(DECKS[d].name)}</th><td>${o.due}</td><td>${o.fresh}</td><td>${o.learned}/${o.total}</td></tr>`;
        }).join('')}</tbody>
      </table>
      <p class="tiny">Trip ${esc(fmtDate(state.settings.tripDate))}. Nothing is scheduled more than ${sum.maxDays} day${sum.maxDays === 1 ? '' : 's'} out, so every card comes back before you fly.</p>
    </div>

    <div class="card">
      <h2>Starting from zero?</h2>
      <p>That’s fine. Each new character or phrase is shown to you first, with its sound, five at a time. Then you’re quizzed on them. Nothing to know in advance.</p>
      <p>For memory tricks, Tofugu’s guides are worth a read:
        <a href="${TOFUGU.hira}" target="_blank" rel="noopener">hiragana</a> ·
        <a href="${TOFUGU.kata}" target="_blank" rel="noopener">katakana</a>.</p>
    </div>
    <p class="tiny">${backupLine}Progress lives only in this browser. <a href="#settings">Download a backup</a>.</p>`;
  $('start').onclick = () => { location.hash = 'study/daily'; };
}

/* ── study ───────────────────────────────────────────────────────────── */

// The sitting in progress: which cards have been shown (sweep mode shows
// each once), and whether this is the daily run that goes on to drills.
let sitting = null;

function renderStudy(arg) {
  sitting = { daily: arg === 'daily', seen: new Set(), done: 0 };
  showNext();
}

function showNext() {
  // Drop the last card's swipe listener or advance timer, so it can't fire on this one.
  teardown?.();
  teardown = null;
  const id = nextCard(state, Date.now(), sitting.seen);
  if (!id) return finishCards();
  const { itemId, dir } = splitCardId(id);
  if (!isTaught(state, itemId)) return renderTeach(ITEM[itemId]);
  renderCard(id, ITEM[itemId], dir);
}

// First sight of a new item: show it with its sound before any quiz.
// Not a review: nothing is graded, the quiz comes after a small batch.
function renderTeach(item) {
  const kana = item.deck === 'hira' || item.deck === 'kata';
  // How it's drawn: single kana, kana combos (きゃ, ティ) and sign kanji.
  const drawn = (kana && !item.word) || item.deck === 'sign' ? drawable(item.jp) : [];
  const glyph = kana || item.deck === 'num'
    ? `<div class="big-kana">${esc(item.jp)}</div>`
    : item.deck === 'sign' ? `<div class="sign">${esc(item.jp)}</div>` : '';
  const big = drawn.length ? `
    <div class="glyph-row">${glyph}
      <figure class="strokes">
        <div id="strokes" class="stroke-box" aria-label="Stroke order for ${esc(item.jp)}" role="img"></div>
        <figcaption><button id="replay" class="btn small" type="button">↻ Replay strokes</button>
          <span class="tiny">Handwritten form, so it won’t exactly match the print.</span>
          <a class="tiny credit" href="${KANJIVG_CREDIT.url}" target="_blank" rel="noopener">${esc(KANJIVG_CREDIT.text)}</a></figcaption>
      </figure>
    </div>` : glyph;
  const body = kana
    ? `<div class="reading"><div class="romaji teach-romaji">${esc(item.romaji)}</div>${item.word ? `<div class="en">${esc(item.en)}</div>` : ''}</div>
       ${HINTS[item.jp] ? `<p class="hint">${esc(HINTS[item.jp])}</p>` : ''}`
    : `${item.deck === 'phrase' ? `<div class="en-prompt">${esc(item.en)}</div>` : ''}
       ${reading(item, { en: item.deck !== 'phrase', jp: item.deck === 'phrase' || item.deck === 'menu' })}`;
  $('view').innerHTML = `
    <div class="study">
      <div class="card-head"><span class="badge new">New · ${esc(DECKS[item.deck].name)}</span><span class="tiny">Learn this one</span><span class="tiny">${sitting.done} done</span></div>
      <div class="prompt">${big}${body}</div>
      ${playButtons(item.speak)}
      ${item.listen ? '<p class="tiny center">Staff say this; you only need to understand it.</p>' : ''}
      <button id="gotIt" class="btn primary next" type="button">Got it →</button>
      <p class="tiny center">You’ll be quizzed on it after a few more.</p>
    </div>`;
  speak(item.speak);
  if (drawn.length) {
    // Hold on to this screen's elements: by the time the fetch finishes you
    // may have moved on, and $('replay') would be the next screen's button.
    const box = $('strokes'), replayBtn = $('replay');
    drawStrokes(box, drawn).then((replay) => {
      if (!box.isConnected) return;
      if (replay) replayBtn.onclick = replay; else replayBtn.hidden = true;
    });
  }
  $('gotIt').onclick = () => {
    state = teach(state, item.id, Date.now());
    save();
    showNext();
  };
}

function finishCards() {
  if (sitting?.daily) { location.hash = 'drill/daily'; return; }
  $('view').innerHTML = `
    <div class="card done">
      <h2>All caught up</h2>
      <p>${sitting?.done ? `${sitting.done} cards this sitting. ` : ''}Nothing else is due right now.</p>
      <a class="btn primary" href="#drill">Number drills →</a>
      <a class="btn" href="#today">Back to today</a>
    </div>`;
}

const showRomaji = () => state.settings.showRomaji;
const showEnglish = () => state.settings.showEnglish;
const needsSound = (dir) => dir === 'listen';

function header(item, dir) {
  const what = { recognize: item.deck === 'sign' || item.deck === 'menu' ? 'What does it mean?' : 'How is it read?', listen: item.deck === 'phrase' ? 'What did they say?' : 'Which one did you hear?', produce: 'Say it out loud' }[dir];
  return `<div class="card-head"><span class="badge">${esc(DECKS[item.deck].name)}</span><span class="tiny">${esc(what)}</span><span class="tiny">${sitting.done} done</span></div>`;
}

function reading(item, { en = showEnglish(), jp = true } = {}) {
  return `
    <div class="reading">
      ${jp ? `<div class="jp">${esc(item.jp)}</div>` : ''}
      ${item.kana !== item.jp || !jp ? `<div class="kana-line">${esc(item.kana)}</div>` : ''}
      ${showRomaji() ? `<div class="romaji">${esc(item.romaji)}</div>` : ''}
      ${en ? `<div class="en">${esc(item.en)}</div>` : ''}
      ${item.notes ? `<p class="note">${esc(item.notes)}</p>` : ''}
    </div>`;
}

function renderCard(id, item, dir) {
  sitting.seen.add(id);
  const shownAt = performance.now();
  const view = $('view');
  const quiz = dir !== 'produce' && !(item.deck === 'phrase' && dir === 'listen');

  if (quiz) {
    const opts = choices(item, dir);
    const prompt = dir === 'listen'
      ? `<div class="prompt">${playButtons(item.speak, true)}</div>`
      : `<div class="prompt"><div class="${item.deck === 'sign' ? 'sign' : 'big-kana'}">${esc(item.jp)}</div></div>`;
    const kanaOpts = dir === 'listen';
    view.innerHTML = `
      <div class="study">
        ${header(item, dir)}
        ${prompt}
        <div class="options${kanaOpts ? ' kana-options' : ''}">
          ${opts.map((o, i) => `<button class="btn option" type="button" data-i="${i}">${esc(o.label)}</button>`).join('')}
        </div>
        <div id="after"></div>
      </div>`;
    if (dir === 'listen') speak(item.speak);
    view.querySelectorAll('.option').forEach((b) => b.addEventListener('click', () => {
      const ms = performance.now() - shownAt;
      const pick = opts[Number(b.dataset.i)];
      view.querySelectorAll('.option').forEach((x, i) => {
        x.disabled = true;
        if (opts[i].correct) x.classList.add('right');
        else if (x === b) x.classList.add('wrong');
      });
      answer(id, gradeFor(pick.correct, ms), ms);
      const hint = !pick.correct && HINTS[item.jp];
      const nextId = nextCard(state, Date.now(), sitting.seen);
      const waitForTap = !pick.correct || (nextId && needsSound(splitCardId(nextId).dir));
      $('after').innerHTML = `
        ${item.deck === 'hira' || item.deck === 'kata'
          ? `<p class="feedback">${esc(item.jp)} = <strong>${esc(item.romaji)}</strong>${item.word ? ` · ${esc(item.en)}` : ''} ${dir === 'recognize' ? playButtons(item.speak) : ''}</p>`
          : reading(item, { en: true }) + playButtons(item.speak)}
        ${hint ? `<p class="hint">${esc(hint)}</p>` : ''}
        ${!pick.correct && (item.deck === 'hira' || item.deck === 'kata') ? `<p class="tiny">Mnemonics: <a href="${TOFUGU[item.deck]}" target="_blank" rel="noopener">Tofugu’s ${item.deck === 'hira' ? 'hiragana' : 'katakana'} guide</a></p>` : ''}
        ${waitForTap ? '<button id="next" class="btn primary next" type="button">Next →</button>' : ''}`;
      if (waitForTap) $('next').onclick = showNext;
      else { const t = setTimeout(showNext, 700); teardown = () => clearTimeout(t); }
    }));
    return;
  }

  // Self-graded: say it (produce) or understand it (listen), then reveal.
  const prompt = dir === 'listen'
    ? `<div class="prompt">${playButtons(item.speak, true)}</div>`
    : item.deck === 'num'
      ? `<div class="prompt"><div class="big-kana">${esc(item.jp)}</div><p class="tiny">${esc(item.en)}</p></div>`
      : `<div class="prompt"><div class="en-prompt">${esc(item.en)}</div></div>`;
  view.innerHTML = `
    <div class="study">
      ${header(item, dir)}
      ${prompt}
      <div id="after"><button id="reveal" class="btn primary next" type="button">${dir === 'listen' ? 'Show meaning' : 'Show answer'}</button></div>
    </div>`;
  if (dir === 'listen') speak(item.speak);
  $('reveal').onclick = () => {
    $('after').innerHTML = `
      ${item.deck === 'num' ? reading(item, { en: false, jp: false }) : reading(item, { en: dir === 'listen' })}
      ${playButtons(item.speak)}
      <div class="grades">
        <button class="btn again" type="button" data-r="${AGAIN}">Again</button>
        <button class="btn good primary" type="button" data-r="${GOOD}">Good</button>
        <button class="btn easy" type="button" data-r="${EASY}">Easy</button>
      </div>
      <p class="tiny center">Swipe right for Good, left for Again.</p>`;
    if (dir === 'produce') speak(item.speak);
    const grade = (r) => { answer(id, r, performance.now() - shownAt); showNext(); };
    $('after').querySelectorAll('[data-r]').forEach((b) => { b.onclick = () => grade(Number(b.dataset.r)); });
    teardown = swipe(view, (right) => grade(right ? GOOD : AGAIN));
  };
}

// Draw characters stroke by stroke into el. → a replay function, or null
// if nothing could be drawn (offline before the first visit, say).
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
async function drawStrokes(el, chars) {
  const NS = 'http://www.w3.org/2000/svg';
  const make = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
  const parsed = await Promise.all(chars.map((c) => fetch(strokeUrl(c)).then((r) => (r.ok ? r.text() : '')).then(parseStrokes).catch(() => ({ strokes: [], labels: [] }))));
  if (!el.isConnected) return null;
  el.classList.toggle('many', chars.length > 2);
  const ink = [];
  let missing = 0;
  parsed.forEach(({ strokes, labels }, i) => {
    const svg = make('svg', { viewBox: '0 0 109 109', class: 'stroke-svg', 'aria-hidden': 'true' });
    if (!strokes.length) {
      // Keep the character's slot so a half-loaded word doesn't look complete.
      missing++;
      const t = make('text', { x: 54.5, y: 74, class: 'stroke-missing', 'text-anchor': 'middle' });
      t.textContent = chars[i];
      svg.append(t);
      el.append(svg);
      return;
    }
    for (const st of strokes) svg.append(make('path', { d: st.d, class: 'ghost' }));
    const paths = strokes.map((st) => make('path', { d: st.d, class: 'ink' }));
    svg.append(...paths);
    for (const l of labels) { const t = make('text', { x: l.x, y: l.y, class: 'stroke-num' }); t.textContent = l.n; svg.append(t); }
    el.append(svg);
    ink.push(...paths);
  });
  if (missing) {
    const note = document.createElement('p');
    note.className = 'tiny stroke-note';
    note.textContent = ink.length ? 'The faded ones load the first time you’re online.' : 'Stroke order loads the first time you’re online.';
    el.append(note);
  }
  if (!ink.length) return null;
  // One stroke after another, across every character, at a steady pen speed.
  const play = () => {
    let delay = 0;
    for (const p of ink) {
      const len = p.getTotalLength();
      p.style.strokeDasharray = `${len}`;
      p.getAnimations().forEach((a) => a.cancel());
      if (reducedMotion()) { p.style.strokeDashoffset = '0'; continue; }
      const duration = 250 + len * 9;
      p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration, delay, fill: 'both', easing: 'ease-in-out' });
      delay += duration + 150;
    }
  };
  play();
  return play;
}

function answer(id, rating, ms) {
  state = rate(state, id, rating, { now: Date.now(), ms: Math.round(ms) });
  sitting.done++;
  save();
}

// Horizontal swipe on an element: → onSwipe(true) for right, false for left.
function swipe(el, onSwipe) {
  let x0 = null, y0 = null;
  const start = (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; };
  const end = (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 80 && Math.abs(dx) > 2 * Math.abs(dy)) { stopListening(); onSwipe(dx > 0); }
  };
  const stopListening = () => { el.removeEventListener('touchstart', start); el.removeEventListener('touchend', end); };
  el.addEventListener('touchstart', start, { passive: true });
  el.addEventListener('touchend', end);
  return stopListening;
}

/* ── number drills ───────────────────────────────────────────────────── */

const DRILL_LABEL = { price: 'Prices', time: 'Times', counter: 'Counters', platform: 'Platforms', mix: 'Mix', speed: '⏱ Prices & times' };
const DAILY_DRILL_MS = 3 * 60000;
// Speed mode: prices and times only, heard and typed, against the clock.
// From week 7 (35 days out) the daily three minutes use it.
const SPEED_MS = 10000;
const SPEED_STAGES = ['polish', 'consolidate', 'final'];
let drillPrefs = { mode: 'mix', how: 'listen' };
try { drillPrefs = { ...drillPrefs, ...JSON.parse(localStorage.getItem('japan-prep:drill-prefs')) }; } catch { /* defaults */ }

function renderDrill(arg) {
  const daily = arg === 'daily';
  const endsAt = daily ? Date.now() + DAILY_DRILL_MS : 0;
  // From week 7 the daily drill is speed mode, without changing your saved choice.
  const forceSpeed = daily && SPEED_STAGES.includes(summary(state, Date.now()).stage);
  const prefs = forceSpeed ? { ...drillPrefs, mode: 'speed', how: 'listen' } : drillPrefs;
  let run = 0, right = 0, best = 0;
  let current = null, shownAt = 0;
  let tick = null, qTick = null;

  $('view').innerHTML = `
    <div class="drill">
      ${daily ? `<p class="tiny center">Cards done. Three minutes of numbers to finish${forceSpeed ? ': prices and times, 10 seconds each' : ''}.</p>` : ''}
      <div class="chips" id="modes">${['mix', 'speed', ...DRILL_MODES].map((m) => `<button class="chip" type="button" data-mode="${m}">${DRILL_LABEL[m]}</button>`).join('')}</div>
      <div class="chips" id="hows">
        <button class="chip" type="button" data-how="listen">Listen &amp; type</button>
        <button class="chip" type="button" data-how="read">Read aloud</button>
      </div>
      <div class="drill-stats tiny"><span id="dStreak"></span><span id="dClock"></span></div>
      <div id="dCard" class="card drill-card"></div>
    </div>`;

  const setChips = () => {
    document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === prefs.mode));
    document.querySelectorAll('[data-how]').forEach((b) => b.classList.toggle('on', b.dataset.how === prefs.how));
  };
  const savePrefs = () => { if (prefs !== drillPrefs) return; try { localStorage.setItem('japan-prep:drill-prefs', JSON.stringify(drillPrefs)); } catch { /* fine */ } };
  document.querySelectorAll('[data-mode]').forEach((b) => b.onclick = () => { prefs.mode = b.dataset.mode; if (prefs.mode === 'speed') prefs.how = 'listen'; savePrefs(); setChips(); ask(); });
  document.querySelectorAll('[data-how]').forEach((b) => b.onclick = () => { prefs.how = b.dataset.how; if (prefs.how === 'read' && prefs.mode === 'speed') prefs.mode = 'mix'; savePrefs(); setChips(); ask(); });
  setChips();

  const stats = () => { $('dStreak').textContent = `Streak ${run} · best ${best} · ${right} right`; };
  if (daily) {
    tick = setInterval(() => {
      const left = Math.max(0, endsAt - Date.now());
      $('dClock').textContent = left ? `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')} left` : 'Time’s up — finish this one';
    }, 500);
  }
  teardown = () => { clearInterval(tick); clearInterval(qTick); };

  function log(given, ok) {
    state = addDrill(state, { m: current.mode, p: current.prompt, a: current.answer, g: given, ok, ms: Math.round(performance.now() - shownAt), t: Date.now() });
    save();
    run = ok ? run + 1 : 0; right += ok ? 1 : 0; best = Math.max(best, run);
    stats();
  }

  function after(ok, given) {
    const timeUp = daily && Date.now() >= endsAt;
    $('dAfter').innerHTML = `
      <p class="feedback ${ok ? 'ok' : 'miss'}">${ok ? '✓' : `✗ ${given === null ? 'out of time' : given ? `you typed ${esc(given)}` : ''}`} <strong>${esc(current.prompt)}</strong></p>
      <div class="reading"><div class="kana-line">${esc(current.kana)}</div>${showRomaji() ? `<div class="romaji">${esc(current.romaji)}</div>` : ''}${current.hint ? `<div class="tiny">${esc(current.hint)}</div>` : ''}</div>
      ${playButtons(current.kana)}
      <button id="dNext" class="btn primary next" type="button">${timeUp ? 'Finish' : 'Next →'}</button>`;
    $('dNext').onclick = () => (timeUp ? finishDaily() : ask(true));
    $('dNext').focus();
  }

  function finishDaily() {
    clearInterval(tick);
    clearInterval(qTick);
    $('view').innerHTML = `
      <div class="card done">
        <h2>Done for today 🎌</h2>
        <p>${right} number${right === 1 ? '' : 's'} right, best run ${best}. See you tomorrow.</p>
        <a class="btn primary" href="#today">Back to today</a>
      </div>`;
  }

  // fromTap: called from a button, so speech is allowed to start.
  function ask(fromTap = true) {
    clearInterval(qTick);
    const speedy = prefs.mode === 'speed';
    const pool = speedy ? ['price', 'time'] : DRILL_MODES;
    const mode = prefs.mode === 'mix' || speedy ? pool[Math.floor(Math.random() * pool.length)] : prefs.mode;
    current = genDrill(mode);
    shownAt = performance.now();
    const card = $('dCard');
    if (prefs.how === 'listen') {
      const isTime = mode === 'time';
      card.innerHTML = `
        <p class="tiny">${{ price: 'How much?', time: 'What time? (3:45 pm or 15:45)', counter: 'How many?', platform: 'Which platform?' }[mode]}</p>
        <div class="prompt">${playButtons(current.kana, true)}</div>
        <form id="dForm" class="answer-row" autocomplete="off">
          <input id="dInput" class="answer" ${isTime ? 'inputmode="text" placeholder="3:45 pm"' : 'inputmode="numeric" placeholder="digits"'} aria-label="Your answer" enterkeyhint="done">
          <button class="btn primary" type="submit">Check</button>
        </form>
        <button id="dGive" class="btn small" type="button">Show me</button>${speedy ? ' <span id="dTimer" class="tiny q-timer"></span>' : ''}
        <div id="dAfter"></div>`;
      if (fromTap) speak(current.kana);
      let answered = false; // one log per question, however it's submitted
      const lock = () => { answered = true; clearInterval(qTick); $('dInput').disabled = true; $('dForm').querySelector('button').disabled = true; $('dGive').hidden = true; };
      if (speedy) {
        const tickQ = () => {
          const left = SPEED_MS - (performance.now() - shownAt);
          if (left > 0) { $('dTimer').textContent = `⏱ ${Math.ceil(left / 1000)} s`; return; }
          if (answered) return;
          lock(); $('dTimer').textContent = ''; log('', false); after(false, null);
        };
        tickQ();
        qTick = setInterval(tickQ, 250);
      }
      $('dForm').onsubmit = (e) => {
        e.preventDefault();
        const given = $('dInput').value.trim();
        if (!given || answered) return;
        lock();
        const ok = checkDrill(current, given);
        log(given, ok); after(ok, given);
      };
      $('dGive').onclick = () => { if (answered) return; lock(); log('', false); after(false, ''); };
    } else {
      card.innerHTML = `
        <p class="tiny">Say it out loud, then check.</p>
        <div class="prompt"><div class="big-kana">${esc(current.prompt)}</div>${current.hint ? `<p class="tiny">${esc(current.hint)}</p>` : ''}</div>
        <div id="dAfter"><button id="dShow" class="btn primary next" type="button">Show reading</button></div>`;
      $('dShow').onclick = () => {
        speak(current.kana);
        $('dAfter').innerHTML = `
          <div class="reading"><div class="kana-line">${esc(current.kana)}</div>${showRomaji() ? `<div class="romaji">${esc(current.romaji)}</div>` : ''}</div>
          ${playButtons(current.kana)}
          <div class="grades two">
            <button class="btn again" type="button" data-ok="0">Missed it</button>
            <button class="btn good primary" type="button" data-ok="1">Got it</button>
          </div>`;
        $('dAfter').querySelectorAll('[data-ok]').forEach((b) => b.onclick = () => {
          const ok = b.dataset.ok === '1';
          log(ok ? 'said' : 'missed', ok);
          if (daily && Date.now() >= endsAt) finishDaily(); else ask(true);
        });
      };
    }
    if (prefs.how === 'listen') $('dInput').focus({ preventScroll: true });
  }

  stats();
  ask(true);
}

/* ── roleplay ────────────────────────────────────────────────────────── */

let roleplayLevel = 1;

// arg "ramen-2": open with that scene highlighted at that level.
function renderRoleplay(arg) {
  const [focus, lv] = (arg || '').split('-');
  if (LEVELS[lv]) roleplayLevel = Number(lv);
  $('view').innerHTML = `
    <p class="tiny">Practise a real conversation with Claude. Pick a level, then <strong>Copy prompt</strong> and paste it into a new chat, or use <strong>Open in Claude</strong>. Claude plays the staff and goes through what you could say better at the end. Needs a connection.</p>
    <div class="chips" id="levels">${Object.entries(LEVELS).map(([n, l]) => `<button class="chip${Number(n) === roleplayLevel ? ' on' : ''}" type="button" data-level="${n}" aria-pressed="${Number(n) === roleplayLevel}">${esc(l.name)}</button>`).join('')}</div>
    <div id="scenes"></div>`;
  const draw = () => {
    $('scenes').innerHTML = SCENES.map((sc) => `
      <div class="card scene${sc.id === focus ? ' focus' : ''}" id="scene-${sc.id}">
        <h2>${sc.emoji} ${esc(sc.name)}</h2>
        <p class="tiny">Your goal: ${esc(sc.goal)}.</p>
        <div class="row">
          <button class="btn primary" type="button" data-copy="${sc.id}">Copy prompt</button>
          <a class="btn" href="${esc(claudeUrl(promptFor(sc.id, roleplayLevel, state.settings.tripDate)))}" target="_blank" rel="noopener">Open in Claude ↗</a>
        </div>
        <details><summary class="tiny">See the prompt</summary><pre class="prompt-text">${esc(promptFor(sc.id, roleplayLevel, state.settings.tripDate))}</pre></details>
      </div>`).join('');
    $('scenes').querySelectorAll('[data-copy]').forEach((b) => b.onclick = () => copyText(promptFor(b.dataset.copy, roleplayLevel, state.settings.tripDate), b));
  };
  $('levels').querySelectorAll('[data-level]').forEach((b) => b.onclick = () => {
    roleplayLevel = Number(b.dataset.level);
    $('levels').querySelectorAll('.chip').forEach((c) => { c.classList.toggle('on', c === b); c.setAttribute('aria-pressed', String(c === b)); });
    draw();
  });
  draw();
  if (focus) $(`scene-${focus}`)?.scrollIntoView({ block: 'center' });
}

// Clipboard, with the old select-and-copy fallback for browsers that refuse.
async function copyText(text, button) {
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.append(ta); ta.select();
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
  }
  // Keep the real label and one reset timer per button, so tapping again
  // mid-feedback doesn't leave it stuck on "Copied ✓".
  button.dataset.label ||= button.textContent;
  button.textContent = ok ? 'Copied ✓' : 'Copy failed — open “See the prompt”';
  clearTimeout(Number(button.dataset.timer));
  button.dataset.timer = String(setTimeout(() => { button.textContent = button.dataset.label; }, 2500));
}

/* ── phrasebook ──────────────────────────────────────────────────────── */

const TAGS = ['core', 'restaurant', 'konbini', 'shopping', 'trains', 'hotel', 'directions', 'allergy', 'emergency'];
let phraseTag = 'core';
let phraseQuery = '';

function renderPhrases() {
  const all = [
    ...PHRASES,
    ...SIGNS.map((s) => ({ ...s, tags: ['signs'] })),
    ...MENU.map((m) => ({ ...m, tags: ['katakana'] })),
  ];
  $('view').innerHTML = `
    <p class="tiny">Everything in the app, for looking things up on the spot. Works offline.</p>
    <input id="pq" class="search" type="search" placeholder="Search English, kana or romaji" value="${esc(phraseQuery)}" aria-label="Search">
    <div class="chips" id="ptags">${[...TAGS, 'signs', 'katakana'].map((t) => `<button class="chip${t === phraseTag ? ' on' : ''}" type="button" data-tag="${t}">${t.replace('-', ' ')}</button>`).join('')}</div>
    <div id="plist"></div>`;
  const draw = () => {
    const q = phraseQuery.trim().toLowerCase();
    const rows = all.filter((p) => (q ? [p.en, p.jp, p.kana, p.romaji, p.notes].some((f) => f && f.toLowerCase().includes(q)) : p.tags.includes(phraseTag)));
    $('plist').innerHTML = rows.length ? rows.map((p) => `
      <div class="phrase">
        <div class="phrase-text">
          <div class="jp">${p.deck === 'sign' ? `<span class="sign small">${esc(p.jp)}</span>` : esc(p.jp)}${p.listen ? ' <span class="badge">you’ll hear</span>' : ''}</div>
          ${p.kana !== p.jp ? `<div class="kana-line">${esc(p.kana)}</div>` : ''}
          ${showRomaji() ? `<div class="romaji">${esc(p.romaji)}</div>` : ''}
          ${showEnglish() ? `<div class="en">${esc(p.en)}</div>` : ''}
          ${p.notes ? `<div class="note">${esc(p.notes)}</div>` : ''}
        </div>
        ${playButtons(p.speak)}
      </div>`).join('') : '<p class="tiny">Nothing matches.</p>';
  };
  $('pq').oninput = (e) => { phraseQuery = e.target.value; draw(); };
  $('ptags').querySelectorAll('[data-tag]').forEach((b) => b.onclick = () => {
    phraseTag = b.dataset.tag; phraseQuery = ''; $('pq').value = '';
    $('ptags').querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === b));
    draw();
  });
  draw();
}

/* ── settings ────────────────────────────────────────────────────────── */

function renderSettings() {
  const s = state.settings;
  const voices = japaneseVoices();
  $('view').innerHTML = `
    <form id="sForm" class="card settings">
      <h2>Trip</h2>
      <label>Trip date <input type="date" name="tripDate" value="${esc(s.tripDate)}" required></label>
      <label>Start date <input type="date" name="startDate" value="${esc(s.startDate)}" required>
        <span class="tiny">Decks unlock by days since this: katakana on day 6, katakana words in week 3, signs in week 4. The last five weeks count back from the trip date: no new phrases in the last three, and the sweep in the last five days.</span></label>
      <label class="check"><input type="checkbox" name="unlockAll" ${s.unlockAll ? 'checked' : ''}> Unlock every deck now</label>
      <label class="check"><input type="checkbox" name="sweep" ${s.sweep ? 'checked' : ''}> Pre-trip sweep now <span class="tiny">(turns on by itself 5 days out)</span></label>

      <h2>Showing</h2>
      <label class="check"><input type="checkbox" name="showRomaji" ${s.showRomaji ? 'checked' : ''}> Romaji</label>
      <label class="check"><input type="checkbox" name="showEnglish" ${s.showEnglish ? 'checked' : ''}> English in answers and the phrasebook</label>
      <label>Voice
        <select name="voiceURI">${voices.length ? voices.map((v) => `<option value="${esc(v.voiceURI)}" ${v.voiceURI === s.voiceURI ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('') : '<option value="">No Japanese voice found</option>'}</select>
        <button class="btn small" type="button" data-say="すみません、トイレわどこですか">Test</button>
      </label>

      <h2>Pace</h2>
      <div class="grid2">${DECK_ORDER.map((d) => `<label>${esc(DECKS[d].name)} new/day <input type="number" min="0" max="50" name="new-${d}" value="${s.newPerDay[d]}"></label>`).join('')}</div>
      <label>Target recall, kana &amp; numbers <input type="number" step="0.01" min="0.7" max="0.99" name="retCore" value="${s.retention.core}"></label>
      <label>Target recall, everything else <input type="number" step="0.01" min="0.7" max="0.99" name="retRest" value="${s.retention.rest}"></label>
      <p class="tiny">Higher means more reviews and fewer surprises. 0.90 suits most people.</p>
      <button class="btn primary" type="submit">Save settings</button>
    </form>

    <div class="card">
      <h2>Backup</h2>
      <p class="tiny">Your progress lives only in this browser. A backup is a JSON file; importing one merges it in (newer cards win, history is combined), so it also moves progress between phone and laptop.</p>
      <button id="export" class="btn primary" type="button">Download backup</button>
      <button id="importBtn" class="btn" type="button">Import a backup</button>
      <input id="import" type="file" accept="application/json,.json" hidden>
    </div>
    <p class="tiny">Not here yet: cloud sync and Claude roleplay scenes. Both need a small server; see the README.</p>`;

  $('sForm').onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const newPerDay = Object.fromEntries(DECK_ORDER.map((d) => [d, Number(f.get(`new-${d}`))]));
    state = normalizeState({
      ...state,
      settings: {
        // Current settings, not the snapshot from render: a backup or import may have changed them since.
        ...state.settings, tripDate: f.get('tripDate'), startDate: f.get('startDate'), unlockAll: f.has('unlockAll'), sweep: f.has('sweep'),
        showRomaji: f.has('showRomaji'), showEnglish: f.has('showEnglish'), voiceURI: f.get('voiceURI') || '',
        newPerDay, retention: { core: Number(f.get('retCore')), rest: Number(f.get('retRest')) },
      },
    });
    if (save()) notify('Saved.');
    renderSettings();
  };
  $('export').onclick = () => {
    const blob = new Blob([JSON.stringify(exportBlob(state), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `japan-prep-${ymd(new Date())}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    state = { ...state, settings: { ...state.settings, backupAt: Date.now() } };
    save();
  };
  $('importBtn').onclick = () => $('import').click();
  $('import').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      if (!looksLikeExport(raw)) throw new Error('not ours');
      const before = Object.keys(state.cards).length;
      state = mergeStates(state, raw);
      save();
      renderSettings(); // so the form shows the merged start date, and a later save keeps it
      notify(`Imported. ${Object.keys(state.cards).length - before} new cards, ${state.logs.length} reviews in history.`);
    } catch {
      notify('That file isn’t a Japan Prep backup.', true);
    }
    e.target.value = '';
  };
}

/* ── start ───────────────────────────────────────────────────────────── */

const online = () => { $('offline').hidden = navigator.onLine; };
addEventListener('online', online);
addEventListener('offline', online);
online();

// Ask the browser not to evict our storage. Safari decides by itself.
navigator.storage?.persist?.().catch(() => {});
loadVoices().then(() => { if (location.hash === '#settings') renderSettings(); });
route();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
