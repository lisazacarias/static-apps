// Bump this ?v= with the one in index.html: phones cache imported modules too.
import {
    FETCH_TIMEOUT, parseVotes, parsePercent, estimateBallotsCounted, shortTime, sourcesFor,
    lastName, sortByVotes, headToHead, raceGap, propNumber, measureStatus, latestSosTime,
    escapeHtml, escapeFeed, usableFeed, isSameElection, isQuiet, windowActive, monthYear,
    trimPropTitle, uncountedFor, cantBeCaught
} from './results.js?v=2026-11-06a';
import { ELECTION } from './election.js?v=2026-11-06a';

let autoRefreshInterval;
let countdownInterval;
let nextRefreshAt = null;
const REFRESH_MS = 300000;
const CANDIDATES_TO_SHOW = 5;
const MIN_PERCENT_FOR_BAR = 1.0;

// One slim line per card: the estimate, a thin bar, and when the SoS last updated. The
// precincts figure goes in the tooltip only: a precinct counts as reported once any one
// ballot from it is in, so it can read 100% with many ballots still out
// (electionresults.sos.ca.gov/frequently-asked-questions).
function renderBallotCountStatus(data, reportingTime, registered) {
    const tooltip = data.Reporting
        ? ' title="' + data.Reporting.replace(/precincts reporting/i, 'precincts partially reporting') + '"'
        : '';
    // Voter counts and turnout belong to ELECTION.current; for any other election there's
    // no honest estimate, so only the update time shows.
    if (!currentActive) {
        return '<div class="count-line"' + tooltip + '>' +
            (reportingTime ? '<span>SoS ' + shortTime(reportingTime) + '</span>' : '') + '</div>';
    }
    const ballotInfo = estimateBallotsCounted(data, registered, ELECTION.current.turnout);
    const pct = ballotInfo.percentCounted.toFixed(1);
    return '<div class="count-line"' + tooltip + '>' +
        '<b>~' + pct + '%</b>' +
        '<div class="count-bar"><i style="width: ' + pct + '%"></i></div>' +
        '<span>est. counted' + (reportingTime ? ' · SoS ' + shortTime(reportingTime) : '') + '</span>' +
    '</div>';
}

async function attemptFetch(url, timeout) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        return await fetch(url, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
        });
    } finally {
        clearTimeout(id);
    }
}

// status: 'ok' (usable data), 'empty' (the state answered, but with nothing: not on this
// ballot) or 'unreachable' (no source answered at all).
// A 404 or network error moves on to the next source, since on GitHub Pages the Netlify
// path 404s and a direct request may be blocked (CORS). A 200 that isn't usable JSON is the
// state's answer, so it stops there.
async function tryEndpoints(endpoints, listKey) {
    for (const endpoint of endpoints) {
        for (const url of sourcesFor(endpoint)) {
            let response;
            try {
                response = await attemptFetch(url, FETCH_TIMEOUT);
            } catch (err) {
                console.log('Error:', url, err.name, err.message);
                continue;
            }
            if (!response.ok) {
                console.log('Failed:', url, response.status);
                continue;
            }
            // Reading the body can still fail mid-transfer after a 200; that's a failed source,
            // not an answer, so it moves on too.
            let body;
            try {
                body = await response.text();
            } catch (err) {
                console.log('Error reading:', url, err.name, err.message);
                continue;
            }
            let json = null;
            try { json = JSON.parse(body); } catch { /* blank or HTML: not on the ballot */ }
            return usableFeed(json, listKey)
                ? { status: 'ok', data: escapeFeed(json), endpoint }
                : { status: 'empty', endpoint };
        }
    }

    return { status: 'unreachable' };
}

function renderPendingRow(raceName, ballotpediaUrl = null) {
    return '<div class="pending-row">' +
        '<span class="pending-name">' + raceName + '</span>' +
        '<span class="pending-note">couldn\'t reach the state</span>' +
        '<a href="https://electionresults.sos.ca.gov/" target="_blank">SoS →</a>' +
        (ballotpediaUrl ? '<a href="' + ballotpediaUrl + '" target="_blank">Ballotpedia →</a>' : '') +
    '</div>';
}

function renderPendingBlock(rows) {
    return rows.length ? '<div class="pending">' + rows.join('') + '</div>' : '';
}

function toggleShowAll(raceId) {
    const allCandidates = Array.from(document.querySelectorAll('[data-race="' + raceId + '"]'));
    const extraCandidates = allCandidates.slice(CANDIDATES_TO_SHOW);
    const btn = document.querySelector('[data-race-btn="' + raceId + '"]');
    const collapsedInfo = document.querySelector('[data-collapsed="' + raceId + '"]');

    const isCollapsed = extraCandidates[0] && extraCandidates[0].classList.contains('hidden');

    if (isCollapsed) {
        extraCandidates.forEach(el => el.classList.remove('hidden'));
        btn.textContent = 'Show fewer';
        if (collapsedInfo) collapsedInfo.style.display = 'none';
    } else {
        extraCandidates.forEach(el => el.classList.add('hidden'));
        btn.textContent = 'Show all ' + allCandidates.length + ' candidates';
        if (collapsedInfo) collapsedInfo.style.display = 'block';
    }
}

// Generals are top-two runoffs, so nearly every race is two names on one bar. The bar is
// colored by who's ahead (gold) and who's behind (gray), never by party: Dem-vs-Dem races
// and nonpartisan offices like Superintendent would otherwise be one color or none.
// Party stays as the badge.
function renderHeadToHead(race, data, sorted) {
    const raceName = race.name;
    const [a, b] = sorted;
    const { va, vb, shareA, shareB, aLeads, bLeads, tooClose } = headToHead(a, b);

    const name = (c, leads) =>
        '<span class="' + (leads ? 'lead' : '') + '">' + (c.Name || 'Unknown') +
            (c.Party ? '<span class="party ' + c.Party + '">' + c.Party + '</span>' : '') +
            (c.incumbent ? '<span class="incumbent">Incumbent</span>' : '') +
        '</span>';

    const called = raceCall(race.key);
    const isLocked = !called && locked(race, Math.abs(va - vb), data.ReportingTime);
    const margin = called
        ? '<div class="h2h-margin">Called for <b>' + escapeHtml(called) + '</b> · ' + escapeHtml(calls().source) + '</div>'
        : aLeads || bLeads
        ? '<div class="h2h-margin">' + (aLeads ? a : b).Name + ' leads by <b>' +
            Math.abs(va - vb).toLocaleString('en-US') + '</b>' +
            (isLocked ? ', more than the ' + uncountedFor(race, uncounted()).toLocaleString('en-US') +
                ' ballots left to count' : '') + '</div>'
        : '';

    return '<div class="race h2h">' +
        '<div class="race-header">' +
            '<div class="race-title">' + raceName + '</div>' +
            (raceCall(race.key) ? '<span class="tag yes" title="' + escapeHtml(callTitle()) + '">Called</span>'
                : isLocked ? lockedTag(race, 'yes')
                : tooClose ? '<span class="tag tie">Too close</span>' : '') +
        '</div>' +
        renderBallotCountStatus(data, data.ReportingTime || '', race.registered) +
        '<div class="h2h-names">' + name(a, aLeads) + name(b, bLeads) + '</div>' +
        '<div class="split">' +
            '<i class="' + (aLeads ? 'lead' : 'trail') + '" style="width: ' + shareA + '%"></i>' +
            '<i class="' + (bLeads ? 'lead' : 'trail') + '" style="width: ' + shareB + '%"></i>' +
        '</div>' +
        '<div class="split-labels">' +
            '<span class="' + (aLeads ? 'lead' : '') + '">' + (a.Votes || '0') + ' · ' + parsePercent(a.Percent) + '%</span>' +
            '<span class="' + (bLeads ? 'lead' : '') + '">' + parsePercent(b.Percent) + '% · ' + (b.Votes || '0') + '</span>' +
        '</div>' +
        margin +
    '</div>';
}

function renderRace(race, data) {
    const raceName = race.name;
    let candidates = data.candidates || [];
    let reportingTime = data.ReportingTime || '';

    if (!candidates || candidates.length === 0) {
        return renderPendingBlock([renderPendingRow(raceName)]);
    }

    const sortedCandidates = sortByVotes(candidates);

    // More than two only happens with a qualified write-in; that keeps the full list.
    if (sortedCandidates.length === 2) {
        return renderHeadToHead(race, data, sortedCandidates);
    }

    const raceId = raceName.replace(/\s+/g, '-').toLowerCase();
    const hasManyCandidates = sortedCandidates.length > CANDIDATES_TO_SHOW;

    const ballotCountHTML = renderBallotCountStatus(data, reportingTime, race.registered);

    const candidatesHTML = sortedCandidates
    .map((candidate, index) => {
        const name = candidate.Name || 'Unknown';
        const votes = candidate.Votes || '0';
        const party = candidate.Party || '';
        const percent = parsePercent(candidate.Percent);

        const isTopCandidate = index < CANDIDATES_TO_SHOW;
        const hiddenClass = !isTopCandidate && hasManyCandidates ? 'hidden' : '';
        const topClass = index < 2 ? 'top-candidate' : '';

        const showProgressBar = percent >= MIN_PERCENT_FOR_BAR;
        const compactClass = !showProgressBar ? 'compact-candidate' : '';

        const rankNum = index + 1;
        let rankBadge = '';
        if (index < 2) {
            rankBadge = '<span class="candidate-rank rank-' + rankNum + '">' + rankNum + '</span>';
        }

        const partyBadge = party ? '<span class="party ' + party + '">' + party + '</span>' : '';
        const incumbentBadge = candidate.incumbent ? '<span class="incumbent">Incumbent</span>' : '';

        const progressBar = showProgressBar ?
            '<div class="progress-bar">' +
                '<div class="progress-fill ' + (index === 0 ? 'leading' : '') + '" style="width: ' + Math.min(percent, 100) + '%"></div>' +
            '</div>' : '';

        return '<div class="candidate ' + topClass + ' ' + hiddenClass + ' ' + compactClass + '" data-race="' + raceId + '">' +
            '<div class="candidate-info">' +
                '<div class="candidate-name">' +
                    rankBadge + name + partyBadge + incumbentBadge +
                '</div>' +
                '<div class="votes">' +
                    '<div class="vote-count">' + votes + '</div>' +
                    '<div class="vote-percent">' + percent + '%</div>' +
                '</div>' +
            '</div>' +
            progressBar +
        '</div>';
    })
    .join('');

    const showAllButton = hasManyCandidates ?
        '<button class="show-all-btn" data-race-btn="' + raceId + '" onclick="toggleShowAll(\'' + raceId + '\')">Show all ' + sortedCandidates.length + ' candidates</button>' : '';

    const collapsedInfo = hasManyCandidates ?
        '<div class="collapsed-info" data-collapsed="' + raceId + '">Showing top ' + CANDIDATES_TO_SHOW + ' of ' + sortedCandidates.length + ' candidates</div>' : '';

    // November is the runoff from June's top two, so the note now names the leader.
    const [first, second] = sortedCandidates;
    const margin = first && second ? parseVotes(first.Votes) - parseVotes(second.Votes) : 0;
    const leaderNote = first && second && margin > 0 ?
        '<div class="top-two-note">' +
            '<strong>Leading:</strong> ' + first.Name + (first.Party ? ' (' + first.Party + ')' : '') +
            ' by ' + margin.toLocaleString('en-US') + ' votes' +
        '</div>' : '';

    return '<div class="race">' +
        '<div class="race-header">' +
            '<div class="race-title-section">' +
                '<div class="race-title">' + raceName + '</div>' +
            '</div>' +
            (raceCall(race.key) ? '<span class="tag yes" title="' + escapeHtml(callTitle()) + '">Called · ' +
                escapeHtml(raceCall(race.key)) + '</span>'
                : locked(race, margin, reportingTime) ? lockedTag(race, 'yes') : '') +
            showAllButton +
        '</div>' +
        ballotCountHTML +
        candidatesHTML +
        collapsedInfo +
        leaderNote +
    '</div>';
}

function conflictNote(number) {
    const others = propConflicts()[number];
    if (!others) return '';
    return '<div class="prop-conflict"><strong>May conflict with ' + others.join(' and ') + ':</strong> ' +
        (others.length > 1 ? 'if 40 and either one pass' : 'if both pass') +
        ', courts may apply whichever got more Yes votes.</div>';
}

function renderMeasure(m, reportingTime) {
    const number = propNumber(m);
    const fullName = m.Name || '';
    const shortName = propShortNames()[number] || trimPropTitle(fullName);
    const { yes, no, total, yesShare, status } = measureStatus(m);
    const yesLeads = status === 'pass', noLeads = status === 'fail';
    const called = propCall(number);
    const tag = called ? '<span class="tag ' + (called === 'approved' ? 'yes' : 'no') + '" title="' +
            escapeHtml(callTitle()) + '">' + (called === 'approved' ? 'Approved' : 'Defeated') + '</span>'
        : locked(STATEWIDE, Math.abs(yes - no), reportingTime)
        ? lockedTag(STATEWIDE, yesLeads ? 'yes' : 'no', yesLeads ? 'Will pass' : 'Will fail')
        : {
        none: '<span class="tag tie">No votes yet</span>',
        pass: '<span class="tag yes">Passing</span>',
        fail: '<span class="tag no">Failing</span>',
        tie: '<span class="tag tie">Tied</span>'
    }[status];

    return '<div class="prop" id="prop-' + number + '">' +
        '<div class="prop-top">' +
            '<span class="prop-num">' + number + '</span>' +
            '<span class="prop-name">' + shortName + '</span>' +
            tag +
        '</div>' +
        '<div class="split prop-split">' +
            '<i class="yes" style="width: ' + yesShare + '%"></i>' +
            '<i class="no" style="width: ' + (total ? 100 - yesShare : 0) + '%"></i>' +
        '</div>' +
        '<div class="split-labels prop-labels">' +
            '<span class="' + (yesLeads ? 'lead' : '') + '">Yes ' + parsePercent(m.yesPercent) + '%</span>' +
            '<span class="' + (noLeads ? 'lead' : '') + '">No ' + parsePercent(m.noPercent) + '%</span>' +
        '</div>' +
        conflictNote(number) +
        (fullName ? '<details class="prop-full"><summary>Full title</summary><p>' + fullName + '</p></details>' : '') +
    '</div>';
}

// ── Fetch, then decide what's on screen, then draw ──

// Last usable response per race key (and 'measures'). A refresh that fails keeps these.
const lastGoodData = {};

// The newest ReportingTime across everything loaded. It decides which election is on screen:
// anything more than SAME_ELECTION_DAYS older is from an earlier one and stays hidden.
let newestSos = '';

// Whether ELECTION.current (and the title, notice and Hayward list in index.html) describe
// the election on screen. Before anything loads, judged by today's date.
let currentActive = windowActive(ELECTION.current, '', new Date());

const propShortNames = () => currentActive ? ELECTION.current.propShortNames : {};

// Hand-entered calls (ELECTION.current.calls), only while that election is on screen.
const calls = () => currentActive ? ELECTION.current.calls : null;
const raceCall = key => (calls() && calls().races[key]) || null;
const propCall = number => (calls() && calls().props[number]) || null;
// "as of Nov 4, 1:12 p.m." already ends in a period; don't add a second.
const sentence = text => String(text).replace(/\.?$/, '.');
const callTitle = () => 'Called by ' + calls().source + ', ' + sentence('as of ' + calls().asOf) +
    ' The state doesn\'t call races; results are official at certification.';

// Ballots-left report (ELECTION.current.uncounted), same rule as calls.
const uncounted = () => currentActive ? ELECTION.current.uncounted : null;
// Props are on every ballot, so they use the statewide count.
const STATEWIDE = {};
// The lead is bigger than every ballot left where this race is on the ballot.
function locked(race, lead, feedTime) {
    const u = uncounted();
    return !!u && cantBeCaught(lead, uncountedFor(race, u), feedTime, u.asOf);
}
function lockedTag(race, cls, word = "Can't be caught") {
    const title = 'The lead is bigger than the ' + uncountedFor(race, uncounted()).toLocaleString('en-US') +
        ' ballots the state listed as left to count where this race is on the ballot, as of ' +
        shortTime(uncounted().asOf) + '. Mail arriving through Nov 10 can still add to that.';
    return '<span class="tag ' + cls + '" title="' + escapeHtml(title) + '">' + word + '</span>';
}

const propConflicts = () => currentActive ? ELECTION.current.propConflicts : {};

function onScreen(key) {
    return !!lastGoodData[key] && isSameElection(lastGoodData[key], newestSos);
}

// Only the first load shows a spinner. Later refreshes leave the old results up
// until the new ones are ready, then swap them in with any expanded
// "Show all" lists still open.
function showLoading(container, text) {
    if (!container.querySelector('.race, .pending')) {
        container.innerHTML = '<div class="loading">' + text + '</div>';
    }
}

function replaceSection(container, html) {
    const expanded = Array.from(container.querySelectorAll('[data-race-btn]'))
        .filter(btn => btn.textContent === 'Show fewer')
        .map(btn => btn.dataset.raceBtn);
    container.innerHTML = html;
    expanded.forEach(raceId => {
        if (container.querySelector('[data-race-btn="' + raceId + '"]')) toggleShowAll(raceId);
    });
}

// A section with nothing on this ballot hides, along with its tab.
function setSectionVisible(container, visible) {
    const section = container.closest('.section');
    section.hidden = !visible;
    const tab = document.querySelector('.section-tabs a[href="#' + section.id + '"]');
    if (tab) tab.hidden = !visible;
}

// Every race at once, so one slow endpoint costs one timeout rather than holding up
// every race queued behind it.
async function fetchAll() {
    const measures = tryEndpoints([ELECTION.measures.endpoint], 'ballot-measures');
    const sections = ELECTION.sections.map(section =>
        Promise.all(section.races.map(race => tryEndpoints([race.endpoint], 'candidates'))));
    return { measures: await measures, sections: await Promise.all(sections) };
}

function acceptResults(results) {
    const fresh = [];
    const keep = (key, result) => {
        if (result.status !== 'ok') return;
        lastGoodData[key] = result.data;
        fresh.push(result.data);
    };
    keep('measures', results.measures);
    ELECTION.sections.forEach((section, s) => section.races.forEach((race, r) =>
        keep(race.key, results.sections[s][r])));
    newestSos = latestSosTime(Object.values(lastGoodData));
    currentActive = windowActive(ELECTION.current, newestSos, new Date());
    // Only feeds for the election on screen count toward Live: a stale cached race loading
    // fine while every current one fails is still Offline.
    refreshStats.ok = fresh.filter(d => isSameElection(d, newestSos)).length;
}

function renderMeasures(result) {
    const container = document.getElementById('measure-races');
    if (onScreen('measures')) {
        const data = lastGoodData.measures;
        const measures = data['ballot-measures'];
        // Every prop is on every statewide ballot, so the busiest one stands in for turnout.
        const mostVotes = Math.max(...measures.map(m =>
            parseVotes(m.yesVotes || '0') + parseVotes(m.noVotes || '0')));
        const status = renderBallotCountStatus(
            { candidates: [{ Votes: String(mostVotes) }], Reporting: data.Reporting },
            data.ReportingTime || '', ELECTION.measures.registered);
        replaceSection(container, '<div class="race props">' + status +
            measures.map(m => renderMeasure(m, data.ReportingTime)).join('') + '</div>');
        setSectionVisible(container, true);
    } else if (result.status === 'unreachable') {
        replaceSection(container, renderPendingBlock([
            renderPendingRow('State Propositions', ELECTION.measures.ballotpedia)]));
        setSectionVisible(container, true);
    } else {
        replaceSection(container, '');
        setSectionVisible(container, false);
    }
}

// Races on screen get cards. Races the state couldn't be reached for get a one-line row.
// Races that came back empty aren't on this ballot and don't appear at all.
function renderSection(section, results) {
    const container = document.getElementById(section.id);
    const cards = [];
    const pending = [];
    section.races.forEach((race, i) => {
        if (onScreen(race.key)) {
            cards.push('<div id="race-' + race.key + '" class="race-anchor">' +
                renderRace(race, lastGoodData[race.key]) + '</div>');
        } else if (results[i].status === 'unreachable') {
            pending.push(renderPendingRow(race.name, race.ballotpedia));
        }
    });
    replaceSection(container, cards.join('') + renderPendingBlock(pending));
    setSectionVisible(container, cards.length + pending.length > 0);
}

// The title, notice and Hayward list in index.html are written for ELECTION.current. When
// a different election is on screen, swap in generic versions; swap back if it returns.
const electionChrome = {};

function applyElectionChrome() {
    const title = document.getElementById('pageTitle');
    const notice = document.getElementById('notice');
    const local = document.getElementById('localRaces');
    const county = document.getElementById('countyLink');
    if (!electionChrome.saved) {
        Object.assign(electionChrome, {
            saved: true, title: title.innerHTML, countyHref: county.href, countyText: county.textContent
        });
    }
    if (currentActive) {
        title.innerHTML = electionChrome.title;
        county.href = electionChrome.countyHref;
        county.textContent = electionChrome.countyText;
    } else {
        const when = monthYear(newestSos);
        title.innerHTML = 'Hayward Election Results' + (when ? '<br>Latest: ' + when : '');
        county.href = ELECTION.countyHome;
        county.textContent = 'Alameda County elections →';
    }
    notice.hidden = !currentActive;
    local.hidden = !currentActive;
}

// ── At a glance: one short line per race that has votes, and a chip per prop ──

function glanceRace(race) {
    if (!onScreen(race.key)) return '';
    const g = raceGap(lastGoodData[race.key].candidates);
    if (!g) return '';
    const a = g.leader;
    const called = raceCall(race.key);
    const data = lastGoodData[race.key];
    const sorted = sortByVotes(data.candidates);
    const lead = parseVotes(sorted[0].Votes) - parseVotes(sorted[1].Votes);
    const result = called
        ? '<span class="glance-lead">' + escapeHtml(lastName(called)) + '</span> <span class="glance-called">✓ called</span>'
        : locked(race, lead, data.ReportingTime)
        ? '<span class="glance-lead">' + lastName(a.Name) + '</span> <span class="glance-called">can\'t be caught</span>'
        : g.tooClose
        ? '<span class="tag tie">Too close</span>'
        : '<span class="glance-lead">' + lastName(a.Name) + (a.Party ? ' (' + a.Party + ')' : '') +
          '</span> <span class="glance-margin">+' + g.gap.toFixed(1) + ' pts</span>';
    return '<a class="glance-row" href="#race-' + race.key + '">' +
        '<span class="glance-name">' + race.name + '</span>' + result + '</a>';
}

function glanceProps() {
    if (!onScreen('measures')) return '';
    const measures = lastGoodData.measures['ballot-measures'];
    if (!measures.some(m => measureStatus(m).total > 0)) return '';
    return '<div class="glance-props">' + measures.map(m => {
        const n = propNumber(m);
        const { status } = measureStatus(m);
        const cls = { pass: 'yes', fail: 'no' }[status] || 'tie';
        // No votes in yet reads as a dash, not a tie, matching the card's "No votes yet".
        const called = propCall(n);
        const chipCls = called ? (called === 'approved' ? 'yes' : 'no') : cls;
        const { yes, no } = measureStatus(m);
        const sure = !called && locked(STATEWIDE, Math.abs(yes - no), lastGoodData.measures.ReportingTime);
        const word = called ? (called === 'approved' ? '✓ Yes' : '✓ No')
            : sure ? (status === 'pass' ? '🔒 Yes' : '🔒 No')
            : { pass: 'Pass', fail: 'Fail', tie: 'Tie', none: '–' }[status];
        return '<a class="glance-chip ' + chipCls + '" href="#prop-' + n + '" title="Prop ' + n + ': ' +
            (propShortNames()[n] || '') + '">' + n + ' <b>' + word + '</b></a>';
    }).join('') + '</div>';
}

function renderGlance() {
    const el = document.getElementById('glance');
    const rows = ELECTION.sections.flatMap(section => section.races.map(glanceRace)).join('');
    const props = glanceProps();
    el.hidden = !rows && !props;
    const c = calls();
    const note = c && (Object.keys(c.races).length || Object.keys(c.props).length)
        ? '<div class="glance-note">✓ = called by <a href="' + c.sourceUrl + '" target="_blank">' + escapeHtml(c.source) +
          '</a>, ' + escapeHtml(sentence('as of ' + c.asOf)) + ' The state doesn\'t call races; results are official at certification.' +
          (uncounted() ? ' 🔒 and "can\'t be caught" mean the lead beats every ballot the state <a href="' + uncounted().sourceUrl +
            '" target="_blank">listed as left to count</a> (' + escapeHtml(shortTime(uncounted().asOf)) + ').' : '') + '</div>'
        : '';
    el.innerHTML = '<div class="glance-title">At a glance</div>' + props + rows + note;
}

// ── Freshness: the state's own update time leads; the badge goes Offline when nothing loads ──

// Feeds this refresh that returned results we actually show. An empty list doesn't count,
// since the render code keeps the saved results instead of showing it.
let refreshStats = { ok: 0 };

// Live while the state is updating. Offline when nothing loaded this refresh. Once the state
// has gone QUIET_DAYS without an update (counting done, or between elections), the badge
// says when the last one was instead of claiming Live.
function updateFreshness() {
    const latest = newestSos;
    document.getElementById('sosUpdate').textContent = latest ? shortTime(latest) : '—';
    const offline = refreshStats.ok === 0;
    const quiet = !offline && isQuiet(latest, new Date());
    document.getElementById('liveBadge').classList.toggle('offline', offline || quiet);
    document.getElementById('liveText').textContent = offline
        ? (latest ? 'Offline · showing ' + shortTime(latest) : 'Offline')
        : quiet ? 'Last update ' + shortTime(latest).split(',')[0]
        : 'Live';
}

function showError(message) {
    const container = document.getElementById('error-container');
    container.innerHTML = '<div class="error">⚠️ ' + escapeHtml(message) + '</div>';
    setTimeout(function() {
        container.innerHTML = '';
    }, 8000);
}

// The Refresh button and the 5-minute timer can both fire mid-refresh. A second call
// joins the one in flight, so refreshStats only ever counts one refresh.
let refreshInFlight = null;

function refreshData() {
    if (!refreshInFlight) {
        refreshInFlight = runRefresh().finally(() => { refreshInFlight = null; });
    }
    return refreshInFlight;
}

async function runRefresh() {
    document.getElementById('lastUpdate').textContent = 'Updating...';
    refreshStats = { ok: 0 };

    try {
        showLoading(document.getElementById('measure-races'), '⏳ Loading propositions...');
        ELECTION.sections.forEach(s => showLoading(document.getElementById(s.id), s.loading));

        const results = await fetchAll();
        acceptResults(results);
        renderMeasures(results.measures);
        ELECTION.sections.forEach((section, i) => renderSection(section, results.sections[i]));
        applyElectionChrome();

        document.getElementById('lastUpdate').textContent =
            new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        renderGlance();
        updateFreshness();
        nextRefreshAt = Date.now() + REFRESH_MS;
    } catch (error) {
        showError('Error refreshing data: ' + error.message);
        console.error('Refresh error:', error);
        document.getElementById('lastUpdate').textContent = 'Error - ' + new Date().toLocaleTimeString();
        nextRefreshAt = Date.now() + REFRESH_MS;
    }
}

function updateCountdown() {
    const el = document.getElementById('nextUpdate');
    if (!el || !nextRefreshAt) return;
    const secsLeft = Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000));
    const m = Math.floor(secsLeft / 60);
    const s = String(secsLeft % 60).padStart(2, '0');
    el.textContent = m + ':' + s;
}

function startAutoRefresh() {
    nextRefreshAt = Date.now() + REFRESH_MS;
    updateCountdown();
    autoRefreshInterval = setInterval(refreshData, REFRESH_MS);
    countdownInterval = setInterval(updateCountdown, 1000);
}

window.addEventListener('DOMContentLoaded', function() {
    refreshData();
    startAutoRefresh();
});

window.addEventListener('beforeunload', function() {
    clearInterval(autoRefreshInterval);
    clearInterval(countdownInterval);
});

// Expose functions referenced by inline onclick="" handlers in index.html
// and in dynamically-rendered HTML. Needed because <script type="module">
// does not add top-level declarations to the global/window scope.
window.refreshData = refreshData;
window.toggleShowAll = toggleShowAll;