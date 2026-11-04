// DOM-free pieces of the election tracker, so Node tests can import the shipped file.
// app.js does the fetching and the page; everything here is plain data in, data out.

// Under the Netlify proxy's own 26s limit (docs.netlify.com/manage/routing/redirects/rewrites-proxies/).
export const FETCH_TIMEOUT = 15000;
export const SOS_ORIGIN = 'https://api.sos.ca.gov/';
// Rewritten to api.sos.ca.gov by the rule in /_redirects. Relative, so it resolves under
// apps/election-tracker/. Only exists on the Netlify site; on GitHub Pages it 404s.
export const NETLIFY_PROXY = 'sos-api/';
export const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

// "1,234" -> 1234. Anything missing or odd is 0 rather than a crash.
export function parseVotes(votesStr) {
    return parseInt(String(votesStr ?? '').replace(/,/g, ''), 10) || 0;
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
    return String(t ?? '').replace(/^([A-Z][a-z]{2})[a-z]*\.? (\d{1,2}), \d{4},? /, '$1 $2, ');
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

// ── Race and prop math, kept apart from the HTML so it can be tested ──

export function sortByVotes(candidates) {
    return [...(candidates || [])].sort((a, b) => parseVotes(b.Votes) - parseVotes(a.Votes));
}

// Two-candidate race. Shares come from the vote counts, not the feed's rounded Percent:
// 5,049 to 4,951 is a 0.98-point gap that rounds to 50.5 vs 49.5 and would miss the cutoff.
export function headToHead(a, b) {
    const va = parseVotes(a.Votes), vb = parseVotes(b.Votes);
    const total = va + vb;
    const shareA = total ? va / total * 100 : 0;
    const shareB = total ? 100 - shareA : 0;
    return {
        va, vb, shareA, shareB,
        aLeads: va > vb, bLeads: vb > va,
        tooClose: total > 0 && Math.abs(shareA - shareB) < TOO_CLOSE_POINTS
    };
}

// Leader and margin for the at-a-glance line, in points of all votes cast in the race so it
// matches the card's percentages (for two candidates, the same math as headToHead).
// null when there aren't two candidates or no votes yet.
export function raceGap(candidates) {
    const sorted = sortByVotes(candidates);
    const [a, b] = sorted;
    if (!a || !b) return null;
    const va = parseVotes(a.Votes), vb = parseVotes(b.Votes);
    if (!va && !vb) return null;
    const total = sorted.reduce((sum, c) => sum + parseVotes(c.Votes), 0);
    const gap = Math.abs(va - vb) / total * 100;
    return { leader: a, gap, tooClose: gap < TOO_CLOSE_POINTS };
}

// The feed numbers props "01"; the page says Prop 1.
export function propNumber(m) {
    return String(parseInt(m.Number, 10) || m.Number || '');
}

// Every Nov 2026 prop passes on a simple statewide majority (Cal. Const. art. II §10(a),
// art. XVIII §4; LAO: lao.ca.gov/ballotanalysis/propositions). Props 41 and 42 may each
// conflict with 40; if a pair both pass, courts may apply the one with more Yes votes
// (art. II §10(b)). See ELECTION.propConflicts.
// status: 'none' (no votes yet), 'pass', 'fail' or 'tie'.
export function measureStatus(m) {
    const yes = parseVotes(m.yesVotes), no = parseVotes(m.noVotes);
    const total = yes + no;
    return {
        yes, no, total,
        yesShare: total ? yes / total * 100 : 0,
        status: !total ? 'none' : yes > no ? 'pass' : no > yes ? 'fail' : 'tie'
    };
}

// The newest ReportingTime across feeds, as the feed wrote it. '' if none parse.
export function latestSosTime(feeds) {
    let best = null, bestText = '';
    feeds.forEach(d => {
        const when = parseSosTime(d && d.ReportingTime);
        if (when && (!best || when > best)) { best = when; bestText = d.ReportingTime; }
    });
    return bestText;
}

// ── Escaping ──

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
}

// Every string in a feed response, escaped once as it arrives. The renderers build HTML by
// string concatenation, and a feed can come through a third-party proxy (allorigins), so
// nothing from it should reach the page as markup. Doing it here means no renderer can
// forget. Numbers like "1,234" and times like "November 3, 2026, 11:42 p.m." pass through
// unchanged, so parsing still works.
export function escapeFeed(value) {
    if (typeof value === 'string') return escapeHtml(value);
    if (Array.isArray(value)) return value.map(escapeFeed);
    if (value && typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) out[k] = escapeFeed(v);
        return out;
    }
    return value;
}
