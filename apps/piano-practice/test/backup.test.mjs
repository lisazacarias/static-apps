import { test } from 'node:test';
import assert from 'node:assert';
import { loadApp } from './harness.mjs';

test('normalize converts a pre-wall-clock session slot (left) into spent, without NaN', () => {
  const app = loadApp();
  const s = app.normalize({
    ...app.blank(),
    session: { mins: 10, slots: [
      { id: 'tech', total: 180, left: 60, running: false, startedAt: null, done: false }
    ] }
  });
  assert.equal(s.session.slots[0].spent, 120, 'total minus left should become spent');
  assert.ok(!Number.isNaN(s.session.slots[0].spent));
});

test('normalize banks elapsed wall-clock time for a slot left running, then stops it', () => {
  const app = loadApp();
  const startedAt = Date.now() - 5000;
  const s = app.normalize({
    ...app.blank(),
    session: { mins: 10, slots: [
      { id: 'tech', total: 180, spent: 10, running: true, startedAt, done: false }
    ] }
  });
  const slot = s.session.slots[0];
  assert.ok(slot.spent >= 14.5 && slot.spent <= 16, `expected ~15s banked, got ${slot.spent}`);
  assert.equal(slot.running, false, 'a resumed save should never come back already running');
  assert.equal(slot.startedAt, null);
});

test('normalize clamps banked time to the slot total, even after a long time away', () => {
  const app = loadApp();
  const startedAt = Date.now() - 10 * 3600 * 1000; // ten hours ago
  const s = app.normalize({
    ...app.blank(),
    session: { mins: 5, slots: [
      { id: 'theory', total: 300, spent: 0, running: true, startedAt, done: false }
    ] }
  });
  assert.equal(s.session.slots[0].spent, 300, 'elapsed time should clamp to the slot length, not run past it');
});

test('normalize drops a malformed session instead of crashing on it later', () => {
  const app = loadApp();
  const s = app.normalize({ ...app.blank(), session: { mins: 10 } }); // no slots array
  assert.equal(s.session, null);
});

test('restoring a backup rejects something that is not a progress file', () => {
  const app = loadApp();
  app.S = app.normalize(app.blank());
  app.tab = 'progress';
  app.render();

  app.store.importtext = { value: JSON.stringify({ hello: 'world' }) };
  app.store.importgo.onclick();

  assert.ok(/Could not restore/.test(app.store.importmsg.textContent),
    'a JSON object with none of the real shape should be rejected, not silently accepted');
});

test('restoring a backup with a legacy session shape produces real numbers, not a resumed timer', () => {
  const app = loadApp();
  app.S = app.normalize(app.blank());
  app.tab = 'progress';
  app.render();

  const legacyBackup = {
    app: 'piano-practice', version: 1,
    state: {
      sight: { step: 0, passed: {}, history: {} },
      session: { mins: 10, slots: [
        { id: 'tech', total: 180, left: 60, running: true, startedAt: Date.now() - 2000, done: false },
        { id: 'rep', total: 420, left: 420, running: false, startedAt: null, done: false }
      ] }
    }
  };
  app.store.importtext = { value: JSON.stringify(legacyBackup) };
  app.store.importgo.onclick();

  assert.ok(!/Could not restore/.test(app.store.importmsg.textContent || ''),
    `a real (if old-shaped) backup should be accepted: ${app.store.importmsg.textContent}`);
  const slot = app.S.session.slots[0];
  assert.ok(!Number.isNaN(slot.spent), 'restored slot time should be a real number');
  assert.equal(slot.running, false, 'a restored session should never come back already running');
});

// The migrations below already exist in normalize() but had no direct test
// pinning them down — each guards a real save shape from an earlier version
// of the app, so a regression here would silently break restoring that era's
// backups rather than fail loudly.
test('normalize maps stage-era check completions onto the first ladder steps', () => {
  const app = loadApp();
  const s = app.normalize({ ...app.blank(), checks: { '1-0': true, '2-0': true } });
  assert.deepEqual(s.sight.passed, { 0: true, 1: true, 2: true, 3: true, 4: true, 5: true });
  assert.equal(s.checks['1-0'], undefined, 'the stage-era field should be consumed, not carried forward');
});

test('normalize clears the old default sight mode and a non-numeric step', () => {
  const app = loadApp();
  const s = app.normalize({ ...app.blank(), sight: { mode: 'major', step: 'three' } });
  assert.equal(s.sight.mode, null);
  assert.equal(s.sight.step, 0);
});

test('normalize drops the pre-window-mastery streaks field', () => {
  const app = loadApp();
  const s = app.normalize({ ...app.blank(), sight: { streaks: { 0: 4 } } });
  assert.equal(s.sight.streaks, undefined);
});

test('a fresh state has never been backed up', () => {
  const app = loadApp();
  const s = app.blank();
  assert.equal(s.lastExported, null);
});

test('downloading a backup records when, so staleness can be judged later', () => {
  const app = loadApp();
  app.S = app.normalize(app.blank());
  app.tab = 'progress';
  app.render();

  assert.ok(/have not downloaded a backup yet/i.test(app.store.logpane.innerHTML),
    'a state that has never been exported should say so');

  app.store.exportbtn.onclick();

  assert.ok(typeof app.S.lastExported === 'number' && app.S.lastExported > 0,
    'exporting should stamp when it happened');
  assert.ok(!/have not downloaded/i.test(app.store.backupstatus.textContent),
    'the status line should update immediately, not just on the next full render');
});

test('a backup older than a month is flagged as worth refreshing', () => {
  const app = loadApp();
  app.S = app.normalize(app.blank());
  app.S.lastExported = Date.now() - 45 * 86400000;
  app.tab = 'progress';
  app.render();
  assert.ok(/45 days ago/.test(app.store.logpane.innerHTML));
  assert.ok(/worth a fresh copy/i.test(app.store.logpane.innerHTML));
});

test('a recent backup is noted without urgency', () => {
  const app = loadApp();
  app.S = app.normalize(app.blank());
  app.S.lastExported = Date.now() - 3 * 86400000;
  app.tab = 'progress';
  app.render();
  assert.ok(/3 days ago/.test(app.store.logpane.innerHTML));
  assert.ok(!/worth a fresh copy/i.test(app.store.logpane.innerHTML));
});
