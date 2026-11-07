// Kana tables, katakana conversion, and kana → romaji. No DOM, so the
// Node tests import this file as shipped.

// Learning order: one group unlocks at a time (see unlock in srs.js).
// ぢ and づ are left out: they read ji/zu like じ/ず, show up in a handful
// of words, and would give two right answers in a multiple-choice quiz.
export const HIRA_GROUPS = [
  { id: 'a-ka', rows: [['あ', 'a'], ['い', 'i'], ['う', 'u'], ['え', 'e'], ['お', 'o'], ['か', 'ka'], ['き', 'ki'], ['く', 'ku'], ['け', 'ke'], ['こ', 'ko']] },
  { id: 'sa-ta', rows: [['さ', 'sa'], ['し', 'shi'], ['す', 'su'], ['せ', 'se'], ['そ', 'so'], ['た', 'ta'], ['ち', 'chi'], ['つ', 'tsu'], ['て', 'te'], ['と', 'to']] },
  { id: 'na-ha', rows: [['な', 'na'], ['に', 'ni'], ['ぬ', 'nu'], ['ね', 'ne'], ['の', 'no'], ['は', 'ha'], ['ひ', 'hi'], ['ふ', 'fu'], ['へ', 'he'], ['ほ', 'ho']] },
  { id: 'ma-n', rows: [['ま', 'ma'], ['み', 'mi'], ['む', 'mu'], ['め', 'me'], ['も', 'mo'], ['や', 'ya'], ['ゆ', 'yu'], ['よ', 'yo'], ['ら', 'ra'], ['り', 'ri'], ['る', 'ru'], ['れ', 're'], ['ろ', 'ro'], ['わ', 'wa'], ['を', 'wo'], ['ん', 'n']] },
  { id: 'dakuten', rows: [['が', 'ga'], ['ぎ', 'gi'], ['ぐ', 'gu'], ['げ', 'ge'], ['ご', 'go'], ['ざ', 'za'], ['じ', 'ji'], ['ず', 'zu'], ['ぜ', 'ze'], ['ぞ', 'zo'], ['だ', 'da'], ['で', 'de'], ['ど', 'do'], ['ば', 'ba'], ['び', 'bi'], ['ぶ', 'bu'], ['べ', 'be'], ['ぼ', 'bo'], ['ぱ', 'pa'], ['ぴ', 'pi'], ['ぷ', 'pu'], ['ぺ', 'pe'], ['ぽ', 'po']] },
  { id: 'yoon', rows: ['き:k', 'し:sh', 'ち:ch', 'に:n', 'ひ:h', 'み:m', 'り:r', 'ぎ:g', 'じ:j', 'び:b', 'ぴ:p'].flatMap((s) => {
    const [k, c] = s.split(':');
    const y = /^(sh|ch|j)$/.test(c) ? '' : 'y';
    return [['ゃ', 'a'], ['ゅ', 'u'], ['ょ', 'o']].map(([small, v]) => [k + small, c + y + v]);
  }) },
];

// Small っ and long vowels can't be quizzed as single characters, so they
// get short words with hand-picked wrong answers (the same word without
// the pause or the length).
export const HIRA_WORDS = [
  { kana: 'きって', romaji: 'kitte', en: 'stamp / ticket', confuse: ['kite', 'kiite', 'kittei'] },
  { kana: 'ちょっと', romaji: 'chotto', en: 'a little', confuse: ['choto', 'chōto', 'chottō'] },
  { kana: 'いっぱい', romaji: 'ippai', en: 'one cup / full', confuse: ['ipai', 'īpai', 'ippāi'] },
  { kana: 'ざっし', romaji: 'zasshi', en: 'magazine', confuse: ['zashi', 'zāshi', 'zasshī'] },
  { kana: 'おばあさん', romaji: 'obāsan', en: 'grandmother', confuse: ['obasan', 'obbasan', 'obāsān'] },
];

export const KATA_EXTRA = [
  ['ティ', 'ti'], ['ディ', 'di'], ['ファ', 'fa'], ['フィ', 'fi'], ['フェ', 'fe'], ['フォ', 'fo'],
  ['ウィ', 'wi'], ['ウェ', 'we'], ['チェ', 'che'], ['シェ', 'she'], ['ジェ', 'je'], ['ヴ', 'vu'],
];

export const KATA_WORDS = [
  { kana: 'ビール', romaji: 'bīru', en: 'beer', confuse: ['biru', 'bīrū', 'birru'] },
  { kana: 'ビル', romaji: 'biru', en: 'building', confuse: ['bīru', 'biruu', 'birru'] },
  { kana: 'コーヒー', romaji: 'kōhī', en: 'coffee', confuse: ['kohi', 'kōhi', 'kohī'] },
  { kana: 'ベッド', romaji: 'beddo', en: 'bed', confuse: ['bedo', 'bēdo', 'beddō'] },
  { kana: 'チケット', romaji: 'chiketto', en: 'ticket', confuse: ['chiketo', 'chikētto', 'chikkettō'] },
  { kana: 'カップ', romaji: 'kappu', en: 'cup', confuse: ['kapu', 'kāpu', 'kappū'] },
];

// Look-alikes, used for wrong answers so a quiz tests the shape and not
// just "which of these four have I seen before".
export const CONFUSABLE = [
  'シツ', 'ソン', 'クケタ', 'ぬめ', 'ねれわ', 'さちき', 'るろ', 'はほ', 'あお', 'いこ', 'コユ', 'ウワフ', 'ノメ', 'チテ', 'マア', 'シソ', 'ツン', 'ぬね',
];

// One-line tell-apart tips, shown after a miss. Written for this app;
// the full mnemonic charts are Tofugu's (linked in the app, not copied).
export const HINTS = {
  'シ': 'シ shi: the dashes sit on the left and the long stroke sweeps UP. ツ tsu has them on top, stroke falling down.',
  'ツ': 'ツ tsu: the dashes sit on top and the long stroke falls DOWN. シ shi has them on the left, sweeping up.',
  'ソ': 'ソ so: one dash on top, stroke falls down. ン n has the dash on the left, stroke sweeps up.',
  'ン': 'ン n: dash on the left, stroke sweeps up (like シ). ソ so falls down from the top (like ツ).',
  'ク': 'ク ku: just two strokes. タ ta is ク with an extra dash inside; ケ ke has a long separate tail.',
  'ケ': 'ケ ke: the long right stroke stands apart and drops below. ク ku is only two strokes.',
  'タ': 'タ ta: ク with a dash inside it.',
  'ぬ': 'ぬ nu: like め me, but the tail ends in a loop.',
  'め': 'め me: like ぬ nu, but no loop at the end.',
  'ね': 'ね ne: ends in a loop. れ re ends with an outward kick, わ wa curls back in.',
  'れ': 'れ re: ends with an outward kick. ね ne loops, わ wa curls in.',
  'わ': 'わ wa: curls back in at the end. ね ne loops, れ re kicks out.',
  'さ': 'さ sa: one crossbar, and the bottom curve opens to the right. ち chi is its mirror; き ki has two bars.',
  'ち': 'ち chi: the bottom bulges right, like a 5. さ sa is the mirror image.',
  'き': 'き ki: two crossbars. さ sa has one.',
  'る': 'る ru: loop at the bottom. ろ ro has none.',
  'ろ': 'ろ ro: open at the bottom. る ru has a loop.',
  'は': 'は ha: one bar crossing the right side. ほ ho has two, and a flat top.',
  'ほ': 'ほ ho: two bars on the right with a flat top. は ha has one.',
  'あ': 'あ a: the loop crosses the vertical. お o has a separate dot at the top right.',
  'お': 'お o: separate dot at the top right. あ a has none.',
  'い': 'い i: two strokes side by side, vertical. こ ko stacks them, horizontal.',
  'こ': 'こ ko: two strokes stacked, horizontal. い i is side by side.',
  'コ': 'コ ko: a box open on the left. ユ yu’s bottom bar sticks out past the side.',
  'ユ': 'ユ yu: the bottom bar sticks out past the vertical. コ ko’s doesn’t.',
  'ウ': 'ウ u: has a little dash on top. ワ wa doesn’t; フ fu has no left side.',
  'ワ': 'ワ wa: a left side, no dash on top. ウ u has the dash; フ fu has no left side.',
  'フ': 'フ fu: just a hook, no left side. ワ wa has one.',
  'ノ': 'ノ no: a single slash. メ me has a second stroke crossing it.',
  'メ': 'メ me: a slash with a second stroke crossing it. ノ no is one stroke.',
  'チ': 'チ chi: slanted top stroke and a curved vertical. テ te has two flat bars.',
  'テ': 'テ te: two flat bars on top. チ chi’s top slants.',
  'マ': 'マ ma: the little stroke goes down-right inside. ア a has a long tail down-left.',
  'ア': 'ア a: long tail curving down-left. マ ma’s inner stroke goes down-right.',
};

export const toKatakana = (s) => s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
export const toHiragana = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

const MONO = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o', か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so', た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no', は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo', や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro', わ: 'wa', を: 'o', ん: 'n',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go', ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do', ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po', ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o', ゔ: 'vu',
};
// How a kana is built from one you already know, for the teaching card.
// が is か with ゛, ぱ is は with ゜ (Unicode splits them that way under
// NFD), and きゃ / ティ are a kana plus a small one. → a line, or ''.
const SMALL = { ゃ: 'ya', ゅ: 'yu', ょ: 'yo', ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o' };
const MARKS = { '\u3099': '゛', '\u309A': '゜' };
const say = (k) => `${k} ${MONO[toHiragana(k)] ?? SMALL[toHiragana(k)] ?? ''}`.trim();
export function builtFrom(jp) {
  const chars = [...jp];
  if (chars.length === 2 && SMALL[toHiragana(chars[1])]) {
    return `${say(chars[0])} + small ${chars[1]} ${SMALL[toHiragana(chars[1])]}`;
  }
  if (chars.length !== 1) return '';
  const [base, mark] = [...jp.normalize('NFD')];
  if (!MARKS[mark]) return '';
  return `${base} + ${MARKS[mark]}: ${MONO[toHiragana(base)]} → ${MONO[toHiragana(jp)]}`;
}

// Katakana that look like their hiragana twin, shown when one is taught.
const TWINS = 'かきへりもせや';
export const hiraganaTwin = (jp) => (jp.length === 1 && TWINS.includes(toHiragana(jp)) && jp !== toHiragana(jp) ? toHiragana(jp) : '');

const MACRON = { a: 'ā', i: 'ī', u: 'ū', e: 'ē', o: 'ō' };

// Hepburn with macrons, for showing a generated reading (numbers, times).
// Authored content carries its own romaji; this only has to handle what
// numbers.js produces, plus plain words. おう/うう/おお become ō/ū, which
// is right for the number words (じゅう jū, とお tō) but would be wrong
// across a word boundary — nothing generated here has one.
export function toRomaji(input) {
  const s = toHiragana(input);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === 'っ') {
      const r = romajiAt(s, i + 1);
      out += r ? (r.text.startsWith('ch') ? 't' : r.text[0]) : '';
      continue;
    }
    if (c === 'ー') { const v = out.slice(-1); out = MACRON[v] ? out.slice(0, -1) + MACRON[v] : out; continue; }
    const r = romajiAt(s, i);
    if (!r) { out += c; continue; }
    i += r.len - 1;
    let text = r.text;
    if (c === 'ん' && /^[aiueoy]/.test(romajiAt(s, i + 1)?.text || '')) text = "n'";
    out += text;
  }
  return out.replace(/ou|oo/g, 'ō').replace(/uu/g, 'ū');
}

function romajiAt(s, i) {
  const c = s[i];
  if (!c || !MONO[c]) return null;
  const small = s[i + 1];
  if (small === 'ゃ' || small === 'ゅ' || small === 'ょ') {
    const v = { ゃ: 'a', ゅ: 'u', ょ: 'o' }[small];
    const base = MONO[c];
    if (/^(shi|chi|ji)$/.test(base)) return { text: base.slice(0, -1) + v, len: 2 };
    return { text: base.slice(0, -1) + 'y' + v, len: 2 };
  }
  if (/[ぁぃぅぇぉ]/.test(small || '') && c !== 'っ') {
    // ティ, ファ, ウィ, チェ… as written in hiragana after toHiragana.
    const v = MONO[small];
    const base = MONO[c];
    if (c === 'て' || c === 'で') return { text: base[0] + v, len: 2 };
    if (c === 'ふ') return { text: 'f' + v, len: 2 };
    if (c === 'う') return { text: 'w' + v, len: 2 };
    if (c === 'ゔ') return { text: 'v' + v, len: 2 };
    if (/^(shi|chi|ji)$/.test(base)) return { text: base.slice(0, -1) + v, len: 2 };
  }
  return { text: MONO[c], len: 1 };
}
