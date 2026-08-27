import { test } from 'node:test';
import assert from 'node:assert';
import { loadApp } from './harness.mjs';

test('key mode keeps showing the signature after answering, not a blank staff', () => {
  const app = loadApp();
  app.S = app.normalize(app.blank());
  const idx = app.KEYS.findIndex(k => k.name === 'B♭');
  app.drill = { d: null, keyIdx: idx, mode: 'key', minor: false, state: 'no', t0: 0, round: { n: 0, correct: 0, secs: 0 }, done: false };

  app.renderVerdictOnly();
  const svg = app.store['.staffwrap'].innerHTML;

  assert.ok(!/Empty grand staff/.test(svg),
    'regression: renderVerdictOnly redrew a blank staff after answering in key mode');
  assert.equal(svg, app.keySigStaffSVG(app.KEYS[idx], 'no'),
    'key mode should redraw via keySigStaffSVG after answering');
});

test('solfege mode keeps showing the key signature after answering', () => {
  const app = loadApp();
  app.S = app.normalize(app.blank());
  const idx = app.KEYS.findIndex(k => k.name === 'B♭');
  const d = app.dOf('C', 4);
  app.drill = { d, keyIdx: idx, mode: 'solfege', minor: false, state: 'ok', t0: 0, round: { n: 0, correct: 0, secs: 0 }, done: false };

  app.renderVerdictOnly();
  const svg = app.store['.staffwrap'].innerHTML;

  assert.equal(svg, app.solfegeStaffSVG(d, app.KEYS[idx], 'ok'),
    'solfege mode should redraw with its key signature after answering');
});

test('find and name modes still use the plain note staff after answering', () => {
  const app = loadApp();
  app.S = app.normalize(app.blank());
  const d = app.dOf('C', 4);
  app.drill = { d, keyIdx: null, mode: 'name', minor: false, state: 'ok', t0: 0, round: { n: 0, correct: 0, secs: 0 }, done: false };

  app.renderVerdictOnly();
  assert.ok(app.store['.staffwrap'].innerHTML.includes('notehead'));
});
