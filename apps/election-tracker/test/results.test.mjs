import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseVotes, parsePercent, estimateBallotsCounted, shortTime, parseSosTime, latestSosTime,
  sourcesFor, sortByVotes, headToHead, raceGap, propNumber, measureStatus, lastName,
  escapeHtml, escapeFeed, SOS_ORIGIN, NETLIFY_PROXY, CORS_PROXY,
} from '../results.js';

const fixture = (name) => JSON.parse(readFileSync(new URL('./fixtures/' + name, import.meta.url)));
const governor = fixture('governor-2026-11-02.json');
const measures = fixture('ballot-measures-2026-11-02.json');
const cand = (Votes, o = {}) => ({ Name: 'X', Party: 'Dem', Votes, Percent: '0', ...o });

test('vote and percent strings parse, and junk is 0 instead of a crash', () => {
  assert.equal(parseVotes('3,102,400'), 3102400);
  assert.equal(parseVotes('0'), 0);
  assert.equal(parseVotes(undefined), 0);
  assert.equal(parseVotes(null), 0);
  assert.equal(parseVotes(1234), 1234);
  assert.equal(parsePercent('57.4'), 57.4);
  assert.equal(parsePercent(undefined), 0);
});

test('ballots-counted estimate is votes over registered times turnout, capped at 100', () => {
  const data = { candidates: [cand('300'), cand('310')] };
  const est = estimateBallotsCounted(data, 1000, 0.61);
  assert.equal(est.totalVotesCounted, 610);
  assert.equal(est.expectedTotalBallots, 610);
  assert.equal(est.percentCounted, 100);
  assert.equal(estimateBallotsCounted({ candidates: [cand('1,000,000')] }, 1000, 0.5).percentCounted, 100);
  assert.equal(estimateBallotsCounted(governor, 23273590, 0.61).percentCounted, 0);
});

test('SoS times shorten for the page and parse for comparing feeds', () => {
  assert.equal(shortTime('November 3, 2026, 11:42 p.m.'), 'Nov 3, 11:42 p.m.');
  assert.equal(shortTime(governor.ReportingTime), 'Nov 2, 6:28 p.m.');
  assert.equal(shortTime('weird'), 'weird');
  assert.equal(shortTime(undefined), '');

  const t = parseSosTime('November 3, 2026, 11:42 p.m.');
  assert.deepEqual([t.getFullYear(), t.getMonth(), t.getDate(), t.getHours(), t.getMinutes()], [2026, 10, 3, 23, 42]);
  assert.equal(parseSosTime('November 3, 2026, 12:05 a.m.').getHours(), 0);
  assert.equal(parseSosTime('November 3, 2026, 12:05 p.m.').getHours(), 12);
  assert.equal(parseSosTime('soon'), null);
  assert.equal(parseSosTime(undefined), null);
});

test('latestSosTime picks the newest feed by clock, not by string order', () => {
  const feeds = [
    { ReportingTime: 'November 3, 2026, 9:05 p.m.' },
    { ReportingTime: 'November 3, 2026, 11:42 p.m.' },
    { ReportingTime: 'November 3, 2026, 10:30 p.m.' },
    { ReportingTime: 'garbage' },
    {},
  ];
  assert.equal(latestSosTime(feeds), 'November 3, 2026, 11:42 p.m.');
  assert.equal(latestSosTime([{ ReportingTime: 'November 4, 2026, 1:00 a.m.' }, ...feeds]), 'November 4, 2026, 1:00 a.m.');
  assert.equal(latestSosTime([]), '');
});

test('each SoS endpoint is tried direct, then through the Netlify proxy, then allorigins', () => {
  const url = SOS_ORIGIN + 'returns/governor';
  assert.deepEqual(sourcesFor(url), [url, NETLIFY_PROXY + 'returns/governor', CORS_PROXY + encodeURIComponent(url)]);
  assert.ok(!sourcesFor(url)[1].startsWith('/'), 'proxy path must stay relative for GitHub Pages');
  assert.deepEqual(sourcesFor('https://example.org/x'), ['https://example.org/x', CORS_PROXY + encodeURIComponent('https://example.org/x')]);
});

test('candidates sort by votes, not feed order', () => {
  const sorted = sortByVotes([cand('5', { Name: 'B' }), cand('1,200', { Name: 'A' }), cand('90', { Name: 'C' })]);
  assert.deepEqual(sorted.map(c => c.Name), ['A', 'C', 'B']);
  assert.deepEqual(sortByVotes(undefined), []);
});

test('head-to-head: leader, shares, and Too close from counts not rounded percents', () => {
  const h = headToHead(cand('3,102,400', { Percent: '57.4' }), cand('2,302,000', { Percent: '42.6' }));
  assert.ok(h.aLeads && !h.bLeads && !h.tooClose);
  assert.ok(Math.abs(h.shareA - 57.4) < 0.1);

  // 0.98-point gap whose rounded percents (50.5 vs 49.5) would read as a full point
  assert.equal(headToHead(cand('5,049', { Percent: '50.5' }), cand('4,951', { Percent: '49.5' })).tooClose, true);
  assert.equal(headToHead(cand('5,051'), cand('4,949')).tooClose, false);

  const zero = headToHead(governor.candidates[0], governor.candidates[1]);
  assert.deepEqual([zero.aLeads, zero.bLeads, zero.tooClose, zero.shareA, zero.shareB], [false, false, false, 0, 0]);

  const tie = headToHead(cand('100'), cand('100'));
  assert.deepEqual([tie.aLeads, tie.bLeads, tie.tooClose], [false, false, true]);
});

test('glance gap is points of all votes, so a write-in shrinks it like on the card', () => {
  const g = raceGap([cand('40,000', { Name: 'A2' }), cand('60,000', { Name: 'A1' }), cand('3,400', { Name: 'W' })]);
  assert.equal(g.leader.Name, 'A1');
  assert.ok(Math.abs(g.gap - 19.34) < 0.01, String(g.gap));
  assert.equal(raceGap(governor.candidates), null, 'no votes yet');
  assert.equal(raceGap([cand('10')]), null, 'one candidate');
  assert.equal(raceGap([cand('5,049'), cand('4,951')]).tooClose, true);
});

test('props: "01" reads as 1, and status covers no votes, pass, fail and tie', () => {
  assert.deepEqual(measures['ballot-measures'].map(propNumber),
    ['1', '2', '3', '4', '5', '37', '38', '39', '40', '41', '42', '43', '44', '45']);
  assert.equal(measureStatus(measures['ballot-measures'][0]).status, 'none');
  const m = (yesVotes, noVotes) => measureStatus({ yesVotes, noVotes });
  assert.equal(m('6', '4').status, 'pass');
  assert.equal(m('4', '6').status, 'fail');
  assert.equal(m('5', '5').status, 'tie');
  assert.equal(m('6', '4').yesShare, 60);
  assert.equal(m(undefined, undefined).status, 'none');
});

test('lastName takes the last word', () => {
  assert.equal(lastName('Xavier Becerra'), 'Becerra');
  assert.equal(lastName('  Cher '), 'Cher');
});

test('feeds are escaped once on arrival, and parsing still works on the result', () => {
  assert.equal(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`), '&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;');

  const evil = {
    ReportingTime: 'November 3, 2026, 11:42 p.m.',
    candidates: [{ Name: '<img src=x onerror=alert(1)>', Party: 'Dem" onclick="x', Votes: '1,234', incumbent: true }],
    nested: [[{ deep: '<b>' }]],
  };
  const safe = escapeFeed(evil);
  assert.equal(safe.candidates[0].Name, '&lt;img src=x onerror=alert(1)&gt;');
  assert.ok(!safe.candidates[0].Party.includes('"'));
  assert.equal(safe.nested[0][0].deep, '&lt;b&gt;');
  assert.equal(safe.candidates[0].incumbent, true, 'non-strings untouched');
  assert.equal(parseVotes(safe.candidates[0].Votes), 1234);
  assert.equal(shortTime(safe.ReportingTime), 'Nov 3, 11:42 p.m.');
  assert.ok(parseSosTime(safe.ReportingTime));

  // the real feeds contain apostrophes ("State's", "Voters'") and come out readable
  const titles = escapeFeed(measures)['ballot-measures'].map(x => x.Name);
  assert.ok(titles[1].includes('State&#39;s'));
  assert.deepEqual(escapeFeed(governor).candidates.map(c => c.Name), ['Xavier Becerra', 'Steve Hilton']);
});

test('ballots left: sums a district\'s counties, or uses the statewide count', async () => {
  const { uncountedFor } = await import('../results.js');
  const u = { statewide: 1000, counties: { Alameda: 100, 'Santa Clara': 50 } };
  assert.equal(uncountedFor({}, u), 1000);
  assert.equal(uncountedFor({ counties: ['Alameda', 'Santa Clara'] }, u), 150);
  // a county the report doesn't have means no answer, not a too-small one
  assert.equal(uncountedFor({ counties: ['Alameda', 'Marin'] }, u), null);
  assert.equal(uncountedFor({}, null), null);
});

test('a lead is only safe when it beats every ballot left, on a count no older than the report', async () => {
  const { cantBeCaught } = await import('../results.js');
  const mail = 'November 10, 2026, 11:59 p.m.';
  const report = 'November 12, 2026, 12:00 p.m.';
  const later = 'November 12, 2026, 4:10 p.m.';
  assert.equal(cantBeCaught(1001, 1000, later, report, mail), true);
  assert.equal(cantBeCaught(1000, 1000, later, report, mail), false); // a sweep would tie
  assert.equal(cantBeCaught(999, 1000, later, report, mail), false);
  // a count from before the report misses ballots counted in between
  assert.equal(cantBeCaught(5000, 1000, 'November 11, 2026, 9:00 p.m.', report, mail), false);
  assert.equal(cantBeCaught(5000, 1000, '', report, mail), false);
  assert.equal(cantBeCaught(5000, null, later, report, mail), false);
  assert.equal(cantBeCaught(0, 0, later, report, mail), false);
  // a report from before the mail deadline doesn't count ballots still in the mail
  assert.equal(cantBeCaught(5000, 1000, 'November 6, 2026, 4:10 p.m.', 'November 6, 2026, 12:00 p.m.', mail), false);
  assert.equal(cantBeCaught(5000, 1000, later, report, ''), false);
});

test('the next county update is today or the first day after', async () => {
  const { nextUpdateDay } = await import('../results.js');
  const days = ['2026-11-09', '2026-11-06', '2026-11-13'];
  // 11:30 p.m. Nov 6 in California is already Nov 7 in UTC and New York
  assert.equal(nextUpdateDay(days, new Date('2026-11-07T07:30:00Z')), 'Fri, Nov 6');
  assert.equal(nextUpdateDay(days, new Date('2026-11-07T08:30:00Z')), 'Mon, Nov 9');
  assert.equal(nextUpdateDay(days, new Date('2026-11-14T09:00:00Z')), '');
  assert.equal(nextUpdateDay(undefined, new Date()), '');
});
