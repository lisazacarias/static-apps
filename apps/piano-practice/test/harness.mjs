// Loads the app's script out of index.html and runs it against a stub browser,
// so the real functions are exercised rather than copies of them.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', 'index.html'), 'utf8');

export function loadApp({ userAgent = 'Mozilla/5.0 (Macintosh)', withStorage = false } = {}) {
  const store = {};
  const el = () => ({
    innerHTML: '', textContent: '', value: '', style: {}, dataset: {},
    classList: { toggle() {}, add() {}, remove() {} },
    querySelectorAll: () => [], querySelector: () => null,
    setAttribute() {}, getAttribute() {}, scrollIntoView() {},
    appendChild() {}, remove() {}, click() {},
    paused: true, open: false,
    onclick: null, ontoggle: null, onchange: null, onkeydown: null
  });
  const node = () => ({
    connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
    frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, value: 0 },
    type: '', start() {}, stop() {}, buffer: null,
    getFloatTimeDomainData() {}, fftSize: 2048
  });
  class Ctx {
    constructor() { this.state = 'running'; this.destination = {}; this.sampleRate = 44100; }
    get currentTime() { return 0; }
    resume() {} createGain() { return node(); } createBiquadFilter() { return node(); }
    createOscillator() { return node(); } createBuffer() { return {}; }
    createBufferSource() { return node(); } createAnalyser() { return node(); }
    createMediaStreamSource() { return node(); }
  }
  const ls = {};
  const sandbox = {
    store,
    document: {
      getElementById: id => (store[id] = store[id] || el()),
      createElement: () => el(), body: el(),
      querySelectorAll: () => [],
      // selector-keyed, same backing store as getElementById — good enough to
      // catch code that writes to a querySelector'd element directly instead
      // of going through the store, like renderVerdictOnly's staff redraw
      querySelector: sel => (store[sel] = store[sel] || el()),
      addEventListener() {}
    },
    window: {
      AudioContext: Ctx, self: 1, top: 1,
      localStorage: { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = v; } },
      storage: withStorage ? {
        get: async k => (k in ls ? { value: ls[k] } : null),
        set: async (k, v) => { ls[k] = v; }
      } : undefined
    },
    navigator: { userAgent, maxTouchPoints: 0, audioSession: { type: 'auto', state: 'active' } },
    Audio: class { constructor() { this.paused = true; } setAttribute() {} pause() {} play() { return Promise.resolve(); } },
    Blob: class { constructor(p) { this.size = (p[0] && p[0].byteLength) || 0; } },
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 1, clearInterval: () => {},
    confirm: () => false, ls
  };

  const script = html.split('<script>')[1].split('</script>')[0];
  const body = script.slice(0, script.lastIndexOf('(async () => {'));
  const names = Object.keys(sandbox);
  const exposed = [
    'STEPS', 'KEYS', 'KEYS_ALL', 'RHYTHMS', 'WAV_RATE', 'MIDDLE_C',
    'blank', 'normalize', 'genMelody', 'melodyBars', 'melodySVG', 'melodySeq',
    'keyByName', 'keyAlter', 'clefsFor', 'fingerPlan', 'fingeringDiagram',
    'rhythmOnsets', 'rhythmTrack', 'renderPlayAlong', 'renderClickTrack', 'renderNotes',
    'encodeWav', 'barFeatures', 'FEATURES', 'melodyBaseline', 'recordStumble', 'stumbleInsight',
    'stepIndex', 'stepPassed', 'unlockedThrough', 'curStep',
    'allowedKeys', 'defaultMode', 'nextAction', 'render', 'renderSpine', 'renderSight', 'insightPanel', 'newMelody',
    'dOf', 'letterOf', 'octOf', 'midiOf', 'save', 'load', 'drawKey',
    'startSession', 'toggleSlot', 'finishSlot', 'refreshSession', 'renderNow', 'SLOTS',
    'solfegeSyllable', 'MINOR_OK', 'solfegeStaffSVG',
    'solfegeHTML', 'melKeyLabel', 'drillStaffSVG', 'keySigStaffSVG', 'renderVerdictOnly',
    'effFocus', 'WINDOW', 'WINDOW_TARGET', 'stepWindow', 'stepCleanCount',
    'recordStepOutcome', 'windowProgressText'
  ];
  const fn = new Function(...names, `${body}
    return { ${exposed.join(', ')},
      get S(){ return S; }, set S(v){ S = v; },
      get tab(){ return tab; }, set tab(v){ tab = v; },
      get mel(){ return mel; }, set mel(v){ mel = v; },
      get drill(){ return drill; }, set drill(v){ drill = v; },
      get tapState(){ return tapState; }, set tapState(v){ tapState = v; },
      get tapResult(){ return tapResult; }, set tapResult(v){ tapResult = v; },
      get tapExpected(){ return tapExpected; }, set tapExpected(v){ tapExpected = v; },
      get tapTotalBeats(){ return tapTotalBeats; }, set tapTotalBeats(v){ tapTotalBeats = v; },
      get playState(){ return playState; }, set playState(v){ playState = v; },
      get playOnsets(){ return playOnsets; }, set playOnsets(v){ playOnsets = v; },
      get playBeats(){ return playBeats; }, set playBeats(v){ playBeats = v; },
      get playBpm(){ return playBpm; }, set playBpm(v){ playBpm = v; },
      get lastVerdict(){ return lastVerdict; }, set lastVerdict(v){ lastVerdict = v; },
      get prevMel(){ return prevMel; }, set prevMel(v){ prevMel = v; },
      get askBar(){ return askBar; }, set askBar(v){ askBar = v; },
      get keyIdentified(){ return keyIdentified; }, set keyIdentified(v){ keyIdentified = v; },
      get metroBpm(){ return metroBpm; }, set metroBpm(v){ metroBpm = v; }
    };`);
  const app = fn(...names.map(n => sandbox[n]));
  app.store = store;
  app.ls = ls;
  return app;
}
