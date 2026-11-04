# election-tracker

Live results for Hayward voters from the California Secretary of State's results feed
(`api.sos.ca.gov`), plus links out for the Hayward and Alameda County races the state
doesn't carry.

- `election.js`: everything specific to one election (races, endpoints, registered voters,
  turnout, prop short names and conflicts). For the next election, start here, then the
  title, dates and Hayward race list in `index.html`.
- `results.js`: parsing and race/prop math with no DOM, so tests import it directly.
- `app.js`: fetching (direct, then the Netlify rewrite in `/_redirects`, then allorigins)
  and building the page.
- `index.html` cache-busts its files with `?v=`, and `app.js` does the same on its imports.
  Bump all of them together when any file changes, or phones keep running old code.

```bash
npm test
```
