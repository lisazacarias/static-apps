import { test } from 'node:test';
import assert from 'node:assert';
import { loadApp } from './harness.mjs';

test('the naming reference box never auto-opens next to a live question', () => {
  const app = loadApp();
  app.S = app.normalize(app.blank());
  app.S.primerSeen = true;
  app.tab = 'reading';
  app.drill = { d: null, keyIdx: 0, mode: 'key', minor: false, state: null, t0: 0, round: { n: 0, correct: 0, secs: 0 }, done: false };
  [false, true].forEach(namingSeen => {
    app.S.namingSeen = namingSeen;
    app.render();
    const html = app.store.view.innerHTML;
    assert.ok(html.includes('id="namebox"'), 'the reference box should still exist');
    assert.ok(!/id="namebox"[^>]*\bopen\b/.test(html),
      `namebox should not auto-open (namingSeen=${namingSeen}) — it sits next to the live drill question and is easy to mistake for the answer`);
  });
});

test('a step clears at 4 of its last 5 outcomes, even with one miss between', () => {
  const app = loadApp();
  app.S = app.normalize(app.blank());
  const outcomes = ['ok', 'ok', 'no', 'ok'];
  outcomes.forEach(o => app.recordStepOutcome(0, o));
  assert.equal(app.stepPassed(0), false, 'should not pass on 3 clean out of 4');
  assert.equal(app.recordStepOutcome(0, 'ok'), true, 'the 4th clean in the window should tip it over');
  assert.equal(app.stepPassed(0), true);
});

test('a stumble ages out of the window instead of resetting progress to zero', () => {
  const app = loadApp();
  app.S = app.normalize(app.blank());
  app.recordStepOutcome(0, 'no');
  app.recordStepOutcome(0, 'ok');
  app.recordStepOutcome(0, 'ok');
  app.recordStepOutcome(0, 'ok');
  assert.equal(app.stepPassed(0), false, '3 clean out of 4 (one of them a stumble) should not pass yet');
  app.recordStepOutcome(0, 'ok');
  assert.equal(app.stepPassed(0), true,
    'the early stumble should not have zeroed anything — 4 of the last 5 is enough');
});

test('the window only ever tracks the most recent attempts', () => {
  const app = loadApp();
  app.S = app.normalize(app.blank());
  ['ok', 'ok', 'ok', 'ok', 'ok', 'no', 'no'].forEach(o => app.recordStepOutcome(0, o));
  assert.equal(app.stepWindow(0).length, app.WINDOW, 'window should be capped, not grow forever');
  assert.deepEqual(app.stepWindow(0), ['ok', 'ok', 'ok', 'no', 'no'], 'should keep only the most recent entries');
});

test('reaching out is introduced in C alone before mixing in other keys', () => {
  const app = loadApp();
  const isolated = app.STEPS.find(s => s.label.includes('reaching out') && s.keys.length === 1);
  assert.ok(isolated, 'expected a single-key reaching-out step');
  assert.deepEqual(isolated.keys, ['C']);
  const idx = app.STEPS.indexOf(isolated);
  const next = app.STEPS[idx + 1];
  assert.ok(next && next.label.includes('reaching out') && next.keys.length > 1,
    'the isolated step should be immediately followed by the multi-key version');
});

test('clearing a step unlocks exactly the next one', () => {
  const app = loadApp();
  app.S = app.normalize(app.blank());
  for (let cleared = 0; cleared <= app.STEPS.length; cleared++) {
    app.S.sight.passed = {};
    for (let i = 0; i < cleared; i++) app.S.sight.passed[i] = true;
    const expected = Math.min(app.STEPS.length - 1, cleared);
    assert.equal(app.unlockedThrough(), expected, `${cleared} cleared`);
  }
});

test('the directive always names a real tab and says something', () => {
  const app = loadApp();
  const TABS = ['sight', 'reading', 'learn', 'progress'];
  for (let step = 0; step < app.STEPS.length; step++)
    for (const cleared of [0, step, app.STEPS.length]) {
      app.S = app.normalize(app.blank());
      app.S.primerSeen = true; app.S.drill.asked = 40;
      app.S.sight.step = step;
      for (let i = 0; i < cleared; i++) app.S.sight.passed[i] = true;
      const a = app.nextAction();
      assert.ok(TABS.includes(a.tab), `bad tab ${a.tab}`);
      assert.ok(a.text && a.text.length > 20, 'directive too short');
    }
});

test('every tab renders in every state', () => {
  const app = loadApp();
  const TABS = ['sight', 'reading', 'learn', 'progress'];
  for (let step = 0; step < app.STEPS.length; step += 2)
    for (const cleared of [0, step, app.STEPS.length]) {
      for (const t of TABS) {
        app.S = app.normalize(app.blank());
        app.S.primerSeen = true; app.S.muted = true; app.S.sight.step = step;
        for (let i = 0; i < cleared; i++) app.S.sight.passed[i] = true;
        app.tab = t;
        if (t === 'sight') {
          app.newMelody();
          app.tapExpected = app.rhythmOnsets(app.mel, 84);
          app.tapTotalBeats = 32; app.tapState = 'off'; app.tapResult = null;
          app.playState = 'off'; app.playOnsets = app.tapExpected;
          app.playBeats = 32; app.playBpm = 84;
          app.lastVerdict = null; app.prevMel = null; app.askBar = false;
          app.askBar = true;
          app.render();
          const askHtml = app.store.view.innerHTML || '';
          assert.ok(askHtml.length > 0, `${t} with askBar rendered empty`);
          assert.ok(!/NaN|undefined/.test(askHtml), `${t} with askBar contains NaN or undefined`);
          app.askBar = false;
        }
        app.render();
        const html = app.store.view.innerHTML || '';
        assert.ok(html.length > 0, `${t} rendered empty`);
        assert.ok(!/NaN|undefined/.test(html), `${t} contains NaN or undefined`);
      }
    }
});

test('key selection never repeats back to back', () => {
  const app = loadApp();
  app.S = app.normalize(app.blank());
  for (const pool of [['C', 'G', 'F'], app.KEYS_ALL]) {
    let prev = null;
    for (let i = 0; i < 500; i++) {
      const k = app.drawKey(pool);
      assert.notEqual(k, prev, 'same key twice running');
      prev = k;
    }
  }
});

test('stumble analysis tolerates legacy records with no feat/base', () => {
  // stumbleInsight() used to be reached only from the insight panel deep in
  // the page. newMelody() now calls it on every melody (for auto-focus), so
  // it's on the critical path for the Sight tab to render at all — a stumble
  // record predating the feat/base fields must not be able to break that.
  const app = loadApp();
  app.S = app.normalize(app.blank());
  for (let i = 0; i < 8; i++) app.S.stumbles.push({ date: '2026-01-01', step: 0, key: 'C', bar: i % 8 });
  assert.doesNotThrow(() => app.stumbleInsight(), 'stumbleInsight should not throw on legacy stumbles');
  assert.doesNotThrow(() => app.effFocus(), 'effFocus should not throw on legacy stumbles');
  assert.doesNotThrow(() => app.newMelody(), 'newMelody should not throw on legacy stumbles');
});

test('stumble analysis finds a real pattern', () => {
  const app = loadApp();
  app.S = app.normalize(app.blank());
  app.S.sight.step = 6;
  // a learner who always trips on the bar containing the biggest leap.
  // reach: 0 keeps this a clean single-cause fixture — at reach > 0, the
  // generator now guarantees a genuine out-of-position note per melody
  // (see generator.test.mjs), which often coincides with the biggest leap
  // and would confound this test's one-cause premise.
  for (let k = 0; k < 16; k++) {
    const m = app.genMelody(1, 300 + k, app.keyByName('C'), false, { hand: 'both', reach: 0 });
    app.mel = m;
    let worst = 0, best = -1;
    app.melodyBars(m).forEach((_, i) => {
      const f = app.barFeatures(m, i);
      if (f.leap > best) { best = f.leap; worst = i; }
    });
    app.recordStumble(m, worst);
  }
  const top = app.stumbleInsight().rows[0];
  assert.equal(top.k, 'leap', `expected leaps on top, got ${top.k}`);
  assert.ok(top.ratio > 1.5, `leap ratio only ${top.ratio.toFixed(2)}`);
});

test('the insight panel renders when a strong pattern is on a feature with no weighting to offer', () => {
  const app = loadApp();
  app.S = app.normalize(app.blank());
  app.S.sight.step = 6;
  // 'accidental' has no focusableFeature() case, so a stumble history
  // dominated by it exercises the panel's "no weighting to offer for that"
  // branch instead of "practise this on purpose". Stumbles are constructed
  // directly since stumbleInsight only ever reads the stored feat/base, not
  // the melody that produced them.
  for (let k = 0; k < 16; k++) {
    app.S.stumbles.push({
      feat: { leap: 0, outPos: 0, blackKey: 0, eighths: 0, accidental: 1, turn: 0, ledger: 0 },
      base: { leap: 0.3, outPos: 0.2, blackKey: 0.3, eighths: 0, accidental: 0.1, turn: 0.3, ledger: 0.1 }
    });
  }
  const top = app.stumbleInsight().rows[0];
  assert.equal(top.k, 'accidental', `expected accidental on top, got ${top.k}`);
  assert.doesNotThrow(() => app.insightPanel(), 'panel should not throw when the strongest feature is not focusable');
  const html = app.insightPanel();
  assert.ok(/no weighting to offer/.test(html), 'panel should explain why nothing is offered to practise on purpose');
});

test('a detected weakness becomes the default focus, without being asked', () => {
  const app = loadApp();
  app.S = app.normalize(app.blank());
  app.S.sight.step = 6;
  assert.equal(app.effFocus(), null, 'should not invent a focus with no stumble history');
  for (let k = 0; k < 16; k++) {
    const m = app.genMelody(1, 300 + k, app.keyByName('C'), false, { hand: 'both', reach: 0 });
    app.mel = m;
    let worst = 0, best = -1;
    app.melodyBars(m).forEach((_, i) => {
      const f = app.barFeatures(m, i);
      if (f.leap > best) { best = f.leap; worst = i; }
    });
    app.recordStumble(m, worst);
  }
  assert.equal(app.effFocus(), 'leap', 'a strong, focusable weakness should become the default automatically');
});

test('an explicit "ordinary mix" choice overrides the automatic weakness focus', () => {
  const app = loadApp();
  app.S = app.normalize(app.blank());
  app.S.sight.step = 6;
  for (let k = 0; k < 16; k++) {
    const m = app.genMelody(1, 300 + k, app.keyByName('C'), false, { hand: 'both', reach: 0 });
    app.mel = m;
    let worst = 0, best = -1;
    app.melodyBars(m).forEach((_, i) => {
      const f = app.barFeatures(m, i);
      if (f.leap > best) { best = f.leap; worst = i; }
    });
    app.recordStumble(m, worst);
  }
  app.S.sight.focus = null;
  app.S.sight.focusChosen = true;
  assert.equal(app.effFocus(), null, 'an explicit opt-out should stick even though a weakness is detected');
});

test('an explicit focus choice is respected even if it differs from the detected weakness', () => {
  const app = loadApp();
  app.S = app.normalize(app.blank());
  app.S.sight.step = 6;
  for (let k = 0; k < 16; k++) {
    const m = app.genMelody(1, 300 + k, app.keyByName('C'), false, { hand: 'both', reach: 0 });
    app.mel = m;
    let worst = 0, best = -1;
    app.melodyBars(m).forEach((_, i) => {
      const f = app.barFeatures(m, i);
      if (f.leap > best) { best = f.leap; worst = i; }
    });
    app.recordStumble(m, worst);
  }
  app.S.sight.focus = 'turn';
  app.S.sight.focusChosen = true;
  assert.equal(app.effFocus(), 'turn', 'an explicit choice should win over the auto-detected weakness');
});

test('stumble analysis rarely finds a pattern in noise', () => {
  // Measured, not asserted once: a purely random stumbler should be flagged in
  // well under a fifth of runs. A single passing trial proves nothing here.
  const app = loadApp();
  let flagged = 0;
  const RUNS = 60;
  for (let t = 0; t < RUNS; t++) {
    app.S = app.normalize(app.blank());
    app.S.sight.step = 6;
    let s = t + 1;
    const rnd = () => { s |= 0; s = s + 0x6D2B79F5 | 0;
      let x = Math.imul(s ^ s >>> 15, 1 | s);
      x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x;
      return ((x ^ x >>> 14) >>> 0) / 4294967296; };
    for (let k = 0; k < 20; k++) {
      const m = app.genMelody(1, t * 997 + k, app.keyByName('C'), false, { hand: 'both', reach: 1 });
      app.mel = m;
      app.recordStumble(m, Math.floor(rnd() * app.melodyBars(m).length));
    }
    const ins = app.stumbleInsight();
    if (ins.enough && ins.rows.some(r => r.ratio >= 1.8)) flagged++;
  }
  const rate = flagged / RUNS;
  assert.ok(rate < 0.20, `flagged noise in ${(rate * 100).toFixed(0)}% of runs`);
});

test('it says nothing at all until there is enough data', () => {
  const app = loadApp();
  app.S = app.normalize(app.blank());
  app.S.sight.step = 6;
  for (let k = 0; k < 5; k++) {
    const m = app.genMelody(1, 900 + k, app.keyByName('C'), false, { hand: 'both', reach: 1 });
    app.mel = m;
    app.recordStumble(m, 0);
  }
  assert.equal(app.stumbleInsight().enough, false, 'drew a conclusion from five marks');
});
