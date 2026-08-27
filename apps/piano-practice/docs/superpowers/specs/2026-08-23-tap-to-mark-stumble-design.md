# Tap-to-mark-stumble design

**Status:** Approved, ready for implementation plan.

## Problem

In the Sight tab, tapping "I stumbled" opens a row of eight numbered buttons
(`1`–`8`, plus "Not sure") below the score, and tapping one records which bar
went wrong (`recordStumble(mel, barIdx)`). The buttons have no visual tie to
the score above them — the score does not print bar numbers anywhere, so the
user has to silently count measures in the notation to know which button
corresponds to the bar they just fumbled. That counting step, right after a
first-pass read, is the friction being removed.

## Chosen approach

Make the score itself the input. When "I stumbled" is tapped, each of the
score's bars becomes a tappable region — no separate button row. The user
taps the bar they stumbled on directly, in the same score they were just
reading.

Two other approaches were considered and rejected in favor of this one:
- **Print bar numbers on the score, keep the buttons** — closes the gap but
  keeps an indirection (read a number, then find the matching button).
- **Reshape the button row into two rows of four**, mirroring the score's two
  systems — smallest change, but only partially closes the gap since the
  buttons still aren't the score.

Tap-on-score was preferred because it removes the indirection entirely: you
touch what you remember, not a number standing in for it.

## Behavior

- The score stays in place; no separate panel appears below it.
- Each of the 8 bars gets:
  - a faint dashed red outline, the only affordance that the score is now
    tappable (nothing else about the score's appearance changes)
  - a transparent hit-region spanning the bar's full column — its horizontal
    span matches the bar's width, and its vertical span covers the full
    staff height for that system (both staves on a grand-staff system), so a
    tap anywhere in that bar's column at any height counts, regardless of
    which hand's notes are actually there.
- A small "Not sure" button appears just below the score, replacing today's
  full button row. It keeps the existing `data-bar="skip"` convention the
  click handler already checks for (`idx !== 'skip'`), so the handler logic
  itself barely changes — only which elements it's attached to.
- Colors reuse the existing CSS custom properties (`--red` for the outline
  and flash, matching the drill's existing "miss" styling) rather than
  introducing new ones, so the new affordance looks native to the rest of
  the app.
- Tapping a bar (or "Not sure"):
  1. Disables further taps immediately (a local lock, so a fast second tap
     during the flash can't land on a different bar or double-fire).
  2. Flashes the tapped bar solid red for ~250ms (CSS transition on the
     hit-region's fill).
  3. Runs the same sequence that runs today: `recordStumble(mel, barIdx)`
     (skipped for "Not sure"), then `askBar = false`, `newMelody()`,
     `renderSight()`, `renderNow()`.
- No change to what's stored or how it's analyzed — `S.stumbles`,
  `recordStumble`, and `stumbleInsight` are untouched. This is purely a new
  input surface for the same data.

## Implementation approach

- `melodySVG(mel, clefFn, mark, askBar)` gains a fourth argument. When
  `askBar` is true, the existing per-system/per-bar loop (which already
  computes each bar's `bx0` via `barStart(b)` and the system's `sysH`) also
  emits one invisible `<rect>` per bar at those same coordinates, full
  `sysH` tall, with a dashed-outline CSS class and a `data-bar="<index>"`
  attribute. No new layout math — it reuses coordinates the function already
  computes for barlines.
- These hit-regions are wired the same way every other button in the file is
  wired: `v.querySelectorAll('[data-bar]').forEach(b => b.onclick = ...)` in
  `renderSight`, replacing the current row-of-buttons wiring one-for-one.
- The flash is a CSS class toggle (add a `.hit` -style class, matching the
  pattern already used for the note-drill buttons) plus a `setTimeout(...,
  250)` before the existing `recordStumble`/`newMelody`/`renderSight`
  sequence fires. A small local flag (analogous to how the note drill checks
  `drill.state` to ignore a second answer) blocks further taps until that
  timeout resolves and `renderSight` replaces the markup anyway.
- `askBar` continues to gate whether the hit-regions and dashed outlines
  render at all — with `askBar` false (the normal reading state), the score
  renders exactly as it does today, with no interactive elements.

## Testing

1. A test asserting `melodySVG(mel, clefsFor, null, true)` includes 8
   `data-bar` hit-regions sized to the score's actual staff height (grand vs.
   single-staff), and that omitting the fourth argument (or passing `false`)
   produces none — so the score is never accidentally tappable outside the
   stumble flow.
2. Extend the existing "every tab renders in every state" test
   (`test/progress.test.mjs`) to also render the sight tab with `askBar`
   true, so it's checked for `NaN`/`undefined` leaking into the new markup —
   the same style of test that caught the practice-session-timer bug.
3. A manual browser smoke test after implementation, since the 250ms flash
   timing isn't something the Node-based test harness can observe.
