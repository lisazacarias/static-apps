import { test } from 'node:test';
import assert from 'node:assert';
import { loadApp } from './harness.mjs';

const app = loadApp();
app.S = app.normalize(app.blank());

test('every bar holds exactly four beats', () => {
  for (let s = 0; s < app.STEPS.length; s++) {
    const step = app.STEPS[s];
    for (const kn of step.keys) for (let seed = 1; seed <= 20; seed++) {
      for (const minor of [false, true]) {
        const m = app.genMelody(step.rhythm, seed, app.keyByName(kn), minor,
          { hand: step.hand, reach: step.reach });
        [m.bars, m.bass].filter(Boolean).forEach(staff =>
          staff.forEach((bar, i) => {
            const beats = bar.reduce((a, n) => a + n.dur, 0);
            assert.ok(Math.abs(beats - 4) < 1e-9, `step ${s + 1} ${kn} bar ${i + 1} = ${beats}`);
          }));
      }
    }
  }
});

test('the melody always closes on its tonic', () => {
  for (const step of app.STEPS) for (const kn of step.keys) for (let seed = 1; seed <= 20; seed++) {
    const m = app.genMelody(step.rhythm, seed, app.keyByName(kn), false,
      { hand: step.hand, reach: step.reach });
    const line = app.melodyBars(m).flat();
    assert.equal(line[line.length - 1].d, m.melTonic);
  }
});

test('the melody never strays onto the other staff', () => {
  const yT = d => 70 - (d - 30) * 5, yB = d => 130 - (d - 18) * 5;
  for (const step of app.STEPS) for (const kn of step.keys) for (let seed = 1; seed <= 20; seed++) {
    const m = app.genMelody(step.rhythm, seed, app.keyByName(kn), false,
      { hand: step.hand, reach: step.reach });
    if (!(m.bars && m.bass)) continue;
    app.melodyBars(m).flat().forEach(n => {
      if (m.hand === 'left') assert.ok(yB(n.d) >= 80, `bass note too high: ${n.d}`);
      else assert.ok(yT(n.d) < 88, `treble note too low: ${n.d}`);
    });
  }
});

test('bars 1-2 recur exactly at bars 5-6', () => {
  const sig = bars => JSON.stringify(bars.map(b => b.map(n => [n.d, n.dur])));
  for (const step of app.STEPS) for (let seed = 1; seed <= 30; seed++) {
    const m = app.genMelody(step.rhythm, seed, app.keyByName(step.keys[0]), false,
      { hand: step.hand, reach: step.reach });
    const B = app.melodyBars(m);
    assert.equal(sig(B.slice(0, 2)), sig(B.slice(4, 6)), 'motif is not restated');
  }
});

test('a five-finger step never leaves the position', () => {
  app.STEPS.forEach((step, i) => {
    if (step.reach !== 0) return;
    for (const kn of step.keys) for (let seed = 1; seed <= 25; seed++) {
      const m = app.genMelody(step.rhythm, seed, app.keyByName(kn), false,
        { hand: step.hand, reach: 0 });
      app.melodyBars(m).flat().forEach(n => {
        const off = n.d - m.melTonic;
        assert.ok(off >= 0 && off <= 4, `step ${i + 1}: offset ${off} outside the hand`);
      });
    }
  });
});

test('one hand means one staff', () => {
  for (const step of app.STEPS) {
    const m = app.genMelody(step.rhythm, 3, app.keyByName(step.keys[0]), false,
      { hand: step.hand, reach: step.reach });
    if (step.hand === 'right') assert.ok(m.bars && !m.bass, 'right hand should have no bass staff');
    if (step.hand === 'left') assert.ok(m.bass && !m.bars, 'left hand should have no treble staff');
    if (step.hand === 'both') assert.ok(m.bars && m.bass, 'both hands need two staves');
  }
});

test('eighth notes appear only where the step allows', () => {
  app.STEPS.forEach((step, i) => {
    const canHave = app.RHYTHMS[step.rhythm].some(r => r.some(d => d === 0.5));
    for (let seed = 1; seed <= 20; seed++) {
      const m = app.genMelody(step.rhythm, seed, app.keyByName(step.keys[0]), false,
        { hand: step.hand, reach: step.reach });
      const has = app.melodyBars(m).flat().some(n => n.dur === 0.5);
      if (!canHave) assert.ok(!has, `step ${i + 1} produced eighths it should not have`);
    }
  });
});

test('a reaching step actually reaches, not just permits it', () => {
  app.STEPS.forEach((step, i) => {
    if (step.reach === 0) return;
    for (const kn of step.keys) for (let seed = 1; seed <= 40; seed++) {
      const m = app.genMelody(step.rhythm, seed, app.keyByName(kn), false,
        { hand: step.hand, reach: step.reach });
      const usesReach = app.melodyBars(m).flat().some(n => {
        const off = n.d - m.melTonic;
        return off < 0 || off > 4;
      });
      assert.ok(usesReach, `step ${i + 1} seed ${seed} (${kn}) never left the five-finger position`);
    }
  });
});

test('a reaching melody stretches only one direction, never both', () => {
  app.STEPS.forEach((step, i) => {
    if (step.reach === 0) return;
    for (const kn of step.keys) for (let seed = 1; seed <= 40; seed++) {
      const m = app.genMelody(step.rhythm, seed, app.keyByName(kn), false,
        { hand: step.hand, reach: step.reach });
      const offsets = app.melodyBars(m).flat().map(n => n.d - m.melTonic);
      const reachesLow = offsets.some(o => o < 0);
      const reachesHigh = offsets.some(o => o > 4);
      assert.ok(!(reachesLow && reachesHigh),
        `step ${i + 1} seed ${seed} (${kn}) stretched both below and above the position in one melody`);
    }
  });
});

test('focus: turn produces more direction changes than ordinary material', () => {
  const step = app.STEPS.find(s => s.hand === 'both');
  const key = app.keyByName(step.keys[0]);
  const countTurnBars = focus => {
    let turnBars = 0, totalBars = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const m = app.genMelody(step.rhythm, seed, key, false,
        { hand: step.hand, reach: step.reach, focus });
      app.melodyBars(m).forEach((_, i) => {
        totalBars++;
        if (app.barFeatures(m, i).turn) turnBars++;
      });
    }
    return turnBars / totalBars;
  };
  const ordinary = countTurnBars(null);
  const turny = countTurnBars('turn');
  assert.ok(turny > ordinary * 1.5,
    `expected focus:turn to noticeably raise direction changes, got ${turny.toFixed(2)} vs ordinary ${ordinary.toFixed(2)}`);
});

test('a raised seventh sits one semitone below the minor tonic', () => {
  ['C', 'G', 'D', 'F', 'B\u266d', 'E\u266d'].forEach(kn => {
    const k = app.keyByName(kn);
    const alter = app.keyAlter(k);
    const tonic = app.dOf(k.rel, 4);
    const seventh = tonic - 1;
    const raised = (alter[app.letterOf(seventh)] || 0) + 1;
    const gap = (app.midiOf(tonic) + (alter[k.rel] || 0)) - (app.midiOf(seventh) + raised);
    assert.equal(gap, 1, `${k.relName} minor: raised 7th is ${gap} semitones below home`);
  });
});

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

test('a left-hand-alone step is described as one hand, not a two-hand piece', () => {
  const step = app.STEPS.find(s => s.hand === 'left');
  app.S.sight.step = app.STEPS.indexOf(step);
  app.S.primerSeen = true;
  app.newMelody();
  app.keyIdentified = true;
  app.tab = 'sight';
  app.renderSight();
  const html = app.store.view.innerHTML;
  assert.ok(/Left hand alone/.test(html), `expected "Left hand alone", got: ${html.slice(0, 400)}`);
  assert.ok(!/holds one note per bar/.test(html), 'a single left-hand melody has no other hand to hold a note');
});
