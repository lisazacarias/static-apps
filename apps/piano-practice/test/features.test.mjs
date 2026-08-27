import { test } from 'node:test';
import assert from 'node:assert';
import { loadApp } from './harness.mjs';

const app = loadApp();
app.S = app.normalize(app.blank());

const cMajorMelody = (bar) => ({
  key: app.keyByName('C'), minor: false, hand: 'right',
  melTonic: app.dOf('C', 4), bars: [bar], bass: null
});

test('leapDown fires for a downward leap of a fourth or more, not an upward one', () => {
  const down = cMajorMelody([
    { d: app.dOf('C', 4), dur: 1 }, { d: app.dOf('G', 3), dur: 1 },
    { d: app.dOf('C', 4), dur: 1 }, { d: app.dOf('C', 4), dur: 1 }
  ]);
  const up = cMajorMelody([
    { d: app.dOf('C', 4), dur: 1 }, { d: app.dOf('G', 4), dur: 1 },
    { d: app.dOf('G', 4), dur: 1 }, { d: app.dOf('G', 4), dur: 1 }
  ]);
  assert.equal(app.barFeatures(down, 0).leapDown, 1, 'a downward fourth should count');
  assert.equal(app.barFeatures(up, 0).leapDown, 0, 'an upward fourth should not count as leapDown');
});

test('leapDown does not fire for a leap smaller than a fourth', () => {
  const smallDown = cMajorMelody([
    { d: app.dOf('C', 4), dur: 1 }, { d: app.dOf('A', 3), dur: 1 },
    { d: app.dOf('C', 4), dur: 1 }, { d: app.dOf('C', 4), dur: 1 }
  ]);
  assert.equal(app.barFeatures(smallDown, 0).leapDown, 0, 'a downward third is not a leap');
});

test('weakFinger fires when a note falls on the 4th or 5th finger', () => {
  const withPinky = cMajorMelody([
    { d: app.dOf('C', 4), dur: 1 }, { d: app.dOf('G', 4), dur: 1 },
    { d: app.dOf('C', 4), dur: 1 }, { d: app.dOf('C', 4), dur: 1 }
  ]);
  const thumbOnly = cMajorMelody([
    { d: app.dOf('C', 4), dur: 1 }, { d: app.dOf('C', 4), dur: 1 },
    { d: app.dOf('C', 4), dur: 1 }, { d: app.dOf('C', 4), dur: 1 }
  ]);
  assert.equal(app.barFeatures(withPinky, 0).weakFinger, 1, 'a note on the 5th finger should count');
  assert.equal(app.barFeatures(thumbOnly, 0).weakFinger, 0, 'a bar played entirely with the thumb should not');
});

test('leapDown and weakFinger are included in the feature list used for stumble analysis', () => {
  const keys = app.FEATURES.map(([k]) => k);
  assert.ok(keys.includes('leapDown'), 'FEATURES should list leapDown');
  assert.ok(keys.includes('weakFinger'), 'FEATURES should list weakFinger');
});
