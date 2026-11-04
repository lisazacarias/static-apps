// DOM-free pieces of the election tracker, so Node tests can import the shipped file.
// app.js does the fetching and the page; everything here is plain data in, data out.

// Under the Netlify proxy's own 26s limit (docs.netlify.com/manage/routing/redirects/rewrites-proxies/).
export const FETCH_TIMEOUT = 15000;
export const SOS_ORIGIN = 'https://api.sos.ca.gov/';
// Rewritten to api.sos.ca.gov by the rule in /_redirects. Relative, so it resolves under
// apps/election-tracker/. Only exists on the Netlify site; on GitHub Pages it 404s.
export const NETLIFY_PROXY = 'sos-api/';
export const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

export function parseVotes(votesStr) {
    return parseInt(votesStr.replace(/,/g, ''), 10) || 0;
}

export function parsePercent(percentStr) {
    return parseFloat(percentStr) || 0;
}

export function estimateBallotsCounted(data, raceName) {
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
export function shortTime(t) {
    return t.replace(/^([A-Z][a-z]{2})[a-z]*\.? (\d{1,2}), \d{4},? /, '$1 $2, ');
}

// Each endpoint is tried through these in order until one returns JSON. Direct only works
// if api.sos.ca.gov sends CORS headers (unconfirmed). The Netlify rewrite is ours and fast.
// allorigins is a free public proxy, last because it's often slow or down. A timeout or
// error moves on to the next one instead of giving up.
// CHECK: Netlify may cache proxied responses that carry an ETag. If results look stale
// on the Netlify site, that's the first suspect.
export function sourcesFor(endpoint) {
    const sources = [endpoint];
    if (endpoint.startsWith(SOS_ORIGIN)) {
        sources.push(NETLIFY_PROXY + endpoint.slice(SOS_ORIGIN.length));
    }
    sources.push(CORS_PROXY + encodeURIComponent(endpoint));
    return sources;
}

// Under a 1-point gap counts as too close to call. My own cutoff, not an official rule.
export const TOO_CLOSE_POINTS = 1;

// Shape confirmed against the live feed on Nov 3, 2026: { Reporting, ReportingTime,
// 'ballot-measures': [{ Name, Number: "01", yesVotes, yesPercent, noVotes, noPercent }] }
// Pairwise, not three-way: 41 and 42 each may conflict with 40, not with each other, and
// it's for courts to decide whether they do. Per the LAO's analyses of each measure:
// lao.ca.gov/BallotAnalysis/Proposition?number=42&year=2026 (and number=40, 41)
export const PROP_CONFLICTS = { '40': ['41', '42'], '41': ['40'], '42': ['40'] };

// Short labels for the compact rows. Mine, paraphrasing each official title; the full
// title is one tap away under each row.
export const PROP_SHORT_NAMES = {
    '1': 'Housing bond', '2': 'Rainy day fund', '3': 'High-income tax extension',
    '4': 'Public campaign funding', '5': 'Statewide recall process',
    '37': 'Middle-income home loans', '38': 'Immunology research bond', '39': 'Voter ID',
    '40': 'One-time billionaire tax', '41': 'Special-tax audits',
    '42': 'No new personal property taxes', '43': 'Two-thirds for local taxes',
    '44': 'Clinic spending rule', '45': 'Environmental review changes'
};

export function lastName(name) {
    const parts = String(name || '').trim().split(/\s+/);
    return parts[parts.length - 1] || name;
}

export const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// "November 3, 2026, 11:42 p.m." -> a Date, so feeds can be compared. null if it doesn't parse.
export function parseSosTime(t) {
    const m = String(t || '').match(/^([A-Za-z]+)\.? (\d{1,2}), (\d{4}),? (\d{1,2}):(\d{2}) ?([ap])\.?m\.?/i);
    if (!m) return null;
    const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
    if (month < 0) return null;
    let hour = parseInt(m[4], 10) % 12;
    if (m[6].toLowerCase() === 'p') hour += 12;
    return new Date(parseInt(m[3], 10), month, parseInt(m[2], 10), hour, parseInt(m[5], 10));
}
