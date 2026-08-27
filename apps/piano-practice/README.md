# Piano practice

A sight-reading trainer. Generates eight-bar melodies as real notation, plays
them back with a click, drills note and key-signature reading, and tracks
progress along a thirteen-step ladder.

The whole app is one self-contained `index.html` — no build step, no
dependencies, no backend. Open the file and it works.

## Running it

```sh
npm run serve      # http://localhost:8080
```

Opening `index.html` directly with `file://` mostly works, but browsers treat
file URLs as an insecure origin, so audio can behave oddly. Serving it is
better.

## Tests

```sh
npm test
```

The tests load the real script out of `index.html` and run it against a stub
browser, so they exercise the shipped code rather than a copy of it. They cover:

- **Generator** — every bar totals four beats, melodies close on the tonic, the
  motif is restated, a five-finger step never leaves the position, a reaching-out
  step actually requires the reach rather than merely allowing it (and only in
  one direction per melody, not a thumb-stretch and a pinky-stretch both in
  eight bars), one hand means one staff, eighth notes only appear where the
  step allows, `focus:'turn'` measurably raises how often the line changes
  direction, the raised seventh lands one semitone below each minor tonic, and
  the score exposes one tappable bar per measure when marking a stumble.
- **Audio** — every step produces audible non-clipping playback, both staves
  reach the output, written duration is audible in the sound, the click track
  holds its beat to under 2ms across tempos, bass notes get a loudness boost
  (tapering to none by middle C, capped short of the shared limiter) so they
  don't sound quieter than treble at the same linear gain, and every ladder
  step's melody-plus-click playback stays clear of that limiter.
- **Progress** — steps unlock in order, the directive always names a real tab,
  every tab renders in every state, keys never repeat back to back, a step
  clears at 4 of its last 5 outcomes (not a consecutive streak — one stumble
  ages out instead of resetting everything), and a detected weakness becomes
  the default melody focus without being asked, until you say otherwise.
- **Stumble analysis** — finds real patterns across nine features (leap, leap
  direction, hand position, weak-finger use, black keys, rhythm, accidentals,
  line direction, ledger lines) while rarely flagging noise, and the panel
  still renders when the strongest pattern is on a feature — like a downward
  leap — that the generator has no dial to weight toward.
- **Solfège** — the movable-do, do-based-minor syllable for a note is its
  letter-distance from the tonic regardless of the key's own sharps and flats,
  minor correctly uses the altered 3rd/6th/7th (me, le, te), and the drill mode
  renders cleanly across every key.
- **Drill staff** — the reading drill redraws the correct staff (signature,
  note, or both) for whichever mode is active after every answer, not just on
  the first render; and the Sight tab's fingering diagram stays hidden, along
  with the key name everywhere it would otherwise appear, until the key
  signature is identified correctly.
- **Practice sessions** — a running session's timer, slot name, and
  pause/resume/done controls show up in the persistent strip on every tab, not
  just Progress (where the session is started and the full slot list lives),
  and switching tabs never re-renders a tab that a slot toggle didn't touch.
- **Backups and old save shapes** — restoring a backup rejects anything that
  isn't actually a progress file, a session saved before wall-clock timing (or
  restored mid-slot) converts cleanly to real numbers instead of NaN and never
  comes back already running, and the older per-stage and per-streak save
  shapes still migrate onto the current ladder and mastery window.

## Smoke test

```sh
npm run smoke
```

`node --test` stubs out the DOM enough that it can't exercise the bootstrap, a
real click, or anything PWA-related. This drives an actual headless Chrome
against the real served files instead: a fresh load, every tab, starting a
session and controlling it from a different tab's persistent strip, a backup
export/restore round trip (including rejecting a bad one), and that the
manifest validates, the service worker activates, and the app still renders
with the network cut off. Requires a local Chrome or Chromium — set
`CHROME_PATH` if it isn't found automatically.

## Where your data lives

Progress is kept in `localStorage`, keyed to whatever origin serves the page.
That means it survives refreshes and browser restarts, but it does **not**
follow you between devices or browsers, and clearing site data wipes it.

Use **Progress → Back up or move your progress** to download a JSON file. That
export is the only copy you own outright; take one before changing anything.
That section also tracks when you last did, and says so — a nudge once it's
been a month, since the file is the only thing that follows you off this
device.

For genuine cross-device sync you would need a backend — a table keyed by user
with a JSON blob is enough, and the export format is already the right shape
for it.

## Deploying

Any static host works, since there is nothing to build:

```sh
npx vercel deploy --prod      # or: push and enable GitHub Pages
```

Serving it from a stable domain is worth doing: `localStorage` is scoped to the
origin, so a fixed URL means progress that persists indefinitely.

`manifest.json` and `sw.js` make it installable — Add to Home Screen gives it
an icon and a standalone window, and the service worker caches the app so it
still opens with no connection. The worker fetches the network first and only
falls back to its cache on failure, specifically so a push here is never
masked by a stale cache: reload with a connection and you always get the
latest version.

## Layout

```
index.html      the entire app
manifest.json   name, icon, and display mode for Add to Home Screen
sw.js           service worker: network-first, offline fallback only
icon-*.png      home-screen icons referenced by manifest.json
PROGRAM.md      the wider practice programme, most of which the app does not cover
test/
  harness.mjs   loads index.html into a stub browser
  *.test.mjs    the suites above
  smoke.mjs     drives a real browser against the real served files
```

## What this is not

The app trains reading. The programme in `PROGRAM.md` — repertoire, scales,
hands-together work, playing from your own choir music — is the larger part of
learning the instrument and mostly happens away from the screen.
