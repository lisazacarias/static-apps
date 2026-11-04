# election-tracker

Live results for Hayward voters from the California Secretary of State's results feed
(`api.sos.ca.gov`), plus links out for the Hayward and Alameda County races the state
doesn't carry.

- `election.js`: every race a Hayward voter can see. Races not on the current ballot come
  back empty and hide, and results from an earlier election (judged by `ReportingTime`)
  hide too, so the race list doesn't need editing between elections. `ELECTION.current`
  holds what's written for one election (turnout, prop short names and conflicts) with a
  date window; the title, notice and Hayward list in `index.html` go with it. Outside the
  window the page falls back to generic versions. To dress up a new election, update
  `current` and those three bits of `index.html`.
- Not automatic: Hayward and county races (no readable county feed), registered voters
  (state PDFs), and `/special/...` contests like the Aug 2026 CD 14 special.
- `results.js`: parsing and race/prop math with no DOM, so tests import it directly.
- `app.js`: fetching (direct, then the Netlify rewrite in `/_redirects`, then allorigins)
  and building the page.
- `index.html` cache-busts its files with `?v=`, and `app.js` does the same on its imports.
  Bump all of them together when any file changes, or phones keep running old code.

```bash
npm test
```
