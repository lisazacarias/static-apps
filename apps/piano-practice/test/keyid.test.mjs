import { test } from 'node:test';
import assert from 'node:assert';
import { loadApp } from './harness.mjs';

test('the key stays hidden until identified, then reveals with fingering', () => {
  const app = loadApp();
  app.S = app.normalize(app.blank());
  app.S.primerSeen = true;
  app.tab = 'sight';
  app.newMelody();
  app.keyIdentified = false;
  app.render();

  const hiddenHtml = app.store.view.innerHTML;
  const label = app.melKeyLabel(app.mel); // e.g. "C major" or "A minor"
  assert.ok(!/NaN|undefined/.test(hiddenHtml), 'unidentified state contains NaN or undefined');
  assert.ok(hiddenHtml.includes('Which key signature is this?'), 'missing the identification challenge');
  // The step ladder's own tooltips list every step's fixed description (e.g.
  // "Right hand, C major"), which legitimately contains key-sounding text
  // regardless of the current melody — a plain whole-page substring check
  // would false-positive on that. Check the three specific spots this feature
  // actually controls instead: the eyebrow, the score's aria-label, and the
  // key-note paragraph's own distinctive punctuation.
  assert.ok(!hiddenHtml.includes(`· ${label} ·`), `eyebrow leaked "${label}"`);
  assert.ok(!hiddenHtml.includes(` in ${label}`), `score aria-label leaked "${label}"`);
  assert.ok(!hiddenHtml.includes(`${label}:`) && !hiddenHtml.includes(`${label} —`),
    `key-note paragraph leaked "${label}"`);
  assert.ok(!hiddenHtml.includes('Where do my fingers go?'), 'fingering diagram should not render before identification');

  app.keyIdentified = true;
  app.render();
  const revealedHtml = app.store.view.innerHTML;
  assert.ok(!/NaN|undefined/.test(revealedHtml), 'identified state contains NaN or undefined');
  assert.ok(revealedHtml.includes('Where do my fingers go?'), 'fingering diagram should render once identified');
  assert.ok(revealedHtml.includes(label), 'key label should show once identified');
});

test('newMelody resets keyIdentified back to false', () => {
  const app = loadApp();
  app.S = app.normalize(app.blank());
  app.keyIdentified = true;
  app.newMelody();
  assert.equal(app.keyIdentified, false, 'a fresh melody should re-hide its key');
});
