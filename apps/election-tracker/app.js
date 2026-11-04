let autoRefreshInterval;
let countdownInterval;
let nextRefreshAt = null;
const REFRESH_MS = 300000;
const CANDIDATES_TO_SHOW = 5;
const MIN_PERCENT_FOR_BAR = 1.0;
const FETCH_TIMEOUT = 20000;
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

    if (raceName && raceName.includes('House District')) {
        estimatedRegisteredVoters = 422557;
    } else if (raceName && raceName.includes('State Senate District')) {
        estimatedRegisteredVoters = 531343;
    } else if (raceName && raceName.includes('State Assembly District')) {
        estimatedRegisteredVoters = 290773;
    } else if (raceName && raceName.includes('Board of Equalization')) {
        estimatedRegisteredVoters = 5927373;
    } else {
        estimatedRegisteredVoters = 23155447;
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

function renderBallotCountStatus(data, reportingTime, raceName) {
    const ballotInfo = estimateBallotsCounted(data, raceName);
    const percentCounted = ballotInfo.percentCounted.toFixed(1);

    let statusBadge = '';
    let statusMessage = '';

    if (ballotInfo.percentCounted < 60) {
        statusBadge = '<span class="status-badge early-count">Early Count</span>';
        statusMessage = 'More ballots being counted';
    } else if (ballotInfo.percentCounted < 90) {
        statusBadge = '<span class="status-badge counting">Counting Continues</span>';
        statusMessage = 'More ballots being counted';
    } else {
        statusBadge = '<span class="status-badge late-count">Late Count</span>';
        statusMessage = 'Final ballots being counted';
    }

    const votesCountedFormatted = ballotInfo.totalVotesCounted.toLocaleString('en-US', {
        maximumFractionDigits: 0
    });

    let expectedVotesDisplay;
    if (ballotInfo.expectedTotalBallots >= 1000000) {
        expectedVotesDisplay = '~' + (ballotInfo.expectedTotalBallots / 1000000).toFixed(1) + 'M expected votes';
    } else {
        expectedVotesDisplay = '~' + (ballotInfo.expectedTotalBallots / 1000).toFixed(0) + 'K expected votes';
    }

    return '<div class="ballot-count-status">' +
        '<div class="ballot-count-inner">' +
            '<div class="ballot-count-pct">~' + percentCounted + '%</div>' +
            '<div class="ballot-count-labels">' +
                '<div class="ballot-count-title">Est. ballots counted</div>' +
                '<div class="ballot-count-sub">' + votesCountedFormatted + ' of ' + expectedVotesDisplay + '</div>' +
            '</div>' +
            statusBadge +
        '</div>' +
        '<div class="ballot-progress">' +
            '<div class="ballot-progress-fill" style="width: ' + percentCounted + '%"></div>' +
        '</div>' +
        // The state's own figure, shown as-is next to the estimate above.
        // CHECK: in an all-mail election, does "precincts reporting" hit 100% on election
        // night while ballots are still being counted? If so it can't replace the estimate.
        (data.Reporting ? '<div class="ballot-count-reporting">State feed: ' + data.Reporting + '</div>' : '') +
        '<div class="ballot-count-footer">' +
            statusMessage + ' · Updated ' + (reportingTime || 'recently') +
        '</div>' +
    '</div>';
}

async function attemptFetch(url, timeout) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

async function fetchWithTimeout(url, timeout = FETCH_TIMEOUT) {
    try {
        return await attemptFetch(url, timeout);
    } catch (err) {
        if (err.name === 'AbortError') throw err;
        // CORS error — retry via proxy (used on GitHub Pages)
        return await attemptFetch(CORS_PROXY + encodeURIComponent(url), timeout);
    }
}

async function tryEndpoints(raceName, endpoints) {
    for (const endpoint of endpoints) {
        try {
            console.log('Trying endpoint:', endpoint);
            const response = await fetchWithTimeout(endpoint);

            if (response.ok) {
                const data = await response.json();
                console.log('Success:', endpoint);
                return { success: true, data, endpoint };
            } else {
                console.log('Failed:', endpoint, response.status);
            }
        } catch (err) {
            console.log('Error:', endpoint, err.message);
        }
    }

    return { success: false };
}

function renderLinkOnlyRace(raceName, ballotpediaUrl = null) {
    return '<div class="race">' +
        '<div class="race-header">' +
            '<div class="race-title">' + raceName + '</div>' +
        '</div>' +
        '<p class="race-link-only-text">Results not yet available — view on official sources:</p>' +
        '<div style="display: flex; gap: 8px; flex-wrap: wrap;">' +
            '<a href="https://electionresults.sos.ca.gov/" target="_blank" class="link-button">CA Secretary of State →</a>' +
            (ballotpediaUrl ? '<a href="' + ballotpediaUrl + '" target="_blank" class="link-button ballotpedia">Ballotpedia →</a>' : '') +
        '</div>' +
    '</div>';
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

function renderRace(raceName, data) {
    let candidates = data.candidates || [];
    let reportingTime = data.ReportingTime || '';

    if (!candidates || candidates.length === 0) {
        return renderLinkOnlyRace(raceName);
    }

    const sortedCandidates = [...candidates].sort((a, b) =>
        parseVotes(b.Votes) - parseVotes(a.Votes)
    );

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
function renderMeasure(m) {
    const number = String(parseInt(m.Number, 10) || m.Number || '');
    const name = m.Name || '';
    const yesPct = parsePercent(m.yesPercent);
    const noPct = parsePercent(m.noPercent);
    const yesVotes = m.yesVotes || '0';
    const noVotes = m.noVotes || '0';
    // CHECK: every Nov 2026 prop is a simple majority on statewide yes/no, right?
    // Bond and tax measures still pass on 50%+1 at the state level, as far as I know.
    const yesLeads = parseVotes(yesVotes) > parseVotes(noVotes);
    const noLeads = parseVotes(noVotes) > parseVotes(yesVotes);

    const row = (label, votes, pct, leading) =>
        '<div class="candidate ' + (leading ? 'top-candidate' : '') + '">' +
            '<div class="candidate-info">' +
                '<div class="candidate-name">' + label + '</div>' +
                '<div class="votes">' +
                    '<div class="vote-count">' + votes + '</div>' +
                    '<div class="vote-percent">' + pct + '%</div>' +
                '</div>' +
            '</div>' +
            '<div class="progress-bar">' +
                '<div class="progress-fill ' + (leading ? 'leading' : '') + '" style="width: ' + Math.min(pct, 100) + '%"></div>' +
            '</div>' +
        '</div>';

    return '<div class="race">' +
        '<div class="race-header">' +
            '<div class="race-title">Prop ' + number + (name ? ' — ' + name : '') + '</div>' +
        '</div>' +
        row('Yes', yesVotes, yesPct, yesLeads) +
        row('No', noVotes, noPct, noLeads) +
    '</div>';
}

async function fetchMeasureResults() {
    const container = document.getElementById('measure-races');
    showLoading(container, '⏳ Loading propositions...');

    const result = await tryEndpoints('State Propositions', RACE_ENDPOINTS.measures);
    const measures = result.success ? (result.data['ballot-measures'] || []) : [];
    const reporting = result.success && result.data.Reporting
        ? '<div class="ballot-count-footer">' + result.data.Reporting +
            (result.data.ReportingTime ? ' · Updated ' + result.data.ReportingTime : '') + '</div>'
        : '';

    if (measures.length) lastGoodHTML.measures = reporting + measures.map(renderMeasure).join('');
    replaceSection(container, lastGoodHTML.measures ||
        renderLinkOnlyRace('State Propositions', 'https://ballotpedia.org/California_2026_ballot_propositions'));
}

// Each race's last good render, so a refresh that fails or times out keeps the
// results already on screen instead of swapping them for a link-only card.
const lastGoodHTML = {};

// Only the first load shows a spinner. Later refreshes leave the old results up
// until the new ones are ready, then swap them in with any expanded
// "Show all" lists still open.
function showLoading(container, text) {
    if (!container.querySelector('.race')) {
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
    const container = document.getElementById(containerId);
    showLoading(container, loadingText);

    const results = await Promise.all(races.map(race =>
        tryEndpoints(race.name, RACE_ENDPOINTS[race.key])));

    const html = races.map((race, i) => {
        if (results[i].success) {
            lastGoodHTML[race.key] = renderRace(race.name, results[i].data);
        }
        return lastGoodHTML[race.key] || renderLinkOnlyRace(race.name, race.ballotpedia);
    });

    replaceSection(container, html.join(''));
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

function showError(message) {
    const container = document.getElementById('error-container');
    container.innerHTML = '<div class="error">⚠️ ' + message + '</div>';
    setTimeout(function() {
        container.innerHTML = '';
    }, 8000);
}

async function refreshData() {
    document.getElementById('lastUpdate').textContent = 'Updating...';

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

        document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
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