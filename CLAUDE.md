# CLAUDE.md

## Commands

```bash
# Serve everything (module imports need HTTP, not file://)
python3 -m http.server 8000      # from the repo root

# Tests — per app, Node's built-in runner, nothing to install
cd apps/piano-practice && npm test
cd apps/lighting-cue-builder && npm test

# Real-browser smoke test (piano practice; needs Chrome/Chromium, CHROME_PATH to override)
cd apps/piano-practice && npm run smoke
```

No lint or format tooling is configured. Match the file you're in.

## Architecture

A monorepo of small personal static apps, served together from the repo root
on GitHub Pages under a subpath (`https://<user>.github.io/<repo>/`). See
`README.md` for the full layout and the "adding an app" checklist.

### Hard rules

- **No build step.** Plain HTML/CSS/JS, ES modules via
  `<script type="module">`, nothing from npm at runtime. A `package.json` is
  fine for dev-only tooling (tests), as long as what ships is just the files.
- **Every path is relative.** No leading `/` in links, script tags, `fetch()`
  calls or CSS `url()`. A leading slash works locally and breaks on Pages.
- **New apps get a card in the root `index.html`.**

### One origin, shared by every app

- `localStorage` and IndexedDB are shared across apps. Prefix every key
  (`lighting-cue-builder:plan`, not `plan`).
- A service worker only controls its own folder. Moving or renaming an app
  that registers one (`apps/piano-practice/sw.js`) leaves the old registration
  serving stale cache at the old URL.

### App shapes

Two layouts, both fine:
- **Split** — `index.html` + `app.js` + `styles.css`, leaning on `shared/`
  (`base.css`, `ckan.js`, `geo.js`, `usgs.js`, `weather.js`). The trackers
  and lighting cue builder.
- **Self-contained** — one `index.html` with its own theme. Piano practice,
  choreo draw.

Visual chrome follows `shared/base.css`: the dark warm palette, Cormorant
Garamond / Mulish / Fira Code. Apps may keep their own content palette (piano
practice's notation stays ink-on-paper) but the chrome should match.

### Testing

- Keep testable logic in a DOM-free module (`apps/lighting-cue-builder/cues.js`)
  so Node tests import the shipped file directly, not a copy.
- Piano practice instead loads the real script out of `index.html` into a stub
  browser (`test/harness.mjs`). Several real bugs there only showed up in a
  real browser, which is why `test/smoke.mjs` exists.
- For UI changes, check in a real browser before calling it done. Chromium is
  available to Playwright in cloud sessions.

## Scope and shipping

### Split at planning time

Before starting, say how the work splits into commits or PRs. Aim for under
~400 changed lines of logic per PR, excluding tests. Mechanical changes
(renames, moves, formatting) go in their own commit, never mixed with logic.
A brand-new app is the exception — it lands whole.

### Flag user-visible changes

If a change alters what someone sees or how an app behaves by default — new
or reordered UI, changed defaults, a new or renamed storage key, anything that
could lose saved data — say so in one or two plain sentences under a
`## User-visible` heading in the PR description.

**Storage changes need extra care.** People keep real work in these apps
(practice history, cue lists). Changing a stored shape needs a migration or a
normalizer that accepts the old one, plus a test with a legacy record.

### Record decisions with reasoning

When choosing between real alternatives, write down why, not just what. A
comment at the decision point is enough for small calls. The commit body is
the place for bigger ones — this repo's history already reads that way.

### Say what the code does. Cite or flag facts about the world.

These apps encode domain knowledge: music theory and fingering, stage
lighting, what a public dataset's fields mean. Two kinds of claim, treated
differently:

**Derivable from this repo — assert it.** What gets stored and under which
key, what a cue does to which light, what the code branches on, where a
constant lives.

**A fact about the outside world — cite it or flag it.** How a lighting desk
handles simultaneous cues, what an FHAB advisory level means, a data source's
update cadence. If there's a source, link it. If not, write it as a question:

```js
// CHECK: does the county feed report provisional and certified counts in one field?
```

Grep for `CHECK:` and clear them in one pass. Three flagged questions beat
three confident sentences that turn out wrong.

## How to write it

Covers commit messages, PR descriptions, docs and comments. Write it the way
you'd say it to a friend, not like a technical report.

**Commits.** An imperative subject in plain words ("Fix crash when a stumble
pattern isn't focusable"). No `feat:`/`fix:` prefixes. The body says why, when
the why isn't obvious.

**Budgets.** PR *What this changes*: 60 words. Each recorded decision: 80. If
a section needs more, the PR is probably too big.

**Register.** Lead with the verdict ("CSS only, no behaviour change."). Short
sentences. Hedge honestly ("my best guess is") rather than elaborately.

**Cut on sight.** Restating the diff. Long explanations of rejected
alternatives. Implementation detail nobody will act on. Empty headings — delete
them rather than writing "None."

**Vocabulary.** If it names something in the code, use it: `stateAt`,
`othersOff`, `sw.js`, `normalizePlan`. Avoid words that exist only in prose
(orthogonal, idempotent, semantics).
