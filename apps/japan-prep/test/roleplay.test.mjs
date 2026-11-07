import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCENES, LEVELS, promptFor, sceneFor, claudeUrl, tripWhen } from '../roleplay.js';

test('every scene builds a prompt at every level', () => {
  for (const s of SCENES) {
    for (const lv of Object.keys(LEVELS)) {
      const p = promptFor(s.id, Number(lv));
      assert.ok(p.includes(s.goal), `${s.id} L${lv} states the goal`);
      assert.ok(p.includes(`Level ${lv}:`), `${s.id} L${lv} states the level`);
      assert.ok(p.includes('— end of scene —'), 'asks for feedback at the end');
      assert.ok(p.includes('Never use casual or anime-style speech'), 'keeps the polite register');
    }
  }
  assert.throws(() => promptFor('ramen', 4));
  assert.throws(() => promptFor('sushi', 1));
});

test('levels differ in what help they give', () => {
  assert.match(promptFor('ramen', 1), /3 short reply options/);
  assert.match(promptFor('ramen', 2), /2 short reply hints/);
  assert.match(promptFor('ramen', 3), /No romaji, no English/);
});

// Nov 9 start, Jan 25 trip: week w, weekday wd, n days out.
const at = (week, weekday, daysLeft) => sceneFor({ week, weekday, daysLeft });

test('weeks 3–6: one scene a week on Tue/Thu/Sat, L1 then L2', () => {
  assert.equal(at(2, 2, 63), null);
  assert.deepEqual(at(3, 2, 61), { scene: 'ramen', level: 1 });
  assert.equal(at(3, 3, 60), null, 'Wednesday is a rest day');
  assert.deepEqual(at(4, 2, 54), { scene: 'train', level: 1 });
  assert.deepEqual(at(4, 4, 52), { scene: 'train', level: 2 });
  assert.deepEqual(at(6, 4, 38), { scene: 'ramen', level: 2 });
});

test('weeks 7–8 rotate all five scenes at L2, weeks 9–10 at L3', () => {
  const w78 = [[2, 33], [4, 31], [6, 29], [2, 26], [4, 24]].map(([wd, left]) => at(7, wd, left));
  assert.ok(w78.every((p) => p.level === 2));
  assert.equal(new Set(w78.map((p) => p.scene)).size, 5, 'all five scenes');
  const w910 = [[2, 19], [4, 17], [6, 15], [2, 12], [4, 10], [6, 8]].map(([wd, left]) => at(9, wd, left));
  assert.ok(w910.every((p) => p.level === 3));
  assert.equal(new Set(w910.map((p) => p.scene)).size, 5);
  assert.equal(at(9, 3, 18), null, 'still only Tue/Thu/Sat');
});

test('week 11: an L3 scene every other day, rotating; none after the trip', () => {
  const last = [7, 6, 5, 4, 3, 2, 1, 0].map((left) => at(11, 1, left));
  assert.deepEqual(last.map((p) => p && p.level), [3, null, 3, null, 3, null, 3, null]);
  assert.equal(new Set(last.filter(Boolean).map((p) => p.scene)).size, 4);
  assert.equal(at(12, 2, -1), null);
});

test('the Claude link carries the whole prompt', () => {
  const p = promptFor('konbini', 2);
  const u = new URL(claudeUrl(p));
  assert.equal(u.origin + u.pathname, 'https://claude.ai/new');
  assert.equal(u.searchParams.get('q'), p);
});

test('the scene is set at the trip date', () => {
  assert.equal(tripWhen('2027-01-25'), 'late January');
  assert.equal(tripWhen('2027-01-05'), 'early January');
  assert.equal(tripWhen('2027-03-15'), 'mid March');
  assert.match(promptFor('hotel', 1, '2027-01-25'), /visiting Japan in late January/);
  assert.doesNotMatch(promptFor('hotel', 1, '2027-01-25'), /early January/);
});

test('weeks 7–10 rotate through all five scenes whatever weekday the trip is on', () => {
  for (const trip of ['2027-01-25', '2027-01-27', '2027-01-29', '2027-01-31']) {
    const t = new Date(`${trip}T12:00`);
    const seen = [];
    for (let left = 35; left >= 8; left--) {
      const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - left);
      const p = sceneFor({ week: 7, weekday: d.getDay(), daysLeft: left });
      if (p) seen.push(p.scene);
    }
    assert.equal(seen.length, 12, `${trip}: 12 roleplay days in weeks 7–10`);
    for (let i = 0; i + 5 <= seen.length; i += 5) {
      assert.equal(new Set(seen.slice(i, i + 5)).size, 5, `${trip}: no repeats within a round: ${seen.join(',')}`);
    }
  }
});
