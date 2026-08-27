# Personal Static Apps

A monorepo of small, personal static web apps, hosted together on GitHub
Pages. Every app is plain HTML/CSS/JS — **no build step, no bundler, no
framework, and nothing from npm at runtime**. Scripts are loaded as native ES
modules (`<script type="module" src="app.js">`), and any shared code lives in
`shared/` and is imported with relative paths.

An app may keep a `package.json` for *dev-time* tooling like a test suite, as
long as what ships is still just the files in its folder. The rule is that the
browser never needs a build — not that Node is banned from the workflow.

## Structure

```
.
├── index.html              # Landing page linking to all apps
├── shared/                 # Code/styles reused across apps
│   ├── base.css            # Minimal shared styling (fonts, layout, cards)
│   ├── ckan.js             # Shared CKAN/DataStore query helpers
│   ├── geo.js              # Geocoding / distance helpers
│   ├── usgs.js             # USGS water-data helpers
│   └── weather.js          # Forecast helpers
└── apps/
    ├── election-tracker/    # Hayward / Alameda County election results
    │   ├── index.html
    │   ├── app.js
    │   ├── styles.css
    │   └── proxy.js
    ├── algae-tracker/       # Paddleboard algae advisory tracker (CA FHAB data)
    │   ├── index.html
    │   └── app.js
    └── piano-practice/      # Sight-reading trainer (installable, works offline)
        ├── index.html       # The entire app, self-contained
        ├── manifest.json    # Add-to-Home-Screen metadata
        ├── sw.js            # Offline cache (network-first)
        ├── package.json     # Dev-only: test runner scripts
        └── test/            # Node tests against a stub browser
```

Not every app follows the same shape. The trackers are split into
`index.html` + `app.js` + `styles.css` and lean on `shared/`; piano practice is
one self-contained `index.html` with its own theme and its own test suite. Both
are fine — the only hard rules are *no build step* and *relative paths*.

## Running locally

Because apps use ES module imports (`import ... from "../../shared/ckan.js"`),
they must be served over HTTP — opening the HTML files directly via
`file://` will not work (browsers block module imports from `file://`).

From the repo root, run:

```
python3 -m http.server 8000
```

Then open:
- `http://localhost:8000/` — landing page
- `http://localhost:8000/apps/election-tracker/`
- `http://localhost:8000/apps/algae-tracker/`
- `http://localhost:8000/apps/piano-practice/`

## Tests

Only piano practice has a suite. From `apps/piano-practice/`:

```
npm test
```

It loads the real script out of `index.html` and runs it against a stub
browser, so it exercises the shipped code rather than a copy. No install step —
it uses Node's built-in test runner, so there are no dependencies to fetch.

## Deploying to GitHub Pages

This repo is served from the repository root under a subpath
(`https://<user>.github.io/<repo-name>/`), so **every path in every app must
be relative** (no leading `/`). Keep this in mind when adding links, script
tags, `fetch()` calls to local files, or CSS `url()` references.

All apps here share one origin (`https://<user>.github.io`), which has two
consequences worth knowing:

- **`localStorage` is shared across apps.** Anything an app persists is visible
  to every other app on the origin, so prefix your keys.
- **A service worker only controls its own folder.** `apps/piano-practice/sw.js`
  registers with a scope of that directory, so it can't intercept requests for
  the other apps. If you ever move or rename an app that registers a worker,
  the old registration survives on the origin and will keep serving its cache
  at the old URL until something unregisters it.

## Adding a new app

1. Create a new folder under `apps/`, e.g. `apps/my-new-app/`.
2. Add `index.html` and `app.js` (plus any CSS/assets) inside it, using only
   relative paths.
3. Load your script as an ES module:
   ```html
   <script type="module" src="app.js"></script>
   ```
4. If your app needs shared code, put it in `shared/` and import it with a
   relative path from your app, e.g.:
   ```js
   import { queryResource } from "../../shared/ckan.js";
   ```
5. Link your app from the root `index.html` landing page, e.g.:
   ```html
   <a href="apps/my-new-app/">Open app →</a>
   ```
6. Test locally with `python3 -m http.server 8000` (see above) before
   committing — module imports require a real HTTP server, not `file://`.

Steps 2–4 describe the split layout the trackers use. A single self-contained
`index.html` is equally welcome — skip straight to step 5.
