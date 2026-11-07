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

test('the week plan: nothing before week 3, Tue/Thu/Sat after', () => {
  assert.equal(sceneFor(2, 2), null);
  assert.deepEqual(sceneFor(3, 2), { scene: 'ramen', level: 1 });
  assert.equal(sceneFor(3, 3), null, 'Wednesday is a rest day');
  assert.deepEqual(sceneFor(4, 2), { scene: 'train', level: 1 });
  assert.deepEqual(sceneFor(4, 4), { scene: 'train', level: 2 });
  assert.deepEqual(sceneFor(6, 4), { scene: 'ramen', level: 2 });
});

test('the last week: an L3 scene every other day, rotating', () => {
  const days = [49, 50, 51, 52, 53].map((d) => sceneFor(8, 1, d));
  assert.ok(days[0], 'the first day of the last week has one');
  assert.equal(days[1], null);
  assert.equal(days[3], null);
  assert.ok(days[0].level === 3 && days[2].level === 3 && days[0].scene !== days[2].scene);
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
