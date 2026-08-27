# Tap-to-mark-stumble Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the numbered bar-picker row in the Sight tab's "I stumbled" flow with tapping the bar directly on the rendered score.

**Architecture:** `melodySVG` (the score-rendering function in `index.html`) gains a fourth `askBar` argument that draws one invisible, dashed-outline hit-region per bar using coordinates the function already computes for barlines — no new layout math. `renderSight` passes `askBar` through, replaces its numbered-button markup with a single "Not sure" button, and rewires the click handler to flash the tapped region red for ~250ms (via a local lock flag, so a second tap can't land during the flash) before running the existing `recordStumble` → `newMelody` → `renderSight` sequence unchanged.

**Tech Stack:** Single-file vanilla JS/SVG (`index.html`), Node's built-in test runner (`node --test`), no build step, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-23-tap-to-mark-stumble-design.md`

---

### Task 1: Add CSS for the score's tappable hit-regions

**Files:**
- Modify: `index.html:147-151`

- [ ] **Step 1: Add the `.stumble-hit` and flash rules**

Insert these two rules right before the closing `</style>` tag, after the existing `@media (prefers-reduced-motion...)` block:

```css
  .stumble-hit {
    fill: transparent;
    stroke: var(--red);
    stroke-width: 1;
    stroke-dasharray: 3 3;
    cursor: pointer;
    transition: fill 80ms ease;
  }
  .stumble-hit.flash { fill: var(--red); fill-opacity: .55; }
```

So the surrounding block reads:

```css
  @media (prefers-reduced-motion: no-preference) {
    .notehead { animation: drop .4s ease-out; }
    @keyframes drop { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
  }
  .stumble-hit {
    fill: transparent;
    stroke: var(--red);
    stroke-width: 1;
    stroke-dasharray: 3 3;
    cursor: pointer;
    transition: fill 80ms ease;
  }
  .stumble-hit.flash { fill: var(--red); fill-opacity: .55; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "Add CSS for tappable score hit-regions"
```

---

### Task 2: Write the failing test for `melodySVG`'s new `askBar` argument

**Files:**
- Test: `test/generator.test.mjs`

- [ ] **Step 1: Append this test to the end of `test/generator.test.mjs`**

```javascript
test('askBar draws one tappable hit-region per bar, sized to the score', () => {
  const bothStep = app.STEPS.find(s => s.hand === 'both');
  const rightStep = app.STEPS.find(s => s.hand === 'right');
  [bothStep, rightStep].forEach(step => {
    const m = app.genMelody(step.rhythm, 1, app.keyByName(step.keys[0]), false,
      { hand: step.hand, reach: step.reach });
    const svgOff = app.melodySVG(m, app.clefsFor, null);
    const svgOn = app.melodySVG(m, app.clefsFor, null, true);
    const barred = [...svgOn.matchAll(/data-bar="(\d+)"/g)].map(x => +x[1]).sort((a, b) => a - b);
    assert.deepEqual(barred, [0, 1, 2, 3, 4, 5, 6, 7], `${step.hand}: expected 8 hit-regions`);
    assert.ok(!svgOff.includes('data-bar='), `${step.hand}: score must not be tappable when askBar is omitted`);
    const expectedHeight = step.hand === 'both' ? 152 : 104;
    assert.ok(svgOn.includes(`height="${expectedHeight}"`),
      `${step.hand}: hit-region should span the full ${expectedHeight}px staff height`);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test`
Expected: `FAIL` — `askBar draws one tappable hit-region per bar, sized to the score` fails, because `melodySVG` doesn't accept a fourth argument yet and emits no `data-bar` attributes at all (`barred` will be `[]`, not `[0..7]`).

---

### Task 3: Make `melodySVG` draw the hit-regions

**Files:**
- Modify: `index.html:1578`, `index.html:1662-1667`, `index.html:1675`

- [ ] **Step 1: Accept the new argument**

```diff
- const melodySVG = (mel, clefFn, mark) => {
+ const melodySVG = (mel, clefFn, mark, askBar) => {
```

- [ ] **Step 2: Emit one hit-region per bar inside the existing per-bar loop**

The current loop (inside the `for (let sys = 0; sys < 2; sys++)` block) reads:

```javascript
    for (let b = 0; b < PERSYS; b++) {
      const idx = sys * PERSYS + b;
      const bx0 = barStart(b);
      if (hasT) g += drawBar(mel.bars[idx], bx0, yTreble, 30, 70, 'right');
      if (hasB) g += drawBar(mel.bass[idx], bx0, yLower, grand ? 90 : 30, grand ? 130 : 70, 'left');
      const bx = bx0 + BARW;
      if (idx === 7) {
        g += `<line x1="${bx - 6}" y1="30" x2="${bx - 6}" y2="${bottomY}" stroke="var(--ink)"/>`;
        g += `<line x1="${bx - 1}" y1="30" x2="${bx - 1}" y2="${bottomY}" stroke="var(--ink)" stroke-width="3"/>`;
      } else {
        g += `<line x1="${bx}" y1="30" x2="${bx}" y2="${bottomY}" stroke="var(--ink)"/>`;
      }
    }
```

Add the hit-region right after the barline `if/else`, still inside the `for (let b ...)` loop:

```diff
      } else {
        g += `<line x1="${bx}" y1="30" x2="${bx}" y2="${bottomY}" stroke="var(--ink)"/>`;
      }
+     if (askBar) {
+       g += `<rect class="stumble-hit" data-bar="${idx}" x="${bx0}" y="0"
+             width="${BARW}" height="${sysH}"/>`;
+     }
    }
```

Using `bx0`/`BARW`/`sysH` — all already computed above in the function for the barlines and the system wrapper — means the hit-region's box exactly matches the bar's own drawn width and the full staff height for that system, with no new coordinate math.

- [ ] **Step 3: Run the test from Task 2 and confirm it passes**

Run: `npm test`
Expected: `PASS` — all tests including `askBar draws one tappable hit-region per bar, sized to the score`.

- [ ] **Step 4: Commit**

```bash
git add index.html test/generator.test.mjs
git commit -m "melodySVG: draw a tappable hit-region per bar when askBar is set"
```

---

### Task 4: Replace the numbered button row in `renderSight`

**Files:**
- Modify: `index.html:2696`, `index.html:2715-2722`

- [ ] **Step 1: Pass `askBar` into the score render**

```diff
-      ${melodySVG(mel, clefsFor, null)}
+      ${melodySVG(mel, clefsFor, null, askBar)}
```

- [ ] **Step 2: Replace the button-row markup with an instruction line and a single "Not sure" button**

Current block:

```javascript
    ${askBar ? `<div class="now" style="border-left-color:var(--red);margin-top:12px">
      <p class="eyebrow" style="color:var(--red)">Which bar went wrong?</p>
      <p style="margin:0 0 8px;font-size:14px">One tap and it moves on. Over a few of these the app can tell you what the bars you trip on have in common.</p>
      <div class="row">
        ${melodyBars(mel).map((_, i) => `<button class="btn small" data-bar="${i}">${i + 1}</button>`).join('')}
        <button class="btn small" data-bar="skip">Not sure</button>
      </div>
    </div>` : ''}
```

Replace with:

```javascript
    ${askBar ? `<div class="now" style="border-left-color:var(--red);margin-top:12px">
      <p class="eyebrow" style="color:var(--red)">Tap the bar that went wrong, above</p>
      <p style="margin:0 0 8px;font-size:14px">One tap and it moves on. Over a few of these the app can tell you what the bars you trip on have in common.</p>
      <div class="row">
        <button class="btn small" data-bar="skip">Not sure</button>
      </div>
    </div>` : ''}
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "renderSight: replace the numbered bar row with the score's own tap targets"
```

---

### Task 5: Add the lock-and-flash behavior to the click handler

**Files:**
- Modify: `index.html:2859-2865`

- [ ] **Step 1: Replace the handler**

Current:

```javascript
  v.querySelectorAll('[data-bar]').forEach(b => b.onclick = () => {
    const idx = b.dataset.bar;
    if (idx !== 'skip') recordStumble(mel, +idx);
    askBar = false;
    prevMel = mel; lastVerdict = 'stumble';
    newMelody(); renderSight(); renderNow();
  });
```

Replace with:

```javascript
  let barLocked = false;
  const finishStumble = idx => {
    if (idx !== 'skip') recordStumble(mel, +idx);
    askBar = false;
    prevMel = mel; lastVerdict = 'stumble';
    newMelody(); renderSight(); renderNow();
  };
  v.querySelectorAll('[data-bar]').forEach(b => b.onclick = () => {
    if (barLocked) return;
    barLocked = true;
    v.querySelectorAll('[data-bar]').forEach(other => { other.disabled = true; });
    b.classList.add('flash');
    setTimeout(() => finishStumble(b.dataset.bar), 250);
  });
```

`b.disabled = true` is a no-op on the SVG `<rect>` elements (only real `<button>`s respect it — here that's just the "Not sure" button) but harmless to set on both; the `barLocked` flag is what actually blocks a second tap on a bar's `<rect>`, since SVG elements have no native `disabled` state.

- [ ] **Step 2: Run the full suite**

Run: `npm test`
Expected: `PASS` — all tests, including the two from Task 2.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "renderSight: lock taps and flash the tapped bar before advancing"
```

---

### Task 6: Extend the render-safety test to cover the tappable state

**Files:**
- Modify: `test/progress.test.mjs`

- [ ] **Step 1: Add an `askBar` pass to the sight-tab branch**

In the `'every tab renders in every state'` test, the `sight` branch currently reads:

```javascript
        if (t === 'sight') {
          app.newMelody();
          app.tapExpected = app.rhythmOnsets(app.mel, 84);
          app.tapTotalBeats = 32; app.tapState = 'off'; app.tapResult = null;
          app.playState = 'off'; app.playOnsets = app.tapExpected;
          app.playBeats = 32; app.playBpm = 84;
          app.lastVerdict = null; app.prevMel = null; app.askBar = false;
        }
        app.render();
        const html = app.store.view.innerHTML || '';
        assert.ok(html.length > 0, `${t} rendered empty`);
        assert.ok(!/NaN|undefined/.test(html), `${t} contains NaN or undefined`);
```

Change it so the sight tab is rendered once with `askBar = false` (as today) and once more with `askBar = true`, checking both:

```javascript
        if (t === 'sight') {
          app.newMelody();
          app.tapExpected = app.rhythmOnsets(app.mel, 84);
          app.tapTotalBeats = 32; app.tapState = 'off'; app.tapResult = null;
          app.playState = 'off'; app.playOnsets = app.tapExpected;
          app.playBeats = 32; app.playBpm = 84;
          app.lastVerdict = null; app.prevMel = null; app.askBar = false;
          app.render();
          const askHtml = (() => { app.askBar = true; app.render(); return app.store.view.innerHTML || ''; })();
          assert.ok(!/NaN|undefined/.test(askHtml), `${t} with askBar contains NaN or undefined`);
          app.askBar = false;
        }
        app.render();
        const html = app.store.view.innerHTML || '';
        assert.ok(html.length > 0, `${t} rendered empty`);
        assert.ok(!/NaN|undefined/.test(html), `${t} contains NaN or undefined`);
```

- [ ] **Step 2: Run the full suite**

Run: `npm test`
Expected: `PASS` — all tests.

- [ ] **Step 3: Commit**

```bash
git add test/progress.test.mjs
git commit -m "test: render the sight tab with askBar true, not just false"
```

---

### Task 7: Manual browser smoke test

- [ ] **Step 1: Serve and open the app**

```bash
npm run serve &
```

Open `http://localhost:8080` in a browser (or use the headless-Chrome + screenshot approach if no display is available — see the project's earlier smoke-test pattern: `--headless=new --screenshot=... --virtual-time-budget=4000`).

- [ ] **Step 2: Drive the flow**

- Go to the Sight tab, click "I stumbled".
- Confirm each bar shows a faint dashed red outline and the "Not sure" button appears alone (no numbered row).
- Tap a bar: confirm it flashes solid red briefly, then a new melody replaces the score.
- Repeat and tap "Not sure" instead: confirm it's disabled during the brief delay and no stumble is recorded (check via `S.stumbles.length` in devtools if needed).
- Check the browser console for errors.

- [ ] **Step 3: Stop the server**

```bash
lsof -ti:8080 -sTCP:LISTEN | xargs -r kill
```

---

### Task 8: Update the README's test-coverage summary

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add the new coverage to the "Progress" bullet**

Current line in the `## Tests` section:

```markdown
- **Progress** — steps unlock in order, the directive always names a real tab,
  every tab renders in every state, keys never repeat back to back, and the
  stumble analysis finds real patterns while rarely flagging noise.
```

Add a clause about the tappable score to the **Generator** bullet instead, since `melodySVG` is generator/notation output:

```markdown
- **Generator** — every bar totals four beats, melodies close on the tonic, the
  motif is restated, a five-finger step never leaves the position, one hand
  means one staff, eighth notes only appear where the step allows, the raised
  seventh lands one semitone below each minor tonic, and the score exposes one
  tappable bar per measure when marking a stumble.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: mention tappable stumble bars in the test coverage summary"
```
