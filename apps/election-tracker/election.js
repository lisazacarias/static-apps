// Everything specific to one election, in one place. For the next election, start here.
// Also per-election, but in index.html: the page title, the certification dates in the
// notice, and the Hayward race list.

const SOS = 'https://api.sos.ca.gov/returns/';

// Registered voters, from the SoS reports of registration for this election:
// https://elections.cdn.sos.ca.gov/ror/15day-gen-2026/historical-reg-stats.pdf (statewide, Oct 19)
// https://elections.cdn.sos.ca.gov/ror/60day-gen-2026/congressional.pdf (CD 14, Sept 4)
// CHECK: SD 10, AD 20 and BOE 2 are still older counts; the Oct 19 district files
// (elections.cdn.sos.ca.gov/ror/15day-gen-2026/) should have current ones.
const STATEWIDE_REGISTERED = 23273590;

export const ELECTION = {
    // Generals turn out far more voters than primaries (this was 0.35 for June).
    // 61% is Political Data's Nov 2026 projection, per CalMatters:
    // https://calmatters.org/politics/elections/2026/11/live-election-updates/
    // 2018's midterm hit 64.5% (https://www.sos.ca.gov/administration/news-releases-and-advisories/2018-news-releases-and-advisories/california-secretary-state-certifies-november-2018-general-election-results).
    turnout: 0.61,

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
                { key: 'house14', name: 'U.S. House District 14', endpoint: SOS + 'us-rep/district/14',
                  registered: 425448,
                  ballotpedia: 'https://ballotpedia.org/California%27s_14th_Congressional_District_election,_2026' }
            ]
        },
        {
            // dp.electionresults.sos.ca.gov returns HTML for these paths, so api.sos.ca.gov only
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
        {
            id: 'legislative-races', loading: '⏳ Loading legislative results...',
            races: [
                { key: 'senate10', name: 'State Senate District 10', endpoint: SOS + 'state-senate/district/10',
                  registered: 531343,
                  ballotpedia: 'https://ballotpedia.org/California_State_Senate_District_10' },
                { key: 'assembly20', name: 'State Assembly District 20', endpoint: SOS + 'state-assembly/district/20',
                  registered: 290773,
                  ballotpedia: 'https://ballotpedia.org/California_State_Assembly_District_20' }
            ]
        }
    ],

    // Short labels for the compact prop rows. Mine, paraphrasing each official title; the
    // full title is one tap away under each row.
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
    propConflicts: { '40': ['41', '42'], '41': ['40'], '42': ['40'] }
};
