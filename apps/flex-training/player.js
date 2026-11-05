// The guided player and its lock-screen controls. It imports the session
// helpers from app.js and app.js imports it back. That cycle is safe
// because nothing here runs at load: app.js calls initPlayer() once its own
// state exists.
import { checklist, nextToDo, playPhases, resumeStep, spokenCue, RESUME_LAYOUT, ymd, moveKeys } from './plan.js';
import ROUTINE from './routine.js';
import FORM from './form.js';
import {
  $, esc, rich, log, timer, parseKey, entryFor, updateEntry, saveLog, fmtClock, sessionHref, isDeload, cueList, formHtml,
} from './app.js';
import { unlockAudio, unlockSpeech, chime, speak, hush, keepAwake } from './sound.js';

// Full-screen, one movement at a time: a "Get ready" countdown, then the
// timer (split per side, and into press/relax rounds for contract-relax,
// where the plan gives them). Between sides it waits for you, then counts
// in. When a movement's time is up it's ticked and the next one starts.
// Where you are is saved to the log entry (resume), so closing it or
// losing the page picks up there.
let play = null; // { o, items, index, phases, phase, left, running, waiting, endAt, tick, saved }

const LOCK_KEY = 'flex-training:lockscreen'; // '1' when lock-screen controls are on
let lockScreenOn = (() => { try { return localStorage.getItem(LOCK_KEY) === '1'; } catch { return false; } })();
const VOICE_KEY = 'flex-training:voice'; // '1' when spoken cues are on
let voiceOn = (() => { try { return localStorage.getItem(VOICE_KEY) === '1'; } catch { return false; } })();

// Say what step `phase` is, after `beeps` beeps have played.
function announce(phase = play.phase, beeps = 0) {
  if (voiceOn) speak(spokenCue(play.phases, phase, play.items[play.index].item.name), beeps * 280 + 150);
}

export function openPlayer(key) {
  if (play && play.o.key === key) { paintPlayer(); return; }
  closePlayer();
  const o = parseKey(key);
  if (!o) return;
  unlockAudio();
  if (voiceOn) unlockSpeech();
  const e = entryFor(o);
  const items = checklist(o.session, e.variant);
  const checked = new Set(e.checked);
  const r = e.resume && e.resume.index < items.length ? e.resume : null;
  const index = r ? r.index : Math.max(0, nextToDo(items, checked, -1));
  play = { o, items, index, phases: playPhases(items[index].item), phase: 0, left: 0, running: false, waiting: false, endAt: 0, tick: null, saved: 0 };
  if (r) {
    ({ phase: play.phase, left: play.left } = resumeStep(items[index].item, r));
    play.waiting = !!play.phases[play.phase].wait;
  } else {
    play.left = play.phases[0].seconds;
  }
  play.returnFocus = document.activeElement;
  $('player').hidden = false;
  document.body.classList.add('playing');
  // The page behind is out of reach while the player is open.
  document.querySelector('.container').inert = true;
  $('timer').inert = true;
  paintPlayer();
  $('playToggle').focus();
  if (!r) { runPlayer(); announce(); } // a fresh start counts straight in; a resume waits for you
  keepAwake(true);
  setupLockScreen();
}

export function closePlayer() {
  if (!play) return;
  hush();
  pausePlayer();
  savePlayer();
  const back = play.returnFocus;
  play = null;
  $('player').hidden = true;
  document.body.classList.remove('playing');
  document.querySelector('.container').inert = false;
  $('timer').inert = false;
  if (back?.isConnected) back.focus();
  if (!timer.running) keepAwake(false);
  clearLockScreen();
}

const playLeft = () => (play.running ? Math.max(0, (play.endAt - Date.now()) / 1000) : play.left);

function savePlayer() {
  if (!play || play.done) return;
  play.saved = Date.now();
  updateEntry(play.o, { resume: { index: play.index, phase: play.phase, left: Math.round(playLeft()), layout: RESUME_LAYOUT } });
}

function runPlayer() {
  play.waiting = false;
  play.endAt = Date.now() + play.left * 1000;
  play.running = true;
  clearInterval(play.tick);
  play.tick = setInterval(tickPlayer, 200);
  tickPlayer();
  updateLockScreen(true);
}

function pausePlayer() {
  if (!play || !play.running) return;
  play.left = playLeft();
  play.running = false;
  clearInterval(play.tick);
  updateLockScreen(true);
}

// Sounds for each change of step: one high beep to press, one low beep to
// relax, two level beeps to switch sides, three rising to move on to the
// next movement, and a four-note run when the session is done.
const CUE = { press: [1, 988], relax: [1, 660], switch: [2, 880], next: [3, [660, 880, 1175]], finish: [4, [523, 659, 784, 1047]] };

function tickPlayer() {
  if (!play) return;
  const left = playLeft();
  $('playTime').textContent = fmtClock(left);
  $('playToggle').textContent = play.waiting ? 'I’m ready' : play.running ? 'Pause' : 'Resume';
  if (play.running && Date.now() - play.saved > 5000) savePlayer();
  updateLockScreen();
  if (play.running && left <= 0) {
    if (play.phase < play.phases.length - 1) {
      play.phase++;
      const step = play.phases[play.phase];
      play.left = step.seconds;
      if (CUE[step.kind]) chime(...CUE[step.kind]);
      announce(play.phase, CUE[step.kind]?.[0] || 0);
      if (step.wait) {
        // Between sides: stop and wait for "I'm ready", then count in. Not
        // pausePlayer(): that would read the finished step's 0:00 into left.
        clearInterval(play.tick);
        play.running = false;
        play.waiting = true;
        updateLockScreen(true);
        savePlayer();
        paintPlayer();
        return;
      }
      // Start the new step's clock before repainting: the repaint reads it.
      runPlayer();
      paintPlayer();
    } else {
      finishMovement(true, true);
    }
  }
}

// Ticks the current movement (when `tick`) and moves on to the next one not
// yet ticked. At the end of the list it finishes, or, if anything was
// skipped, asks whether to go back for it. `timeUp` when the timer ran out
// rather than a tap on Done, which gets the moving-on beeps.
function finishMovement(tick, timeUp = false) {
  pausePlayer();
  const { o, items } = play;
  const checked = new Set(entryFor(o).checked);
  if (tick) checked.add(items[play.index].id);
  updateEntry(o, { checked: [...checked] });
  const next = nextToDo(items, checked, play.index);
  if (next >= 0) { if (timeUp) chime(...CUE.next); goTo(next, true, timeUp ? CUE.next[0] : 0); return; }
  if (items.every((i) => checked.has(i.id))) finishSession();
  else { if (timeUp) chime(...CUE.next); showEnd(); } // time's up on the last one, with some skipped
}

function finishSession() {
  const { o } = play;
  const { resume, ...rest } = entryFor(o);
  log.entries[o.key] = { ...rest, done: true, updated: Date.now(), title: o.session.title, date: ymd(o.date) };
  saveLog();
  chime(...CUE.finish);
  if (voiceOn) speak('Session done. Nice work.', CUE.finish[0] * 280 + 150);
  showFinished(true);
}

// `beeps` that just played, so the spoken name waits for them.
function goTo(index, autostart, beeps = 0) {
  pausePlayer();
  play.index = index;
  play.phases = playPhases(play.items[index].item);
  play.phase = 0;
  play.left = play.phases[0].seconds;
  play.waiting = false;
  play.ending = false;
  paintPlayer();
  savePlayer();
  if (autostart) { runPlayer(); announce(0, beeps); }
}

// The end of the list with some movements skipped.
function showEnd() {
  clearInterval(play.tick);
  play.running = false;
  play.ending = true;
  const checked = new Set(entryFor(play.o).checked);
  const skipped = play.items.filter((i) => !checked.has(i.id));
  $('playStep').textContent = '';
  $('playTime').textContent = '';
  $('playBody').innerHTML = `<div class="play-done">
    <p class="label">${esc(play.o.session.title)}</p>
    <h2 class="title">End of the session</h2>
    <p class="muted">You skipped ${skipped.length === 1 ? 'one movement' : `${skipped.length} movements`}:</p>
    <ul class="skipped">${skipped.map((i) => `<li>${esc(i.item.name)}</li>`).join('')}</ul>
    <div class="row">
      <button class="btn primary" type="button" id="playFinish">Finish session</button>
      <button class="btn" type="button" id="playRedo">Do the skipped ones</button>
    </div>
  </div>`;
  // After the moving-on beeps, when time ran out on the last movement.
  if (voiceOn) speak(`End of the session. You skipped ${skipped.length === 1 ? 'one movement' : `${skipped.length} movements`}.`, CUE.next[0] * 280 + 150);
  updateLockScreen(true);
}

function showFinished() {
  const key = play.o.key;
  clearInterval(play.tick);
  $('playBody').innerHTML = `<div class="play-done">
    <p class="label">${esc(play.o.session.title)}</p>
    <h2 class="title">Session done ✓</h2>
    <p class="muted">Add a note about how it went?</p>
    <a class="btn primary" href="${sessionHref(play.o.date, play.o.session.id)}">Back to the session</a>
  </div>`;
  $('playStep').textContent = '';
  $('playTime').textContent = '';
  play.running = false;
  play.done = key;
  clearLockScreen();
}

function paintPlayer() {
  if (!play) return;
  const { o, items, index, phases, phase } = play;
  const { item, section, id } = items[index];
  const checked = new Set(entryFor(o).checked);
  const step = phases[phase];
  const upNext = nextToDo(items, new Set([...checked, id]), index);
  $('playHead').textContent = `${o.session.title} · ${index + 1} of ${items.length}${section?.title ? ` · ${section.title}` : ''}`;
  $('playStep').textContent = step.label || (checked.has(id) ? 'Already ticked' : '');
  $('player').dataset.step = step.kind;
  $('player').classList.toggle('waiting', play.waiting);
  paintLockButton();
  const s = o.session;
  $('playBody').innerHTML = `
    ${play.waiting ? `<p class="switch-note">${esc(step.label)}, then tap <b>I’m ready</b>. You get ${step.seconds} seconds to settle.</p>` : ''}
    ${isDeload(o.date) && s.deload ? `<div class="info-box tiny"><b>Deload week.</b> ${rich(s.deload)}</div>` : ''}
    ${section?.note ? `<p class="sec-note">${rich(section.note)}</p>` : ''}
    <h2 class="title">${esc(item.name)}</h2>
    <p class="mdur">${esc(item.duration)}</p>
    ${item.detail ? `<p class="mdetail">${rich(item.detail)}</p>` : ''}
    ${item.cues?.length ? cueList(item.cues) : ''}
    ${moveKeys(item.name).some((k) => FORM[k]) ? `<h3 class="sec">How to do it</h3>${moveKeys(item.name).filter((k) => FORM[k]).map((k) => formHtml(FORM[k], true)).join('')}` : ''}
    ${upNext >= 0 ? `<p class="up-next">Next: ${esc(items[upNext].item.name)}</p>` : ''}
    <details class="stop"><summary>${s.notes?.length ? 'Session notes and stop rules' : 'Stop rules'}</summary>
      ${(s.notes || []).map((n) => `<p class="tiny"><b>${esc(n.label)}.</b> ${rich(n.text)}</p>`).join('')}
      <ul>${ROUTINE.guide.stopRules.map((r) => `<li><b>${esc(r.area)}.</b> ${rich(r.text)}</li>`).join('')}</ul>
    </details>`;
  $('playBody').scrollTop = 0;
  $('playBack').disabled = index === 0;
  tickPlayer();
}

function paintLockButton() {
  // Highlighted when on; aria-pressed says it to screen readers.
  $('playLock').setAttribute('aria-pressed', lockScreenOn);
  $('playLock').classList.toggle('on', lockScreenOn);
  $('playVoice').setAttribute('aria-pressed', voiceOn);
  $('playVoice').classList.toggle('on', voiceOn);
}

function togglePlayer(want) {
  if (!play || play.done || play.ending) return;
  const run = want ?? !play.running;
  if (run && voiceOn) unlockSpeech(); // a tap, which iOS needs before it will speak
  if (run && !play.running) runPlayer();
  else if (!run && play.running) { pausePlayer(); savePlayer(); }
  paintPlayer();
}

function skipMovement() {
  if (!play || play.done || play.ending) return;
  const checked = new Set(entryFor(play.o).checked);
  const next = nextToDo(play.items, checked, play.index);
  if (next >= 0) goTo(next, true);
  else if (play.items.every((i) => checked.has(i.id))) finishSession();
  else showEnd(); // skipping the last one: say what's left rather than loop back
}

const backMovement = () => { if (play && !play.done && play.index > 0) goTo(play.index - 1, false); };
const doneMovement = () => { if (play && !play.done && !play.ending) finishMovement(true); };

/* ── lock-screen controls ────────────────────────────────────────────── */

// Phones show media controls on the lock screen only for a page that's
// playing audio, so this plays a silent loop and reports the movement and
// time left through the Media Session API, with play/pause, next (Done) and
// previous (Back). It's opt-in: on iPhone the silent audio can pause music
// playing in another app.
// CHECK: do timers keep running with the screen locked? iOS may suspend
// the page anyway, so step changes and chimes could land late.
let silentAudio = null;

function silentSrc() {
  // Two seconds of 8-bit, 8 kHz silence as a WAV, made once.
  const rate = 8000, n = rate * 2, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
  const str = (at, s) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  str(36, 'data'); v.setUint32(40, n, true);
  new Uint8Array(buf, 44).fill(128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

function setupLockScreen() {
  const ms = navigator.mediaSession;
  if (!lockScreenOn || !ms || !play) return;
  if (!silentAudio) { silentAudio = new Audio(silentSrc()); silentAudio.loop = true; }
  const handlers = { play: () => togglePlayer(true), pause: () => togglePlayer(false), nexttrack: doneMovement, previoustrack: backMovement };
  for (const [action, f] of Object.entries(handlers)) { try { ms.setActionHandler(action, f); } catch { /* not supported */ } }
  updateLockScreen(true);
}

function clearLockScreen() {
  silentAudio?.pause();
  const ms = navigator.mediaSession;
  if (!ms) return;
  ms.metadata = null;
  try { ms.playbackState = 'none'; } catch { /* older browsers */ }
  for (const action of ['play', 'pause', 'nexttrack', 'previoustrack']) { try { ms.setActionHandler(action, null); } catch { /* not supported */ } }
}

let lockShown = '';
function updateLockScreen(force = false) {
  const ms = navigator.mediaSession;
  if (!lockScreenOn || !ms || !play || play.done || !window.MediaMetadata) return;
  const step = play.phases[play.phase];
  const { item } = play.items[play.index];
  const left = fmtClock(playLeft());
  const title = `${play.ending ? 'End of the session' : item.name}${step.label && !play.ending ? ` · ${step.label}` : ''}`;
  const artist = play.ending ? play.o.session.title : `${play.waiting ? 'Tap play when ready' : `${left} left`} · ${play.o.session.title}`;
  if (!force && title + artist === lockShown) return;
  lockShown = title + artist;
  ms.metadata = new MediaMetadata({ title, artist, album: 'Flex Training' });
  try { ms.playbackState = play.running ? 'playing' : 'paused'; } catch { /* older browsers */ }
  if (silentAudio) { if (play.running) silentAudio.play().catch(() => {}); else silentAudio.pause(); }
  if (play.running && ms.setPositionState) {
    try { ms.setPositionState({ duration: step.seconds, position: Math.min(step.seconds, step.seconds - playLeft()), playbackRate: 1 }); } catch { /* bad state */ }
  }
}

// Wired up from app.js once it has loaded; see the note at the top.
export function initPlayer() {
  $('playToggle').addEventListener('click', () => togglePlayer());
  $('playDone').addEventListener('click', doneMovement);
  $('playSkip').addEventListener('click', skipMovement);
  $('playBack').addEventListener('click', () => { if (play?.ending) { goTo(play.index, false); return; } backMovement(); });
  $('playBody').addEventListener('click', (ev) => {
    if (ev.target.id === 'playFinish') finishSession();
    if (ev.target.id === 'playRedo') goTo(nextToDo(play.items, new Set(entryFor(play.o).checked), -1), true);
  });
  $('playClose').addEventListener('click', () => {
    const key = play?.o.key;
    location.hash = key ? `#s/${encodeURIComponent(key)}` : '#week';
  });
  $('playLock').addEventListener('click', () => {
    lockScreenOn = !lockScreenOn;
    try { localStorage.setItem(LOCK_KEY, lockScreenOn ? '1' : '0'); } catch { /* per-visit only */ }
    if (lockScreenOn && !play?.done) setupLockScreen(); else clearLockScreen();
    // Just the button: a repaint would swap the end screen for the last movement.
    paintLockButton();
  });
  $('playVoice').addEventListener('click', () => {
    voiceOn = !voiceOn;
    try { localStorage.setItem(VOICE_KEY, voiceOn ? '1' : '0'); } catch { /* per-visit only */ }
    if (voiceOn) { unlockSpeech(); speak('Voice on.'); } else hush();
    paintLockButton();
  });
  // Save where you are if the page is hidden or closed mid-hold.
  document.addEventListener('visibilitychange', () => { if (document.hidden && play && !play.done) savePlayer(); });
  window.addEventListener('pagehide', () => { if (play && !play.done) savePlayer(); });
}
