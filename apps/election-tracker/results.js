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

// Estimated share of expected ballots counted: votes so far over registered voters
// times expected turnout. Both inputs come from election.js.
export function estimateBallotsCounted(data, registered, turnout) {
    const candidates = data.candidates || [];
    const totalVotesCounted = candidates.reduce((sum, c) => {
        return sum + parseVotes(c.Votes || '0');
    }, 0);

    const expectedTotalBallots = registered * turnout;
    const percentCounted = (totalVotesCounted / expectedTotalBallots) * 100;

    return {
        totalVotesCounted,
        expectedTotalBallots,
        percentCounted: Math.min(percentCounted, 100),
        estimatedRegisteredVoters: registered
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
