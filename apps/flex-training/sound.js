// Beeps, vibration, speech and keeping the screen on, shared by the hold
// timer and the guided player.

let audioCtx = null;
let wakeLock = null;

// Call from a tap: iOS only lets a page play sound it started in response
// to one.
export function unlockAudio() {
  try { audioCtx ||= new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch { /* silent */ }
}

// freq is one pitch for every beep, or one per beep (a rising run reads
// as "moving on" where repeated beeps read as "same again").
export function chime(times = 3, freq = 880) {
  try { navigator.vibrate?.(times === 1 ? 150 : Array.from({ length: times * 2 - 1 }, (_, i) => (i % 2 ? 100 : 200))); } catch { /* no vibration */ }
  if (!audioCtx) return;
  for (let i = 0; i < times; i++) {
    const t = audioCtx.currentTime + i * 0.28;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = Array.isArray(freq) ? freq[i] : freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.22);
  }
}

export async function keepAwake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen');
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { wakeLock = null; }
}

// Spoken cues. Speech works on iPhone where vibration doesn't, and lets
// you follow along without looking at the screen.
// CHECK: does iOS Safari keep speaking while the screen is locked, or only
// with the lock-screen controls (silent audio) on?
export function unlockSpeech() {
  try { window.speechSynthesis?.speak(new SpeechSynthesisUtterance('')); } catch { /* no speech */ }
}

// delay lets a beep finish first.
export function speak(text, delay = 0) {
  const synth = window.speechSynthesis;
  if (!synth || !text) return;
  setTimeout(() => {
    try { synth.cancel(); synth.speak(new SpeechSynthesisUtterance(text)); } catch { /* no speech */ }
  }, delay);
}
