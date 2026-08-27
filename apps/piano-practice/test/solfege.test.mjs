import { test } from 'node:test';
import assert from 'node:assert';
import { loadApp } from './harness.mjs';

const app = loadApp();

test('major do is the tonic itself', () => {
  const c = app.keyByName('C');
  assert.equal(app.solfegeSyllable(app.dOf('C', 4), c, false), 'do');
  const g = app.keyByName('G');
  assert.equal(app.solfegeSyllable(app.dOf('G', 4), g, false), 'do');
});

test('major degrees follow letter distance from the tonic, ignoring accidentals', () => {
  // G major: G A B C D E F# — F is the 7th degree (ti) even though it's chromatically F#
  const g = app.keyByName('G');
  assert.equal(app.solfegeSyllable(app.dOf('F', 4), g, false), 'ti');
  assert.equal(app.solfegeSyllable(app.dOf('A', 4), g, false), 're');
  assert.equal(app.solfegeSyllable(app.dOf('E', 4), g, false), 'la');
});

test('do-based minor: tonic is do, not la', () => {
  // A minor is C major's relative minor (key.rel === 'A')
  const c = app.keyByName('C');
  assert.equal(app.solfegeSyllable(app.dOf('A', 4), c, true), 'do');
});

test('do-based minor uses altered syllables for the flatted 3rd, 6th, and 7th', () => {
  const c = app.keyByName('C'); // relative minor is A minor
  assert.equal(app.solfegeSyllable(app.dOf('C', 4), c, true), 'me', 'minor 3rd');
  assert.equal(app.solfegeSyllable(app.dOf('F', 4), c, true), 'le', 'minor 6th');
  assert.equal(app.solfegeSyllable(app.dOf('G', 4), c, true), 'te', 'minor 7th');
});

test('do-based minor uses plain syllables for the 2nd, 4th, and 5th', () => {
  const c = app.keyByName('C'); // relative minor is A minor
  assert.equal(app.solfegeSyllable(app.dOf('B', 4), c, true), 're', '2nd degree');
  assert.equal(app.solfegeSyllable(app.dOf('D', 4), c, true), 'fa', '4th degree');
  assert.equal(app.solfegeSyllable(app.dOf('E', 4), c, true), 'sol', '5th degree');
});

test('solfegeStaffSVG draws a note and grows to fit the key signature', () => {
  const c = app.keyByName('C'); // no sharps or flats
  const eb = app.keyByName('E♭'); // three flats
  const cSvg = app.solfegeStaffSVG(app.dOf('C', 4), c, null);
  const ebSvg = app.solfegeStaffSVG(app.dOf('C', 4), eb, null);
  assert.ok(cSvg.startsWith('<svg'), 'should return an svg element');
  assert.ok(!/NaN|undefined/.test(cSvg), 'C major staff contains NaN or undefined');
  assert.ok(!/NaN|undefined/.test(ebSvg), 'E♭ major staff contains NaN or undefined');
  assert.ok(cSvg.includes('class="notehead"'), 'should draw a notehead');
  // a signature with flats needs more width than no signature at all
  const widthOf = svg => +svg.match(/viewBox="0 0 (\d+(?:\.\d+)?)/)[1];
  assert.ok(widthOf(ebSvg) > widthOf(cSvg), 'a 3-flat signature should widen the staff');
});

test('solfegeHTML renders one button per syllable, for the right mode', () => {
  const majorHtml = app.solfegeHTML(false);
  const minorHtml = app.solfegeHTML(true);
  ['do', 're', 'mi', 'fa', 'sol', 'la', 'ti'].forEach(s =>
    assert.ok(majorHtml.includes(`data-answer="${s}"`), `major buttons missing ${s}`));
  ['do', 're', 'me', 'fa', 'sol', 'le', 'te'].forEach(s =>
    assert.ok(minorHtml.includes(`data-answer="${s}"`), `minor buttons missing ${s}`));
  assert.ok(!majorHtml.includes('data-answer="me"'), 'major buttons should not offer the minor 3rd');
});

test('the solfege drill mode renders cleanly across every key, major and minor', () => {
  for (let i = 0; i < 40; i++) {
    const fresh = loadApp();
    fresh.S = fresh.normalize(fresh.blank());
    fresh.S.primerSeen = true;
    fresh.tab = 'reading';
    fresh.drill = { d: null, keyIdx: null, mode: 'solfege', minor: false, state: null, t0: 0, round: null, done: false };
    fresh.render();
    const html = fresh.store.view.innerHTML || '';
    assert.ok(html.length > 0, `round ${i}: rendered empty`);
    assert.ok(!/NaN|undefined/.test(html), `round ${i}: contains NaN or undefined`);
    assert.ok(/major|minor/.test(html), `round ${i}: doesn't say which key is in play`);
    if (fresh.drill.minor) assert.ok(fresh.MINOR_OK.includes(fresh.KEYS[fresh.drill.keyIdx].name),
      `round ${i}: drilled a minor key the app doesn't otherwise generate minor material for`);
  }
});

test('every key names all seven scale degrees without NaN or undefined', () => {
  app.KEYS.forEach(k => {
    for (let i = 0; i < 7; i++) {
      const major = app.solfegeSyllable(app.dOf(app.LETTERS ? app.LETTERS[i] : 'CDEFGAB'[i], 4), k, false);
      assert.ok(major && !/nan|undefined/i.test(major), `major ${k.name} degree ${i}: got ${major}`);
      if (app.MINOR_OK.includes(k.name)) {
        const minor = app.solfegeSyllable(app.dOf('CDEFGAB'[i], 4), k, true);
        assert.ok(minor && !/nan|undefined/i.test(minor), `minor ${k.name} degree ${i}: got ${minor}`);
      }
    }
  });
});
