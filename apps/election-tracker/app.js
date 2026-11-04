let autoRefreshInterval;
let countdownInterval;
let nextRefreshAt = null;
const REFRESH_MS = 300000;
const CANDIDATES_TO_SHOW = 5;
const MIN_PERCENT_FOR_BAR = 1.0;
// Under the Netlify proxy's own 26s limit (docs.netlify.com/manage/routing/redirects/rewrites-proxies/).
const FETCH_TIMEOUT = 15000;
const SOS_ORIGIN = 'https://api.sos.ca.gov/';
// Rewritten to api.sos.ca.gov by the rule in /_redirects. Relative, so it resolves under
// apps/election-tracker/. Only exists on the Netlify site; on GitHub Pages it 404s.
const NETLIFY_PROXY = 'sos-api/';
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

const RACE_ENDPOINTS = {
    measures: ['https://api.sos.ca.gov/returns/ballot-measures'],

    house14: ['https://api.sos.ca.gov/returns/us-rep/district/14'],

    // Statewide — dp.electionresults.sos.ca.gov returns HTML for these paths, so api.sos.ca.gov only
    governor: ['https://api.sos.ca.gov/returns/governor'],
    ltGovernor: ['https://api.sos.ca.gov/returns/lieutenant-governor'],
    secretary: ['https://api.sos.ca.gov/returns/secretary-of-state'],
    attorneyGeneral: ['https://api.sos.ca.gov/returns/attorney-general'],
    insurance: ['https://api.sos.ca.gov/returns/insurance-commissioner'],
    controller: ['https://api.sos.ca.gov/returns/controller'],
    treasurer: ['https://api.sos.ca.gov/returns/treasurer'],
    superintendent: ['https://api.sos.ca.gov/returns/superintendent-of-public-instruction'],
    equalization2: ['https://api.sos.ca.gov/returns/board-of-equalization/district/2'],

    senate10: ['https://api.sos.ca.gov/returns/state-senate/district/10'],
    assembly20: ['https://api.sos.ca.gov/returns/state-assembly/district/20']
};

function parseVotes(votesStr) {
    return parseInt(votesStr.replace(/,/g, ''), 10) || 0;
}

function parsePercent(percentStr) {
    return parseFloat(percentStr) || 0;
}

function estimateBallotsCounted(data, raceName) {
    const candidates = data.candidates || [];
    const totalVotesCounted = candidates.reduce((sum, c) => {
        return sum + parseVotes(c.Votes || '0');
    }, 0);

    let estimatedRegisteredVoters;
    // Generals turn out far more voters than primaries (this was 0.35 for June).
    // 61% is Political Data's Nov 2026 projection, per CalMatters:
    // https://calmatters.org/politics/elections/2026/11/live-election-updates/
    // 2018's midterm hit 64.5% (https://www.sos.ca.gov/administration/news-releases-and-advisories/2018-news-releases-and-advisories/california-secretary-state-certifies-november-2018-general-election-results).
    let estimatedTurnout = 0.61;

    // Statewide and CD 14 are from the SoS reports of registration for this election:
    // https://elections.cdn.sos.ca.gov/ror/15day-gen-2026/historical-reg-stats.pdf (Oct 19)
    // https://elections.cdn.sos.ca.gov/ror/60day-gen-2026/congressional.pdf (CD 14, Sept 4)
    // CHECK: SD 10, AD 20 and BOE 2 are still older counts; the Oct 19 district files
    // (elections.cdn.sos.ca.gov/ror/15day-gen-2026/) should have current ones.
    if (raceName && raceName.includes('House District')) {
        estimatedRegisteredVoters = 425448;
    } else if (raceName && raceName.includes('State Senate District')) {
        estimatedRegisteredVoters = 531343;
    } else if (raceName && raceName.includes('State Assembly District')) {
        estimatedRegisteredVoters = 290773;
    } else if (raceName && raceName.includes('Board of Equalization')) {
        estimatedRegisteredVoters = 5927373;
    } else {
        estimatedRegisteredVoters = 23273590;
    }

    const expectedTotalBallots = estimatedRegisteredVoters * estimatedTurnout;
    const percentCounted = (totalVotesCounted / expectedTotalBallots) * 100;

    return {
        totalVotesCounted,
        expectedTotalBallots,
        percentCounted: Math.min(percentCounted, 100),
        estimatedRegisteredVoters
    };
}

// "November 3, 2026, 11:42 p.m." -> "Nov 3, 11:42 p.m." so the line fits on a phone.
function shortTime(t) {
    return t.replace(/^([A-Z][a-z]{2})[a-z]*\.? (\d{1,2}), \d{4},? /, '$1 $2, ');
}

// One slim line per card: the estimate, a thin bar, and when the SoS last updated. The
// precincts figure goes in the tooltip only: a precinct counts as reported once any one
// ballot from it is in, so it can read 100% with many ballots still out
// (electionresults.sos.ca.gov/frequently-asked-questions).
function renderBallotCountStatus(data, reportingTime, raceName) {
    const ballotInfo = estimateBallotsCounted(data, raceName);
    const pct = ballotInfo.percentCounted.toFixed(1);
    const tooltip = data.Reporting
        ? ' title="' + data.Reporting.replace(/precincts reporting/i, 'precincts partially reporting') + '"'
        : '';
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

// Each endpoint is tried through these in order until one returns JSON. Direct only works
// if api.sos.ca.gov sends CORS headers (unconfirmed). The Netlify rewrite is ours and fast.
// allorigins is a free public proxy, last because it's often slow or down. A timeout or
// error moves on to the next one instead of giving up.
// CHECK: Netlify may cache proxied responses that carry an ETag. If results look stale
// on the Netlify site, that's the first suspect.
function sourcesFor(endpoint) {
    const sources = [endpoint];
    if (endpoint.startsWith(SOS_ORIGIN)) {
        sources.push(NETLIFY_PROXY + endpoint.slice(SOS_ORIGIN.length));
    }
    sources.push(CORS_PROXY + encodeURIComponent(endpoint));
    return sources;
}

async function tryEndpoints(raceName, endpoints) {
    for (const endpoint of endpoints) {
        for (const url of sourcesFor(endpoint)) {
            try {
                const response = await attemptFetch(url, FETCH_TIMEOUT);
                if (!response.ok) {
                    console.log('Failed:', url, response.status);
                    continue;
                }
                const data = await response.json();
                return { success: true, data, endpoint };
            } catch (err) {
                console.log('Error:', url, err.name, err.message);
            }
        }
    }

    return { success: false };
}

function renderPendingRow(raceName, ballotpediaUrl = null) {
    return '<div class="pending-row">' +
        '<span class="pending-name">' + raceName + '</span>' +
        '<span class="pending-note">no results yet</span>' +
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

// Under a 1-point gap counts as too close to call. My own cutoff, not an official rule.
const TOO_CLOSE_POINTS = 1;

// Generals are top-two runoffs, so nearly every race is two names on one bar. The bar is
// colored by who's ahead (gold) and who's behind (gray), never by party: Dem-vs-Dem races
// and nonpartisan offices like Superintendent would otherwise be one color or none.
// Party stays as the badge.
function renderHeadToHead(raceName, data, sorted) {
    const [a, b] = sorted;
    const va = parseVotes(a.Votes), vb = parseVotes(b.Votes);
    const total = va + vb;
    const shareA = total ? va / total * 100 : 0;
    const shareB = total ? 100 - shareA : 0;
    const aLeads = va > vb, bLeads = vb > va;
    // From the vote counts, not the feed's rounded Percent: 5,049 to 4,951 is a 0.98-point
    // gap that rounds to 50.5 vs 49.5 and would miss the cutoff.
    const tooClose = total > 0 && Math.abs(shareA - shareB) < TOO_CLOSE_POINTS;

    const name = (c, leads) =>
        '<span class="' + (leads ? 'lead' : '') + '">' + (c.Name || 'Unknown') +
            (c.Party ? '<span class="party ' + c.Party + '">' + c.Party + '</span>' : '') +
            (c.incumbent ? '<span class="incumbent">Incumbent</span>' : '') +
        '</span>';

    const margin = aLeads || bLeads
        ? '<div class="h2h-margin">' + (aLeads ? a : b).Name + ' leads by <b>' +
            Math.abs(va - vb).toLocaleString('en-US') + '</b></div>'
        : '';

    return '<div class="race h2h">' +
        '<div class="race-header">' +
            '<div class="race-title">' + raceName + '</div>' +
            (tooClose ? '<span class="tag tie">Too close</span>' : '') +
        '</div>' +
        renderBallotCountStatus(data, data.ReportingTime || '', raceName) +
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

function renderRace(raceName, data) {
    let candidates = data.candidates || [];
    let reportingTime = data.ReportingTime || '';

    if (!candidates || candidates.length === 0) {
        return renderPendingBlock([renderPendingRow(raceName)]);
    }

    const sortedCandidates = [...candidates].sort((a, b) =>
        parseVotes(b.Votes) - parseVotes(a.Votes)
    );

    // More than two only happens with a qualified write-in; that keeps the full list.
    if (sortedCandidates.length === 2) {
        return renderHeadToHead(raceName, data, sortedCandidates);
    }

    const raceId = raceName.replace(/\s+/g, '-').toLowerCase();
    const hasManyCandidates = sortedCandidates.length > CANDIDATES_TO_SHOW;

    const ballotCountHTML = renderBallotCountStatus(data, reportingTime, raceName);

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
            showAllButton +
        '</div>' +
        ballotCountHTML +
        candidatesHTML +
        collapsedInfo +
        leaderNote +
    '</div>';
}

// Shape confirmed against the live feed on Nov 3, 2026: { Reporting, ReportingTime,
// 'ballot-measures': [{ Name, Number: "01", yesVotes, yesPercent, noVotes, noPercent }] }
// Pairwise, not three-way: 41 and 42 each may conflict with 40, not with each other, and
// it's for courts to decide whether they do. Per the LAO's analyses of each measure:
// lao.ca.gov/BallotAnalysis/Proposition?number=42&year=2026 (and number=40, 41)
const PROP_CONFLICTS = { '40': ['41', '42'], '41': ['40'], '42': ['40'] };

function conflictNote(number) {
    const others = PROP_CONFLICTS[number];
    if (!others) return '';
    return '<div class="prop-conflict"><strong>May conflict with ' + others.join(' and ') + ':</strong> ' +
        (others.length > 1 ? 'if 40 and either one pass' : 'if both pass') +
        ', courts may apply whichever got more Yes votes.</div>';
}

// Short labels for the compact rows. Mine, paraphrasing each official title; the full
// title is one tap away under each row.
const PROP_SHORT_NAMES = {
    '1': 'Housing bond', '2': 'Rainy day fund', '3': 'High-income tax extension',
    '4': 'Public campaign funding', '5': 'Statewide recall process',
    '37': 'Middle-income home loans', '38': 'Immunology research bond', '39': 'Voter ID',
    '40': 'One-time billionaire tax', '41': 'Special-tax audits',
    '42': 'No new personal property taxes', '43': 'Two-thirds for local taxes',
    '44': 'Clinic spending rule', '45': 'Environmental review changes'
};

function renderMeasure(m) {
    const number = String(parseInt(m.Number, 10) || m.Number || '');
    const fullName = m.Name || '';
    const shortName = PROP_SHORT_NAMES[number] ||
        fullName.replace(/\.\s*(Legislative|Initiative)[^.]*\.?$/, '');
    const yes = parseVotes(m.yesVotes || '0');
    const no = parseVotes(m.noVotes || '0');
    const total = yes + no;
    // Every Nov 2026 prop passes on a simple statewide majority (Cal. Const. art. II §10(a),
    // art. XVIII §4; LAO: lao.ca.gov/ballotanalysis/propositions). Props 41 and 42 may each
    // conflict with 40; if a pair both pass, courts may apply the one with more Yes votes
    // (art. II §10(b)). See PROP_CONFLICTS.
    const yesLeads = yes > no;
    const noLeads = no > yes;
    const tag = !total ? '<span class="tag tie">No votes yet</span>'
        : yesLeads ? '<span class="tag yes">Passing</span>'
        : noLeads ? '<span class="tag no">Failing</span>'
        : '<span class="tag tie">Tied</span>';
    const yesShare = total ? yes / total * 100 : 0;

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

async function fetchMeasureResults() {
    const container = document.getElementById('measure-races');
    showLoading(container, '⏳ Loading propositions...');

    const result = await tryEndpoints('State Propositions', RACE_ENDPOINTS.measures);
    const measures = result.success ? (result.data['ballot-measures'] || []) : [];
    if (measures.length) {
        refreshStats.ok++;
        // Every prop is on every statewide ballot, so the busiest one stands in for turnout.
        const mostVotes = Math.max(...measures.map(m =>
            parseVotes(m.yesVotes || '0') + parseVotes(m.noVotes || '0')));
        const status = renderBallotCountStatus(
            { candidates: [{ Votes: String(mostVotes) }], Reporting: result.data.Reporting },
            result.data.ReportingTime || '', 'State Propositions');
        lastGoodData.measures = result.data;
        lastGoodHTML.measures = '<div class="race props">' + status +
            measures.map(renderMeasure).join('') + '</div>';
    }
    replaceSection(container, lastGoodHTML.measures || renderPendingBlock([
        renderPendingRow('State Propositions', 'https://ballotpedia.org/California_2026_ballot_propositions')]));
}

// Each race's last good render, so a refresh that fails or times out keeps the
// results already on screen instead of swapping them for a link-only card.
const lastGoodHTML = {};
const lastGoodData = {};
// Races per section in page order, for the at-a-glance strip.
const sectionRaces = {};

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

// All races in a section are fetched at once, so one slow endpoint costs one
// timeout rather than holding up every race queued behind it.
async function loadSection(containerId, loadingText, races) {
    sectionRaces[containerId] = races;
    const container = document.getElementById(containerId);
    showLoading(container, loadingText);

    const results = await Promise.all(races.map(race =>
        tryEndpoints(race.name, RACE_ENDPOINTS[race.key])));

    const cards = [];
    const pending = [];
    races.forEach((race, i) => {
        // An empty candidate list (a glitchy or reset feed) doesn't replace real results.
        if (results[i].success && (results[i].data.candidates || []).length) {
            refreshStats.ok++;
            lastGoodHTML[race.key] = '<div id="race-' + race.key + '" class="race-anchor">' +
                renderRace(race.name, results[i].data) + '</div>';
            lastGoodData[race.key] = results[i].data;
        }
        if (lastGoodHTML[race.key]) cards.push(lastGoodHTML[race.key]);
        else pending.push(renderPendingRow(race.name, race.ballotpedia));
    });

    replaceSection(container, cards.join('') + renderPendingBlock(pending));
}

function fetchFederalResults() {
    return loadSection('federal-races', '⏳ Loading federal results...', [
        { name: 'U.S. House District 14', key: 'house14',
          ballotpedia: 'https://ballotpedia.org/California%27s_14th_Congressional_District_election,_2026' }
    ]);
}

function fetchStatewideResults() {
    return loadSection('statewide-races', '⏳ Loading statewide results...', [
        { name: 'Governor', key: 'governor' },
        { name: 'Lieutenant Governor', key: 'ltGovernor' },
        { name: 'Secretary of State', key: 'secretary' },
        { name: 'Attorney General', key: 'attorneyGeneral' },
        { name: 'Insurance Commissioner', key: 'insurance' },
        { name: 'Controller', key: 'controller' },
        { name: 'Superintendent of Public Instruction', key: 'superintendent' },
        { name: 'Treasurer', key: 'treasurer' },
        { name: 'Board of Equalization District 2', key: 'equalization2' }
    ]);
}

function fetchLegislativeResults() {
    return loadSection('legislative-races', '⏳ Loading legislative results...', [
        { name: 'State Senate District 10', key: 'senate10',
          ballotpedia: 'https://ballotpedia.org/California_State_Senate_District_10' },
        { name: 'State Assembly District 20', key: 'assembly20',
          ballotpedia: 'https://ballotpedia.org/California_State_Assembly_District_20' }
    ]);
}

// ── At a glance: one short line per race that has votes, and a chip per prop ──

function lastName(name) {
    const parts = String(name || '').trim().split(/\s+/);
    return parts[parts.length - 1] || name;
}

function glanceRace(race) {
    const data = lastGoodData[race.key];
    if (!data) return '';
    const sorted = [...(data.candidates || [])].sort((a, b) => parseVotes(b.Votes) - parseVotes(a.Votes));
    const [a, b] = sorted;
    if (!a || !b) return '';
    const va = parseVotes(a.Votes), vb = parseVotes(b.Votes);
    if (!va && !vb) return '';
    // Points of all votes cast in the race, so it matches the percentages on the card
    // (for two candidates that's the same math as renderHeadToHead).
    const total = sorted.reduce((sum, c) => sum + parseVotes(c.Votes), 0);
    const gap = Math.abs(va - vb) / total * 100;
    const result = gap < TOO_CLOSE_POINTS
        ? '<span class="tag tie">Too close</span>'
        : '<span class="glance-lead">' + lastName(a.Name) + (a.Party ? ' (' + a.Party + ')' : '') +
          '</span> <span class="glance-margin">+' + gap.toFixed(1) + ' pts</span>';
    return '<a class="glance-row" href="#race-' + race.key + '">' +
        '<span class="glance-name">' + race.name + '</span>' + result + '</a>';
}

function glanceProps() {
    const measures = (lastGoodData.measures || {})['ballot-measures'] || [];
    if (!measures.some(m => parseVotes(m.yesVotes || '0') + parseVotes(m.noVotes || '0') > 0)) return '';
    return '<div class="glance-props">' + measures.map(m => {
        const n = String(parseInt(m.Number, 10) || m.Number || '');
        const yes = parseVotes(m.yesVotes || '0'), no = parseVotes(m.noVotes || '0');
        const cls = yes > no ? 'yes' : no > yes ? 'no' : 'tie';
        // No votes in yet reads as a dash, not a tie, matching the card's "No votes yet".
        const word = yes > no ? 'Pass' : no > yes ? 'Fail' : yes ? 'Tie' : '–';
        return '<a class="glance-chip ' + cls + '" href="#prop-' + n + '" title="Prop ' + n + ': ' +
            (PROP_SHORT_NAMES[n] || '') + '">' + n + ' <b>' + word + '</b></a>';
    }).join('') + '</div>';
}

const GLANCE_SECTIONS = ['federal-races', 'statewide-races', 'legislative-races'];

function renderGlance() {
    const el = document.getElementById('glance');
    const rows = GLANCE_SECTIONS.flatMap(id => (sectionRaces[id] || []).map(glanceRace)).join('');
    const props = glanceProps();
    el.hidden = !rows && !props;
    el.innerHTML = '<div class="glance-title">At a glance</div>' + props + rows;
}

// ── Freshness: the state's own update time leads; the badge goes Offline when nothing loads ──

// Feeds this refresh that returned results we actually show. An empty list doesn't count,
// since the render code keeps the saved results instead of showing it.
let refreshStats = { ok: 0 };

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// "November 3, 2026, 11:42 p.m." -> a Date, so feeds can be compared. null if it doesn't parse.
function parseSosTime(t) {
    const m = String(t || '').match(/^([A-Za-z]+)\.? (\d{1,2}), (\d{4}),? (\d{1,2}):(\d{2}) ?([ap])\.?m\.?/i);
    if (!m) return null;
    const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
    if (month < 0) return null;
    let hour = parseInt(m[4], 10) % 12;
    if (m[6].toLowerCase() === 'p') hour += 12;
    return new Date(parseInt(m[3], 10), month, parseInt(m[2], 10), hour, parseInt(m[5], 10));
}

function latestSosTime() {
    let best = null, bestText = '';
    Object.values(lastGoodData).forEach(d => {
        const when = parseSosTime(d.ReportingTime);
        if (when && (!best || when > best)) { best = when; bestText = d.ReportingTime; }
    });
    return bestText;
}

function updateFreshness() {
    const latest = latestSosTime();
    document.getElementById('sosUpdate').textContent = latest ? shortTime(latest) : '—';
    const offline = refreshStats.ok === 0;
    document.getElementById('liveBadge').classList.toggle('offline', offline);
    document.getElementById('liveText').textContent = offline
        ? (latest ? 'Offline · showing ' + shortTime(latest) : 'Offline')
        : 'Live';
}

function showError(message) {
    const container = document.getElementById('error-container');
    container.innerHTML = '<div class="error">⚠️ ' + message + '</div>';
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
        // Fetch all sections but don't wait for failures
        const results = await Promise.allSettled([
            fetchMeasureResults(),
            fetchFederalResults(),
            fetchStatewideResults(),
            fetchLegislativeResults()
        ]);

        // Check if any failed
        const failures = results.filter(r => r.status === 'rejected');
        if (failures.length > 0) {
            console.error('Some sections failed to load:', failures);
        }

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