# Lighting Cue Builder

Plan a dance piece's lighting by listening to the track and adding cues as you
go. The stage plot shows what every light is doing at the playhead, so you can
scrub anywhere and check the plan.

## Using it

1. Load the track (pick or drop the file). It stays in this browser — it's
   kept in IndexedDB so a reload doesn't lose it, and it's never uploaded.
2. Play, pause, nudge (←/→ 0.1s, Shift 1s), or loop ±1/2/4s around a moment.
   The zoom strip shows 8 seconds around the playhead; drag it like tape.
3. **Add cue here** (or `C`) captures the time and opens the editor. The stage
   previews the cue as you edit; click lights on the stage to toggle them.
4. Cues autosave to `localStorage` under `lighting-cue-builder:plan`.

## Sections

Sections mark where each song in the mix starts. They show on both waveforms,
under the clock while you play, as headings in the cue list, and on the cue
sheet. A start can be a time (`1:23.4`) or a GarageBand bar (`b15`). Bar
starts are converted using the tempo field, so set it to the project's tempo
(GarageBand's display shows it). **Paste a list…** takes one section per line,
e.g. `b14.85 Rustage intro`.

Converting bars assumes the export starts at bar 1 and the project keeps one
tempo throughout. Use ⌖ on a row to move a section to the playhead once you've
found the real change by ear.

## What a cue means

- **Start** is the GO. **End** is optional: the cue's lights go out there with
  the same transition (snap, or fade over the same time).
- **Intensity** (1–100%) is the level an On cue brings its lights to. To dim
  a light that's already lit, cue it again at a lower level.
- **Fade** ramps level over the fade time. A light that's already lit
  cross-fades colour. A dark light takes the new colour instantly.
- **Off** takes the selected lights dark and keeps their colour while fading.
- **All others off** takes every light the cue doesn't name dark, using the
  cue's transition. "All others off" with no lights is a blackout.
- Two cues at the same time: the one entered later wins.

## Sharing

- **Export JSON / Import JSON** — the full plan, for backups or for a partner
  to edit in their own copy and send back. Importing into an empty plan just
  loads it. Otherwise a review opens: cues and sections are matched by id,
  and every difference is listed — changed in both (newer edit pre-picked),
  only in theirs, only in yours (untick what they deleted). **Replace mine
  with theirs** skips the merge. Undo is offered right after either.
- **Readable cue sheet** — fixed-width text columns (time / lights / level /
  colour / transition / notes) to paste into a submission or download as `.txt`.
- **Copy preview link** — the plan compressed into the URL hash. It opens in
  presentation mode as a read-only view; the viewer loads their own copy of
  the audio. It's a snapshot, so re-copy after changes. Opening one never
  touches the viewer's own saved plan unless they choose to import it.
- **Presentation mode** hides the editing UI: stage, transport, read-only list.

## Tests

```
npm test
```

Covers `cues.js` (time parsing, state-at-time, import normalisation, cue sheet,
share tokens). Node's built-in runner, no dependencies.
