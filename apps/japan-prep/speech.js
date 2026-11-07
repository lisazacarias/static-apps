// The browser's Japanese voice. Fragile in known ways (see the research
// notes summarised in README.md): iOS only speaks from a tap and is silent with the mute switch on;
// Chrome loads voices late; Firefox for Android has none. So: every call
// cancels what's playing, the voice list is loaded once up front (so
// say() itself stays synchronous inside the tap), and callers speak kana,
// never digits or kanji.

const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
let voices = [];

export const canSpeak = () => !!synth;

// Japanese voices, waiting up to 2 s for the list to arrive.
export function loadVoices() {
  if (!synth) return Promise.resolve([]);
  const grab = () => (voices = synth.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith('ja')));
  if (grab().length) return Promise.resolve(voices);
  return new Promise((resolve) => {
    const done = () => { synth.removeEventListener?.('voiceschanged', done); clearTimeout(timer); resolve(grab()); };
    const timer = setTimeout(done, 2000);
    synth.addEventListener?.('voiceschanged', done);
  });
}

export const japaneseVoices = () => voices;

export function say(text, { rate = 1, voiceURI = '' } = {}) {
  if (!synth || !text) return false;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  u.rate = rate;
  const v = voices.find((x) => x.voiceURI === voiceURI) || voices[0];
  if (v) u.voice = v;
  synth.speak(u);
  return true;
}

export const stopSpeaking = () => synth?.cancel();
