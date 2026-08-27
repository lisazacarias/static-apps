import { test } from 'node:test';
import assert from 'node:assert';
import { loadApp } from './harness.mjs';

const app = loadApp();
app.S = app.normalize(app.blank());
app.S.muted = false;
const R = app.WAV_RATE;
const peak = p => { let m = 0; for (const x of p) m = Math.max(m, Math.abs(x)); return m; };

test('every step produces audible play-along audio', () => {
  for (const step of app.STEPS) {
    const m = app.genMelody(step.rhythm, 5, app.keyByName(step.keys[0]), false,
      { hand: step.hand, reach: step.reach });
    for (const mode of ['both', 'click', 'melody']) {
      const pcm = app.renderPlayAlong(m, 84, mode);
      assert.ok(pcm.length > R, `${step.label} / ${mode}: too short`);
      assert.ok(peak(pcm) > 0.05, `${step.label} / ${mode}: silent`);
      assert.ok(peak(pcm) <= 1.0, `${step.label} / ${mode}: clipping`);
    }
  }
});

test('playback covers both staves', () => {
  for (const step of app.STEPS) {
    const m = app.genMelody(step.rhythm, 7, app.keyByName(step.keys[0]), false,
      { hand: step.hand, reach: step.reach });
    const expected = [m.bars, m.bass].filter(Boolean)
      .reduce((a, staff) => a + staff.flat().length, 0);
    assert.equal(app.melodySeq(m).length, expected, step.label);
  }
});

test('written duration is audible in the sound', () => {
  const len = l => {
    const pcm = app.renderNotes([{ midi: 60, at: 0, len: l }]);
    const pk = peak(pcm);
    let last = 0;
    for (let i = 0; i < pcm.length; i++) if (Math.abs(pcm[i]) > pk * 0.02) last = i;
    return last / R;
  };
  const short = len(0.25), long = len(3.0);
  assert.ok(long / short > 4, `whole note only ${(long / short).toFixed(1)}x an eighth`);
});

test('the click track is exactly one beat apart', () => {
  for (const bpm of [40, 84, 160]) {
    const spb = 60 / bpm;
    const pcm = app.rhythmTrack(bpm, 32);
    const holdoff = Math.round(0.02 * R);
    const hits = []; let last = -1e9;
    for (let i = 0; i < pcm.length; i++) {
      if (Math.abs(pcm[i]) > 0.15) { if (i - last > holdoff) hits.push(i / R); last = i; }
    }
    assert.equal(hits.length, 4 + 32 + 2, `${bpm}bpm: wrong click count`);
    const worst = Math.max(...hits.slice(1).map((t, i) => Math.abs(t - hits[i] - spb)));
    assert.ok(worst < 0.002, `${bpm}bpm: drifts by ${(worst * 1000).toFixed(1)}ms`);
  }
});

test('the melody enters exactly on the downbeat', () => {
  const m = app.genMelody(1, 5, app.keyByName('C'), false, { hand: 'right', reach: 0 });
  const spb = 60 / 84;
  const pcm = app.renderPlayAlong(m, 84, 'melody');
  let first = 0;
  for (let i = 0; i < pcm.length; i++) if (Math.abs(pcm[i]) > 0.02) { first = i / R; break; }
  assert.ok(Math.abs(first - 4 * spb) < 0.05, `entered at ${first.toFixed(3)}s, expected ${(4 * spb).toFixed(3)}s`);
});

test('a bass note gets a loudness boost so it does not sound quieter than treble', () => {
  const bass = peak(app.renderNotes([{ midi: 40, at: 0 }]));   // E2, the app's lowest note
  const mid = peak(app.renderNotes([{ midi: 60, at: 0 }]));    // middle C, the boost's reference point
  const treble = peak(app.renderNotes([{ midi: 72, at: 0 }])); // C5
  assert.ok(bass > mid * 1.8, `bass peak ${bass.toFixed(3)} should clearly exceed middle-C peak ${mid.toFixed(3)}`);
  assert.ok(Math.abs(mid - treble) < 0.001, `treble should be unboosted: mid ${mid.toFixed(3)} vs treble ${treble.toFixed(3)}`);
});

test('boosted bass still leaves headroom when stacked with a treble note', () => {
  const pcm = app.renderNotes([{ midi: 40, at: 0, len: 1 }, { midi: 76, at: 0, len: 1 }]);
  // the limiter can never mathematically exceed 1.0 (it's a tanh), so a peak
  // near it means the two voices are already driving it into heavy audible
  // compression, not that anything is about to overflow
  assert.ok(peak(pcm) < 0.95, `stacked bass+treble is deep in the limiter at ${peak(pcm).toFixed(3)}`);
});

test('every ladder step stays clear of the limiter in melody-plus-click playback', () => {
  for (const step of app.STEPS) {
    const m = app.genMelody(step.rhythm, 9, app.keyByName(step.keys[0]), false,
      { hand: step.hand, reach: step.reach });
    const pk = peak(app.renderPlayAlong(m, 84, 'both'));
    assert.ok(pk < 0.9, `${step.label}: both-mode peak ${pk.toFixed(3)} is too close to the limiter`);
  }
});

test('play-along does not needlessly attenuate notes relative to a solo melody', () => {
  const m = app.genMelody(1, 5, app.keyByName('C'), false, { hand: 'left', reach: 0 });
  const soloPeak = peak(app.renderPlayAlong(m, 84, 'melody'));
  const bothPeak = peak(app.renderPlayAlong(m, 84, 'both'));
  assert.ok(bothPeak >= soloPeak, `adding the click should not reduce the melody's own peak (solo ${soloPeak.toFixed(3)}, both ${bothPeak.toFixed(3)})`);
});
