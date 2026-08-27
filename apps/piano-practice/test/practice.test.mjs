import { test } from 'node:test';
import assert from 'node:assert';
import { loadApp } from './harness.mjs';

test('an active practice session renders real times, not NaN', () => {
  const app = loadApp();
  app.S = app.normalize(app.blank());
  app.tab = 'progress';
  app.startSession(10); // plan: 3 min technique, 7 min repertoire
  app.render();
  const html = app.store.sesspane.innerHTML;
  assert.ok(!/NaN|undefined/.test(html), 'active session contains NaN or undefined');
  assert.ok(html.includes('3:00'), 'first slot should show its full 3:00 allotment');
  assert.ok(html.includes('7:00'), 'second slot should show its full 7:00 allotment');
});

test('pausing a slot banks elapsed wall-clock time, not a countdown', () => {
  const app = loadApp();
  app.S = app.normalize(app.blank());
  app.tab = 'progress';
  app.startSession(10);

  app.toggleSlot(0);
  assert.equal(app.S.session.slots[0].running, true);

  app.S.session.slots[0].startedAt = Date.now() - 5000; // simulate 5s of practice
  app.toggleSlot(0); // pause
  const slot = app.S.session.slots[0];
  assert.equal(slot.running, false);
  assert.ok(slot.spent >= 4.5 && slot.spent <= 6, `expected ~5s banked, got ${slot.spent}`);

  const html = app.store.sesspane.innerHTML;
  assert.ok(html.includes('Resume'), 'a slot with time already spent should offer Resume, not Start');
});

test('an open session is visible and controllable from a tab other than Progress', () => {
  const app = loadApp();
  app.S = app.normalize(app.blank());
  app.S.primerSeen = true;
  app.tab = 'sight';
  app.startSession(10);
  app.newMelody();
  app.render();
  const stripHtml = app.store.now.innerHTML;
  assert.ok(/Technique|Start|Resume/.test(stripHtml), `strip should show session controls, got: ${stripHtml}`);
  assert.ok(!/Do this now/.test(stripHtml), 'an open session should replace the generic directive, not sit beside it');
});

test('toggling a slot from another tab updates the strip without touching that tab\'s own view', () => {
  const app = loadApp();
  app.S = app.normalize(app.blank());
  app.S.primerSeen = true;
  app.tab = 'sight';
  app.startSession(10);
  app.newMelody();
  app.render();
  const sightViewBefore = app.store.view.innerHTML;

  app.toggleSlot(0);

  assert.equal(app.store.view.innerHTML, sightViewBefore,
    'the active tab\'s own view should not be re-rendered just because a session slot toggled');
  assert.ok(/Pause/.test(app.store.now.innerHTML), 'the strip should now offer Pause since the slot is running');
});

test('finishing the last slot lets the generic directive point at logging it in Progress', () => {
  const app = loadApp();
  app.S = app.normalize(app.blank());
  app.S.primerSeen = true; app.S.drill.asked = 40;
  app.tab = 'sight';
  app.startSession(5); // single slot: theory, 5 min
  app.finishSlot(0);
  const a = app.nextAction();
  assert.equal(a.tab, 'progress');
  app.render();
  assert.ok(/Finish the slots, then log it/.test(app.store.now.innerHTML),
    'with every slot done there is nothing left to control, so the strip should fall back to the plain directive');
});

test('an open session points the directive at Progress, since that is where its controls live', () => {
  const app = loadApp();
  app.S = app.normalize(app.blank());
  app.S.primerSeen = true; app.S.drill.asked = 40;
  app.startSession(10);
  const a = app.nextAction();
  assert.equal(a.tab, 'progress');
});
