# Personal Static Apps

A monorepo of small, personal static web apps, hosted together on GitHub
Pages. Every app is plain HTML/CSS/JS — **no build step, no bundler, no
framework, no npm**. Scripts are loaded as native ES modules
(`<script type="module" src="app.js">`), and any shared code lives in
`shared/` and is imported with relative paths.

## Structure

```
.
├── index.html              # Landing page linking to all apps
├── shared/                 # Code/styles reused across apps
│   ├── base.css            # Minimal shared styling (fonts, layout, cards)
│   └── ckan.js             # Shared CKAN/DataStore query helpers
└── apps/
    ├── election-tracker/    # Hayward / Alameda County election results
    │   ├── index.html
    │   ├── app.js
    │   ├── styles.css
    │   └── proxy.js
    └── algae-tracker/       # Paddleboard algae advisory tracker (CA FHAB data)
        ├── index.html
        └── app.js
```

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

## Deploying to GitHub Pages

This repo is served from the repository root under a subpath
(`https://<user>.github.io/<repo-name>/`), so **every path in every app must
be relative** (no leading `/`). Keep this in mind when adding links, script
tags, `fetch()` calls to local files, or CSS `url()` references.

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
