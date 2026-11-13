// What the tracker asks the state for, and what it knows about one particular election.
//
// The race list is every contest a Hayward voter can see. Races not on the current ballot
// come back empty and stay hidden, so nothing here needs editing between elections.
// The `current` block is different: it was written for one election, and the page only
// uses it while that election is on screen. Outside its window the page falls back to a
// plain title and drops the ballots-counted estimate, short prop names and conflict notes.
// Also tied to `current`, but in index.html: the title, the notice and the Hayward list.

const SOS = 'https://api.sos.ca.gov/returns/';

// Registered voters, from the SoS reports of registration for this election:
// https://elections.cdn.sos.ca.gov/ror/15day-gen-2026/historical-reg-stats.pdf (statewide, Oct 19)
// https://elections.cdn.sos.ca.gov/ror/60day-gen-2026/congressional.pdf (CD 14, Sept 4)
// CHECK: SD 10, AD 20 and BOE 2 are still older counts; the Oct 19 district files
// (elections.cdn.sos.ca.gov/ror/15day-gen-2026/) should have current ones.
const STATEWIDE_REGISTERED = 23273590;

export const ELECTION = {
    current: {
        name: 'November 3, 2026 General',
        // From when the state loads test data (weeks before; API guide v19 shows mid-September
        // timestamps) to past certification on Dec 11.
        start: '2026-09-01',
        end: '2027-01-31',

        // Generals turn out far more voters than primaries (this was 0.35 for June).
        // 61% is Political Data's Nov 2026 projection, per CalMatters:
        // https://calmatters.org/politics/elections/2026/11/live-election-updates/
        // 2018's midterm hit 64.5% (https://www.sos.ca.gov/administration/news-releases-and-advisories/2018-news-releases-and-advisories/california-secretary-state-certifies-november-2018-general-election-results).
        turnout: 0.61,

        // Short labels for the compact prop rows. Mine, paraphrasing each official title; the
        // full title is one tap away under each row. Prop numbers get reused, so these only
        // apply inside the window.
        propShortNames: {
            '1': 'Housing bond', '2': 'Rainy day fund', '3': 'High-income tax extension',
            '4': 'Public campaign funding', '5': 'Statewide recall process',
            '37': 'Middle-income home loans', '38': 'Immunology research bond', '39': 'Voter ID',
            '40': 'One-time billionaire tax', '41': 'Special-tax audits',
            '42': 'No new personal property taxes', '43': 'Two-thirds for local taxes',
            '44': 'Clinic spending rule', '45': 'Environmental review changes'
        },

        // Pairwise, not three-way: 41 and 42 each may conflict with 40, not with each other, and
        // it's for courts to decide whether they do. Per the LAO's analyses of each measure:
        // lao.ca.gov/BallotAnalysis/Proposition?number=42&year=2026 (and number=40, 41)
        propConflicts: { '40': ['41', '42'], '41': ['40'], '42': ['40'] },

        // Race calls, entered by hand. The SoS never calls races (winners are official at
        // certification), and AP's call data is paid. Keys are race keys from `sections`
        // below; props by number. Update `asOf` with each batch.
        calls: {
            source: 'Ballotpedia',
            sourceUrl: 'https://ballotpedia.org/',
            asOf: 'Nov 4, 1:12 p.m.',
            races: {
                governor: 'Xavier Becerra',
                ltGovernor: 'Fiona Ma',
                secretary: 'Shirley Weber',
                attorneyGeneral: 'Rob Bonta',
                controller: 'Malia Cohen',
                treasurer: 'Eleni Kounalakis'
            },
            props: { '1': 'approved', '2': 'approved', '37': 'approved', '39': 'defeated', '44': 'defeated' }
        },

        // Days the county said it will post new results, by end of day (from its results page,
        // alamedacountyca.gov/rovresults/260/, as of Nov 5). The Hayward section names the next one.
        countyUpdates: ['2026-11-06', '2026-11-09', '2026-11-13', '2026-11-16'],

        // Ballots still to count, from the SoS Unprocessed Ballots Report, entered by hand (the
        // page is HTML only). Each figure is Estimated Total Ballots Remaining plus Ballots Left
        // to Cure. CHECK: whether "remaining" already includes ballots awaiting a signature cure;
        // adding both can only overcount, which keeps the badge cautious.
        // Mail postmarked by Election Day counts if it arrives within seven days (by Nov 10, per
        // the report page), and isn't in these numbers until it does. So a report from before
        // `lateMailBy` can't bound what's left, and the badge waits for one dated after it.
        // Update `asOf` (SoS time format) with each new report.
        uncounted: {
            sourceUrl: 'https://electionresults.sos.ca.gov/unprocessed-ballots-status',
            lateMailBy: 'November 10, 2026, 11:59 p.m.',
            asOf: 'November 13, 2026, 10:30 a.m.',
            statewide: 760776 + 107501,
            counties: {
                'Alameda': 9844 + 1382,
                'Santa Clara': 7350 + 3000
            },
            // The report's "Cumulative Total Number of Processed Ballots", same date.
            processed: {
                statewide: 12814411,
                counties: { 'Alameda': 563279, 'Santa Clara': 621548 }
            }
        }
    },

    measures: {
        endpoint: SOS + 'ballot-measures',
        registered: STATEWIDE_REGISTERED,
        ballotpedia: 'https://ballotpedia.org/California_2026_ballot_propositions'
    },

    // In page order. `id` is the container in index.html.
    sections: [
        {
            id: 'federal-races', loading: '⏳ Loading federal results...',
            races: [
                // Presidential years only, and U.S. Senate when a seat is up.
                { key: 'president', name: 'President', endpoint: SOS + 'president',
                  registered: STATEWIDE_REGISTERED },
                { key: 'senate', name: 'U.S. Senate', endpoint: SOS + 'us-senate',
                  registered: STATEWIDE_REGISTERED },
                // CHECK: a partial-term Senate race has its own path the research couldn't
                // confirm (2024 listed "U.S. Senate (Partial/Unexpired Term)" separately).
                { key: 'house14', name: 'U.S. House District 14', endpoint: SOS + 'us-rep/district/14',
                  registered: 425448, counties: ['Alameda'],
                  ballotpedia: 'https://ballotpedia.org/California%27s_14th_Congressional_District_election,_2026' }
            ]
        },
        {
            // dp.electionresults.sos.ca.gov returns HTML for these paths, so api.sos.ca.gov only.
            // Governor and the other constitutional offices are midterm-year races; in
            // presidential years they come back empty and hide.
            id: 'statewide-races', loading: '⏳ Loading statewide results...',
            races: [
                { key: 'governor', name: 'Governor', endpoint: SOS + 'governor' },
                { key: 'ltGovernor', name: 'Lieutenant Governor', endpoint: SOS + 'lieutenant-governor' },
                { key: 'secretary', name: 'Secretary of State', endpoint: SOS + 'secretary-of-state' },
                { key: 'attorneyGeneral', name: 'Attorney General', endpoint: SOS + 'attorney-general' },
                { key: 'insurance', name: 'Insurance Commissioner', endpoint: SOS + 'insurance-commissioner' },
                { key: 'controller', name: 'Controller', endpoint: SOS + 'controller' },
                { key: 'superintendent', name: 'Superintendent of Public Instruction',
                  endpoint: SOS + 'superintendent-of-public-instruction' },
                { key: 'treasurer', name: 'Treasurer', endpoint: SOS + 'treasurer' },
                { key: 'equalization2', name: 'Board of Equalization District 2',
                  endpoint: SOS + 'board-of-equalization/district/2', registered: 5927373 }
            ].map(race => ({ registered: STATEWIDE_REGISTERED, ...race }))
        },
        // `counties` lists every county a district touches, for the "can't be caught" badge
        // (races without it use the statewide count; BOE 2 spans too many counties to bother).
        // CHECK: county lists are from memory of the 2021 maps, not a cited source.
        {
            id: 'legislative-races', loading: '⏳ Loading legislative results...',
            races: [
                { key: 'senate10', name: 'State Senate District 10', endpoint: SOS + 'state-senate/district/10',
                  registered: 531343, counties: ['Alameda', 'Santa Clara'],
                  ballotpedia: 'https://ballotpedia.org/California_State_Senate_District_10' },
                { key: 'assembly20', name: 'State Assembly District 20', endpoint: SOS + 'state-assembly/district/20',
                  registered: 290773, counties: ['Alameda'],
                  ballotpedia: 'https://ballotpedia.org/California_State_Assembly_District_20' }
            ]
        }
    ],

    // Hayward and county races aren't in the state feed. When `current` doesn't apply, the
    // Hayward list in index.html hides and this link goes to the county's elections home.
    countyHome: 'https://acvote.alamedacountyca.gov/'
};
