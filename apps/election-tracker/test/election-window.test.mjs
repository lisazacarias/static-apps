import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  usableFeed, isSameElection, isQuiet, windowActive, monthYear, trimPropTitle,
  SAME_ELECTION_DAYS, QUIET_DAYS,
} from '../results.js';
import { ELECTION } from '../election.js';

const fixture = (name) => JSON.parse(readFileSync(new URL('./fixtures/' + name, import.meta.url)));
const governor = fixture('governor-2026-11-02.json');
const measures = fixture('ballot-measures-2026-11-02.json');
const at = (ReportingTime) => ({ ReportingTime });

test('a race counts as on the ballot only with a non-empty list', () => {
  assert.equal(usableFeed(governor, 'candidates'), true);
  assert.equal(usableFeed(measures, 'ballot-measures'), true);
  assert.equal(usableFeed(measures, 'candidates'), false, 'wrong list');
  assert.equal(usableFeed({ candidates: [] }, 'candidates'), false);
  assert.equal(usableFeed(null, 'candidates'), false, 'blank body, as for /returns/president tonight');
  assert.equal(usableFeed({ candidates: 'x' }, 'candidates'), false);
});

test('feeds well behind the newest one are an earlier election', () => {
  const newest = 'November 3, 2026, 11:42 p.m.';
  assert.equal(isSameElection(governor, newest), true, 'a day earlier');
  assert.equal(isSameElection(at('September 16, 2024, 8:00 a.m.'), newest), false, 'stale 2024 cache');
  assert.equal(isSameElection(at('June 2, 2026, 11:00 p.m.'), newest), false, 'the June primary');
  // late counting stays with its election
  assert.equal(isSameElection(at('November 3, 2026, 9:00 p.m.'), 'December 10, 2026, 4:00 p.m.'), true);
  assert.equal(isSameElection(at('weird'), newest), true, 'unparseable dates are kept');
  assert.equal(isSameElection(governor, ''), true, 'nothing to compare to yet');
  assert.ok(SAME_ELECTION_DAYS > 38 && SAME_ELECTION_DAYS < 120, 'past certification, short of the next election');
});

test('the badge goes quiet after a week with no state update', () => {
  const last = 'December 10, 2026, 4:00 p.m.';
  assert.equal(isQuiet(last, new Date(2026, 11, 12)), false);
  assert.equal(isQuiet(last, new Date(2026, 11, 10 + QUIET_DAYS + 1)), true);
  assert.equal(isQuiet('', new Date()), false, 'no data is Offline, not quiet');
});

test('ELECTION.current applies only while its election is on screen', () => {
  const w = ELECTION.current;
  assert.equal(windowActive(w, 'November 3, 2026, 11:42 p.m.', new Date(2030, 0, 1)), true, 'judged by the feed, not today');
  assert.equal(windowActive(w, governor.ReportingTime, new Date()), true, 'pre-election test data');
  assert.equal(windowActive(w, 'June 6, 2028, 11:10 p.m.', new Date()), false, 'a later election');
  assert.equal(windowActive(w, 'June 2, 2026, 11:00 p.m.', new Date()), false, 'the earlier primary');
  assert.equal(windowActive(w, '', new Date(2026, 10, 3)), true, 'before any feed loads, today decides');
  assert.equal(windowActive(w, '', new Date(2028, 5, 6)), false);
  assert.ok(new Date(w.start) < new Date(w.end));
});

test('generic title month and trimmed prop titles for elections with nothing written', () => {
  assert.equal(monthYear('June 6, 2028, 11:10 p.m.'), 'Jun 2028');
  assert.equal(monthYear('nope'), '');
  assert.equal(trimPropTitle(measures['ballot-measures'][0].Name), 'Authorizes Bonds For Housing Affordability Programs');
  assert.equal(trimPropTitle('Imposes One-Time Tax On Certain Taxpayers. Initiative Constitutional Amendment And Statute.'),
    'Imposes One-Time Tax On Certain Taxpayers');
  assert.equal(trimPropTitle('Plain title'), 'Plain title');
});

test('the race list covers presidential and Senate years too', () => {
  const keys = ELECTION.sections.flatMap(s => s.races.map(r => r.key));
  for (const k of ['president', 'senate', 'house14', 'governor', 'senate10', 'assembly20']) assert.ok(keys.includes(k), k);
  assert.ok(ELECTION.countyHome.startsWith('https://'));
});

test('index.html has the pieces app.js swaps outside the window', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['pageTitle', 'notice', 'localRaces', 'countyLink']) assert.ok(html.includes(`id="${id}"`), id);
});
