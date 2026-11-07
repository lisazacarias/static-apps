// Stroke order from KanjiVG (https://kanjivg.tagaini.net/, CC BY-SA 3.0),
// fetched per character from jsDelivr's mirror of the GitHub repo the first
// time it's shown; sw.js then keeps a copy for offline use. Nothing is
// committed here because this sandbox couldn't reach either site to vet a
// snapshot. No DOM in this file: parseStrokes only reads text, and the app
// builds its own SVG from the path data, so nothing from the fetched file is
// inserted into the page as markup.
//
// CHECK: pin a KanjiVG release tag instead of master once one can be checked.

export const KANJIVG_BASE = 'https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@master/kanji/';
export const KANJIVG_CREDIT = { text: 'Stroke order: KanjiVG (CC BY-SA 3.0)', url: 'https://kanjivg.tagaini.net/' };

// KanjiVG names each file by the character's code point: 5 hex digits, lowercase.
export const strokeFile = (ch) => `${ch.codePointAt(0).toString(16).padStart(5, '0')}.svg`;
export const strokeUrl = (ch) => KANJIVG_BASE + strokeFile(ch);

// The characters of a string worth drawing: kana and kanji, not 〜 or
// punctuation. Small kana (ゃ, ィ) and ー count; KanjiVG has them.
export const drawable = (s) => [...s].filter((c) => /[ぁ-ゖァ-ヺー一-鿿]/u.test(c));

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? m[1] : null;
};

// KanjiVG SVG text → strokes in order: [{ n, d }], plus the stroke-number
// labels [{ n, x, y }]. Paths are ordered by their -sN id suffix rather than
// trusting document order. Path data is checked to be only path commands
// and numbers, since it ends up in an attribute.
export function parseStrokes(svg) {
  const strokes = [];
  for (const [tag] of svg.matchAll(/<path\b[^>]*>/g)) {
    const id = attr(tag, 'id') || '';
    const d = attr(tag, 'd');
    const m = id.match(/-s(\d+)$/);
    if (!m || !d || !/^[MmCcSsLlHhVvZzQqTtAa0-9.,\s-]+$/.test(d)) continue;
    strokes.push({ n: Number(m[1]), d });
  }
  strokes.sort((a, b) => a.n - b.n);
  const labels = [];
  for (const m of svg.matchAll(/<text\b[^>]*transform="matrix\(1 0 0 1 ([\d.-]+) ([\d.-]+)\)"[^>]*>(\d+)<\/text>/g)) {
    labels.push({ x: Number(m[1]), y: Number(m[2]), n: Number(m[3]) });
  }
  return { strokes, labels };
}
