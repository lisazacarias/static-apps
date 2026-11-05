// Beeps, vibration and keeping the screen on, shared by the hold timer and
// the guided player.

let audioCtx = null;
let wakeLock = null;

// Call from a tap: iOS only lets a page play sound it started in response
// to one.
export function unlockAudio() {
  try { audioCtx ||= new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch { /* silent */ }
}

export function chime(times = 3, freq = 880) {
  try { navigator.vibrate?.(times === 1 ? 150 : Array.from({ length: times * 2 - 1 }, (_, i) => (i % 2 ? 100 : 200))); } catch { /* no vibration */ }
  if (!audioCtx) return;
  for (let i = 0; i < times; i++) {
    const t = audioCtx.currentTime + i * 0.28;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq;
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
