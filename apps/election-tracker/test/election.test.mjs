import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ELECTION } from '../election.js';
import { propNumber } from '../results.js';

const races = ELECTION.sections.flatMap(s => s.races);
const measures = JSON.parse(readFileSync(new URL('./fixtures/ballot-measures-2026-11-02.json', import.meta.url)))['ballot-measures'];

test('every race has a unique key, a name, an SoS endpoint and a voter count', () => {
  assert.equal(new Set(races.map(r => r.key)).size, races.length);
  for (const r of races) {
    assert.ok(r.name, r.key);
    assert.match(r.endpoint, /^https:\/\/api\.sos\.ca\.gov\/returns\//, r.key);
    assert.ok(Number.isInteger(r.registered) && r.registered > 0, r.key);
  }
  assert.match(ELECTION.measures.endpoint, /\/returns\/ballot-measures$/);
});

test('district races use their own voter counts, statewide races the state total', () => {
  const byKey = Object.fromEntries(races.map(r => [r.key, r.registered]));
  assert.equal(byKey.governor, ELECTION.measures.registered);
  for (const k of ['house14', 'senate10', 'assembly20', 'equalization2']) {
    assert.ok(byKey[k] < byKey.governor, k);
  }
});

test('each section matches a container in index.html, and the page has every tab target', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const s of ELECTION.sections) assert.ok(html.includes(`id="${s.id}"`), s.id);
  for (const href of html.matchAll(/href="#([\w-]+)"/g)) assert.ok(html.includes(`id="${href[1]}"`), href[1]);
});

test('every prop in the real feed has a short name', () => {
  for (const m of measures) assert.ok(ELECTION.current.propShortNames[propNumber(m)], propNumber(m));
});

test('prop conflicts go both ways, and 41 and 42 only conflict with 40', () => {
  const c = ELECTION.current.propConflicts;
  for (const [a, others] of Object.entries(c)) for (const b of others) assert.ok(c[b].includes(a), `${a}<->${b}`);
  assert.deepEqual(c['41'], ['40']);
  assert.deepEqual(c['42'], ['40']);
});

test('turnout is a share, not a percent', () => {
  assert.ok(ELECTION.current.turnout > 0 && ELECTION.current.turnout < 1);
});

test('hand-entered calls name real races and props, with a source and time', () => {
  const c = ELECTION.current.calls;
  assert.ok(c.source && c.asOf && c.sourceUrl.startsWith('https://'));
  const keys = new Set(races.map(r => r.key));
  for (const [key, winner] of Object.entries(c.races)) {
    assert.ok(keys.has(key), key);
    assert.ok(winner.trim().length > 0, key);
  }
  const propNumbers = new Set(measures.map(propNumber));
  for (const [n, result] of Object.entries(c.props)) {
    assert.ok(propNumbers.has(n), 'prop ' + n);
    assert.ok(['approved', 'defeated'].includes(result), 'prop ' + n);
  }
  // the source link is a general one: no street address from a personal ballot page
  assert.ok(!/street=|zip=/.test(c.sourceUrl));
});
