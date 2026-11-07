// Everything the app teaches. Edit this file to change the decks.
//
// Item fields:
//   id      stable key; progress is stored against it, so don't rename one
//   deck    hira | kata | menu | phrase | sign | num
//   jp      what's written (kanji/kana)
//   kana    the reading in kana
//   romaji  Hepburn, macrons for long vowels
//   en      meaning
//   notes   register / usage, optional
//   speak   what the voice reads. Kana spelled the way it sounds: the
//           particle は written わ and へ written え, because a speech
//           engine reading bare kana can't tell the particle from the
//           syllable. Templates (〜) get an example filled in.
//   tags    scenario, for the phrasebook filter
//   listen  true for staff phrases you hear but don't need to say
//   day     days after your start date when it unlocks (0 = straight away)
//   star    learn in week 1
//
// Starter phrase list, ranking and week plan are from the research notes
// (see README.md). The phrases follow standard textbook polite forms.
// CHECK: have a Japanese speaker read through PHRASES and SIGNS once.

import { HIRA_GROUPS, HIRA_WORDS, KATA_EXTRA, KATA_WORDS, toKatakana } from './kana.js';

// Kana. Each group unlocks in order inside its deck; day is the earliest.
const kanaItems = (deck, script) => {
  const conv = script === 'kata' ? toKatakana : (s) => s;
  const items = [];
  HIRA_GROUPS.forEach((g, gi) => {
    for (const [k, r] of g.rows) {
      const jp = conv(k);
      items.push({ id: `${deck}:${jp}`, deck, jp, kana: jp, romaji: r, en: r, speak: speakKana(k), group: gi, day: script === 'kata' ? 5 : 0 });
    }
  });
  if (script === 'kata') {
    for (const [k, r] of KATA_EXTRA) items.push({ id: `${deck}:${k}`, deck, jp: k, kana: k, romaji: r, en: r, speak: k, group: HIRA_GROUPS.length, day: 5 });
    for (const w of KATA_WORDS) items.push({ id: `${deck}:${w.kana}`, deck, jp: w.kana, kana: w.kana, romaji: w.romaji, en: w.en, speak: w.kana, confuse: w.confuse, word: true, group: HIRA_GROUPS.length, day: 5 });
  } else {
    for (const w of HIRA_WORDS) items.push({ id: `${deck}:${w.kana}`, deck, jp: w.kana, kana: w.kana, romaji: w.romaji, en: w.en, speak: w.kana, confuse: w.confuse, word: true, group: HIRA_GROUPS.length, day: 0 });
  }
  return items;
};
// を on its own is read "o"; ん on its own some voices skip. Say them the
// way the sound is meant.
const speakKana = (k) => ({ を: 'お', ん: 'ん' }[k] || k);

export const KANA = [...kanaItems('hira', 'hira'), ...kanaItems('kata', 'kata')];

// Katakana menu and station words. Pick-the-meaning quiz.
const MENU_ROWS = [
  ['ラーメン', 'rāmen', 'ramen'], ['カレー', 'karē', 'curry'], ['コーヒー', 'kōhī', 'coffee'], ['ビール', 'bīru', 'beer'],
  ['ジュース', 'jūsu', 'juice'], ['サラダ', 'sarada', 'salad'], ['セット', 'setto', 'set meal'], ['ランチ', 'ranchi', 'lunch'],
  ['メニュー', 'menyū', 'menu'], ['レジ', 'reji', 'checkout / till'], ['トイレ', 'toire', 'toilet'], ['コンビニ', 'konbini', 'convenience store'],
  ['チェックイン', 'chekkuin', 'check-in'], ['カード', 'kādo', 'card'], ['レシート', 'reshīto', 'receipt'], ['チャージ', 'chāji', 'top-up (IC card)'],
  ['ホット', 'hotto', 'hot (drink)'], ['アイス', 'aisu', 'iced / ice cream'], ['ミルク', 'miruku', 'milk'], ['ワイン', 'wain', 'wine'],
  ['ハイボール', 'haibōru', 'whisky highball'], ['パン', 'pan', 'bread'], ['ケーキ', 'kēki', 'cake'], ['サンド', 'sando', 'sandwich'],
  ['チキン', 'chikin', 'chicken'], ['ポーク', 'pōku', 'pork'], ['ビーフ', 'bīfu', 'beef'], ['カツ', 'katsu', 'breaded cutlet'],
  ['コロッケ', 'korokke', 'croquette'], ['ソース', 'sōsu', 'sauce'], ['ドリンク', 'dorinku', 'drink'], ['デザート', 'dezāto', 'dessert'],
  ['セルフ', 'serufu', 'self-service'], ['テイクアウト', 'teikuauto', 'takeaway'], ['サイズ', 'saizu', 'size'], ['レギュラー', 'regyurā', 'regular (size)'],
  ['エレベーター', 'erebētā', 'lift / elevator'], ['エスカレーター', 'esukarētā', 'escalator'], ['ホーム', 'hōmu', 'platform'], ['タクシー', 'takushī', 'taxi'],
  ['フロント', 'furonto', 'front desk'], ['ロッカー', 'rokkā', 'coin locker'],
];
export const MENU = MENU_ROWS.map(([jp, romaji, en]) => ({ id: `menu:${jp}`, deck: 'menu', jp, kana: jp, romaji, en, speak: jp, day: 14 }));

// Phrase rows: [id, jp, kana, romaji, en, speak, tags, extra]
// day by section follows the week plan: core ★ week 1, the rest of the
// core week 2, restaurant/konbini week 3, trains week 4, hotel/shopping
// week 5, directions/allergy/emergency week 6.
const P = (id, jp, kana, romaji, en, speak, tags, extra = {}) => ({ id: `ph:${id}`, deck: 'phrase', jp, kana, romaji, en, speak, tags, ...extra });
const CORE = { day: 7 }, STAR = { day: 0, star: true };

export const PHRASES = [
  // Core
  P('sumimasen', 'すみません', 'すみません', 'sumimasen', 'Excuse me / sorry / (calling staff)', 'すみません', ['core'], { ...STAR, notes: 'The all-purpose opener. Also how you call a server over.' }),
  P('arigatou', 'ありがとうございます', 'ありがとうございます', 'arigatō gozaimasu', 'Thank you', 'ありがとうございます', ['core'], STAR),
  P('onegai', '〜をお願いします', '〜をおねがいします', '~o onegaishimasu', '~, please', 'ラーメンをおねがいします', ['core'], { ...STAR, notes: 'Thing first, then をお願いします. Audio example: ラーメンをお願いします.' }),
  P('kore-kudasai', 'これをください', 'これをください', 'kore o kudasai', 'This one, please', 'これをください', ['core', 'shopping'], STAR),
  P('hai-iie', 'はい / いいえ', 'はい / いいえ', 'hai / iie', 'Yes / No', 'はい。いいえ。', ['core'], { ...STAR, notes: 'A flat いいえ can sound blunt. 大丈夫です is the softer no.' }),
  P('daijoubu', '大丈夫です', 'だいじょうぶです', 'daijōbu desu', "I'm fine / No thank you", 'だいじょうぶです', ['core'], { ...STAR, notes: 'Turns down a bag, a receipt, help. Polite and normal.' }),
  P('wakarimasen', 'わかりません', 'わかりません', 'wakarimasen', "I don't understand", 'わかりません', ['core'], STAR),
  P('mou-ichido', 'もう一度お願いします', 'もういちどおねがいします', 'mō ichido onegaishimasu', 'Once more, please', 'もういちどおねがいします', ['core'], STAR),
  P('yukkuri', 'ゆっくりお願いします', 'ゆっくりおねがいします', 'yukkuri onegaishimasu', 'Slowly, please', 'ゆっくりおねがいします', ['core'], CORE),
  P('doko', '〜はどこですか', '〜はどこですか', '~wa doko desu ka', 'Where is ~?', 'えきわどこですか', ['core', 'directions'], { ...STAR, notes: 'は is read "wa" here. Audio example: 駅はどこですか.' }),
  P('toire', 'トイレはどこですか', 'トイレはどこですか', 'toire wa doko desu ka', 'Where is the toilet?', 'トイレわどこですか', ['core'], STAR),
  P('ikura', 'いくらですか', 'いくらですか', 'ikura desu ka', 'How much is it?', 'いくらですか', ['core', 'shopping'], STAR),
  P('arimasu-ka', '〜はありますか', '〜はありますか', '~wa arimasu ka', 'Do you have ~?', 'えいごのメニューわありますか', ['core'], { ...CORE, notes: 'Audio example: 英語のメニューはありますか.' }),
  P('eigo-daijoubu', '英語は大丈夫ですか', 'えいごはだいじょうぶですか', 'eigo wa daijōbu desu ka', 'Is English OK?', 'えいごわだいじょうぶですか', ['core'], CORE),
  P('sukoshi', '日本語が少しだけわかります', 'にほんごがすこしだけわかります', 'nihongo ga sukoshi dake wakarimasu', 'I understand a little Japanese', 'にほんごがすこしだけわかります', ['core'], CORE),
  P('chotto-matte', 'ちょっと待ってください', 'ちょっとまってください', 'chotto matte kudasai', 'Just a moment, please', 'ちょっとまってください', ['core'], CORE),
  P('shashin', '写真を撮ってもいいですか', 'しゃしんをとってもいいですか', 'shashin o totte mo ii desu ka', 'May I take a photo?', 'しゃしんをとってもいいですか', ['core'], CORE),
  P('konnichiwa', 'こんにちは', 'こんにちは', 'konnichiwa', 'Hello (daytime)', 'こんにちわ', ['core'], CORE),
  P('konbanwa', 'こんばんは', 'こんばんは', 'konbanwa', 'Good evening', 'こんばんわ', ['core'], CORE),
  P('ohayou', 'おはようございます', 'おはようございます', 'ohayō gozaimasu', 'Good morning', 'おはようございます', ['core'], CORE),
  P('akemashite', 'あけましておめでとうございます', 'あけましておめでとうございます', 'akemashite omedetō gozaimasu', 'Happy New Year', 'あけましておめでとうございます', ['core', 'new-year'], { day: 42, notes: 'Said in early January, once the year has turned — not before.' }),

  // Restaurant
  P('futari', '二人です', 'ふたりです', 'futari desu', 'Two people', 'ふたりです', ['restaurant'], { ...STAR, notes: 'The answer to 何名様ですか. One person: 一人です (hitori desu).' }),
  P('eigo-menu', '英語のメニューはありますか', 'えいごのメニューはありますか', 'eigo no menyū wa arimasu ka', 'Do you have an English menu?', 'えいごのメニューわありますか', ['restaurant'], { day: 14 }),
  P('osusume', 'おすすめは何ですか', 'おすすめはなんですか', 'osusume wa nan desu ka', 'What do you recommend?', 'おすすめわなんですか', ['restaurant'], { day: 14 }),
  P('hitotsu', 'これを一つお願いします', 'これをひとつおねがいします', 'kore o hitotsu onegaishimasu', 'One of these, please', 'これをひとつおねがいします', ['restaurant'], { day: 14 }),
  P('omizu', 'お水をお願いします', 'おみずをおねがいします', 'omizu o onegaishimasu', 'Water, please', 'おみずをおねがいします', ['restaurant'], { day: 14 }),
  P('okaikei', 'お会計をお願いします', 'おかいけいをおねがいします', 'okaikei o onegaishimasu', 'The check, please', 'おかいけいをおねがいします', ['restaurant'], STAR),
  P('kaado', 'カードは使えますか', 'カードはつかえますか', 'kādo wa tsukaemasu ka', 'Can I use a card?', 'カードわつかえますか', ['restaurant', 'shopping'], { day: 14 }),
  P('itadakimasu', 'いただきます / ごちそうさまでした', 'いただきます / ごちそうさまでした', 'itadakimasu / gochisōsama deshita', '(before eating) / (after eating, thanks)', 'いただきます。ごちそうさまでした。', ['restaurant'], { day: 14, notes: 'ごちそうさまでした on the way out is a nice thank-you to the staff.' }),
  P('tennai', '店内で / 持ち帰りで', 'てんないで / もちかえりで', 'tennai de / mochikaeri de', 'For here / To go', 'てんないで。もちかえりで。', ['restaurant', 'konbini'], { day: 14 }),
  P('oomori', '大盛りで / 普通で', 'おおもりで / ふつうで', 'ōmori de / futsū de', 'Large portion / Regular', 'おおもりで。ふつうで。', ['restaurant'], { day: 14 }),
  P('shokken', '食券はどこで買いますか', 'しょっけんはどこでかいますか', 'shokken wa doko de kaimasu ka', 'Where do I buy a meal ticket?', 'しょっけんわどこでかいますか', ['restaurant'], { day: 14, notes: 'Ramen shops often have a ticket machine (券売機) by the door.' }),
  P('irasshaimase', 'いらっしゃいませ', 'いらっしゃいませ', 'irasshaimase', 'Welcome (staff greeting)', 'いらっしゃいませ', ['restaurant', 'konbini'], { day: 14, listen: true, notes: 'No reply needed. A nod is fine.' }),
  P('nanmei', '何名様ですか', 'なんめいさまですか', 'nanmei-sama desu ka', 'How many people?', 'なんめいさまですか', ['restaurant'], { day: 14, listen: true, notes: 'Answer: 二人です, or hold up fingers.' }),
  P('shoushou', '少々お待ちください', 'しょうしょうおまちください', 'shōshō omachi kudasai', 'Please wait a moment', 'しょうしょうおまちください', ['restaurant', 'hotel'], { day: 14, listen: true }),
  P('ijou', '以上でよろしいですか', 'いじょうでよろしいですか', 'ijō de yoroshii desu ka', 'Will that be all?', 'いじょうでよろしいですか', ['restaurant', 'konbini'], { day: 14, listen: true, notes: 'Answer: はい.' }),

  // Konbini / shopping
  P('fukuro', '袋はご利用ですか', 'ふくろはごりようですか', 'fukuro wa goriyō desu ka', 'Do you need a bag?', 'ふくろわごりようですか', ['konbini'], { day: 14, listen: true, notes: 'Answer: 袋お願いします (fukuro onegaishimasu) or 大丈夫です.' }),
  P('atatame', '温めますか', 'あたためますか', 'atatamemasu ka', 'Shall I heat it up?', 'あたためますか', ['konbini'], { day: 14, listen: true, notes: 'Answer: はい、お願いします or 大丈夫です.' }),
  P('pointo', 'ポイントカードはお持ちですか', 'ポイントカードはおもちですか', 'pointo kādo wa omochi desu ka', 'Do you have a point card?', 'ポイントカードわおもちですか', ['konbini', 'shopping'], { day: 14, listen: true, notes: 'Answer: ないです (nai desu).' }),
  P('miteiru', '見ているだけです', 'みているだけです', 'mite iru dake desu', 'Just looking', 'みているだけです', ['shopping'], { day: 28 }),
  P('shichaku', '試着してもいいですか', 'しちゃくしてもいいですか', 'shichaku shite mo ii desu ka', 'May I try it on?', 'しちゃくしてもいいですか', ['shopping'], { day: 28 }),
  P('hoka-iro', '他の色はありますか', 'ほかのいろはありますか', 'hoka no iro wa arimasu ka', 'Do you have other colours?', 'ほかのいろわありますか', ['shopping'], { day: 28 }),
  P('kore-ni', 'これにします', 'これにします', 'kore ni shimasu', "I'll take this", 'これにします', ['shopping'], { day: 28 }),
  P('menzei', '免税できますか', 'めんぜいできますか', 'menzei dekimasu ka', 'Can I buy this tax-free?', 'めんぜいできますか', ['shopping'], { day: 28, notes: 'Bring your passport.' }),

  // Trains
  P('made-ikura', '〜まで、いくらですか', '〜まで、いくらですか', '~made, ikura desu ka', 'How much to ~?', 'きょうとまで、いくらですか', ['trains'], { ...STAR, notes: 'Audio example: 京都まで、いくらですか.' }),
  P('densha-iku', 'この電車は〜に行きますか', 'このでんしゃは〜にいきますか', 'kono densha wa ~ni ikimasu ka', 'Does this train go to ~?', 'このでんしゃわしぶやにいきますか', ['trains'], { ...STAR, notes: 'Audio example: この電車は渋谷に行きますか.' }),
  P('nanbansen', '〜行きは何番線ですか', '〜いきはなんばんせんですか', '~iki wa nanbansen desu ka', 'Which platform for trains to ~?', 'しんじゅくいきわなんばんせんですか', ['trains'], { day: 21, notes: '行き (bound for) is also read ゆき on signs. Audio example: 新宿行きは何番線ですか.' }),
  P('norikae', '乗り換えはどこですか', 'のりかえはどこですか', 'norikae wa doko desu ka', 'Where do I transfer?', 'のりかえわどこですか', ['trains'], { day: 21 }),
  P('eki-doko', '〜駅はどこですか', '〜えきはどこですか', '~eki wa doko desu ka', 'Where is ~ station?', 'うえのえきわどこですか', ['trains', 'directions'], { day: 21, notes: 'Audio example: 上野駅はどこですか.' }),
  P('chaaji', 'チャージしたいです', 'チャージしたいです', 'chāji shitai desu', 'I want to top up (IC card)', 'チャージしたいです', ['trains'], { day: 21, notes: 'Suica/PASMO machines also have an English button.' }),
  // CHECK: JR Central's all-reserved Nozomi dates for this season (the notes say Dec 25 – Jan 5 and Jan 9–11).
  P('shitei', '指定席 / 自由席', 'していせき / じゆうせき', 'shiteiseki / jiyūseki', 'Reserved seat / Unreserved seat', 'していせき。じゆうせき。', ['trains'], { day: 21, notes: 'Around New Year some Nozomi trains are all-reserved.' }),
  P('tsugi-wa', '次は〜', 'つぎは〜', 'tsugi wa ~', 'Next stop is ~', 'つぎわ、しながわ', ['trains'], { day: 21, listen: true, notes: 'Audio example: 次は品川.' }),
  P('yuki-chien', '雪で遅れています', 'ゆきでおくれています', 'yuki de okurete imasu', "It's delayed because of snow", 'ゆきでおくれています', ['trains'], { day: 21, listen: true, notes: 'On boards: 遅延 (chien, delay).' }),

  // Hotel
  P('checkin', 'チェックインをお願いします', 'チェックインをおねがいします', 'chekkuin o onegaishimasu', 'Check-in, please', 'チェックインをおねがいします', ['hotel'], STAR),
  P('yoyaku', '予約しています。〜です', 'よやくしています。〜です', 'yoyaku shite imasu. ~desu', "I have a reservation. I'm ~", 'よやくしています。リサです。', ['hotel'], { day: 28, notes: 'Your name goes before です. Audio example: リサです.' }),
  P('nimotsu', '荷物を預かってもらえますか', 'にもつをあずかってもらえますか', 'nimotsu o azukatte moraemasu ka', 'Can you keep my luggage?', 'にもつをあずかってもらえますか', ['hotel'], { day: 28 }),
  P('checkout', 'チェックアウトは何時ですか', 'チェックアウトはなんじですか', 'chekkuauto wa nanji desu ka', 'What time is check-out?', 'チェックアウトわなんじですか', ['hotel'], { day: 28 }),
  P('asagohan', '朝ご飯は何時からですか', 'あさごはんはなんじからですか', 'asagohan wa nanji kara desu ka', 'From what time is breakfast?', 'あさごはんわなんじからですか', ['hotel'], { day: 28 }),
  P('wifi', 'Wi-Fiのパスワードは何ですか', 'ワイファイのパスワードはなんですか', 'waifai no pasuwādo wa nan desu ka', "What's the Wi-Fi password?", 'ワイファイのパスワードわなんですか', ['hotel'], { day: 28 }),

  // Directions
  P('ikitai', '〜へ行きたいです', '〜へいきたいです', '~e ikitai desu', 'I want to go to ~', 'あさくさえいきたいです', ['directions'], { day: 35, notes: 'へ is read "e" here. Audio example: 浅草へ行きたいです.' }),
  P('chizu', '地図で教えてもらえますか', 'ちずでおしえてもらえますか', 'chizu de oshiete moraemasu ka', 'Could you show me on the map?', 'ちずでおしえてもらえますか', ['directions'], { day: 35 }),
  P('aruite', '歩いて何分ですか', 'あるいてなんぷんですか', 'aruite nanpun desu ka', 'How many minutes on foot?', 'あるいてなんぷんですか', ['directions'], { day: 35 }),
  P('massugu', 'まっすぐ', 'まっすぐ', 'massugu', 'Straight ahead', 'まっすぐ', ['directions'], { day: 35, listen: true }),
  P('migi', '右', 'みぎ', 'migi', 'Right', 'みぎ', ['directions'], { day: 35, listen: true }),
  P('hidari', '左', 'ひだり', 'hidari', 'Left', 'ひだり', ['directions'], { day: 35, listen: true }),
  P('kado', '角', 'かど', 'kado', 'Corner', 'かど', ['directions'], { day: 35, listen: true }),
  P('shingou', '信号', 'しんごう', 'shingō', 'Traffic light', 'しんごう', ['directions'], { day: 35, listen: true }),
  P('aite', '今日は開いていますか', 'きょうはあいていますか', 'kyō wa aite imasu ka', 'Are you open today?', 'きょうわあいていますか', ['directions', 'new-year'], { day: 35, notes: 'Worth asking around 29 Dec – 3 Jan, when many places close.' }),
  P('nanji-made', '何時までですか', 'なんじまでですか', 'nanji made desu ka', 'Until what time?', 'なんじまでですか', ['directions', 'new-year'], { day: 35 }),

  // Allergy / diet
  P('arerugii', '〜アレルギーがあります', '〜アレルギーがあります', '~arerugī ga arimasu', "I'm allergic to ~", 'えびアレルギーがあります', ['allergy'], { ...STAR, notes: 'Allergen first. Audio example: えびアレルギーがあります.' }),
  P('haitte', '〜は入っていますか', '〜ははいっていますか', '~wa haitte imasu ka', 'Does this contain ~?', 'たまごわはいっていますか', ['allergy'], { day: 35, notes: 'Audio example: 卵は入っていますか.' }),
  P('nuki', '〜抜きでお願いします', '〜ぬきでおねがいします', '~nuki de onegaishimasu', 'Without ~, please', 'ねぎぬきでおねがいします', ['allergy'], { day: 35, notes: 'Audio example: ねぎ抜きでお願いします (no spring onion).' }),
  P('niku', '肉', 'にく', 'niku', 'Meat', 'にく', ['allergy'], { day: 35 }),
  P('sakana', '魚', 'さかな', 'sakana', 'Fish', 'さかな', ['allergy'], { day: 35 }),
  P('tamago', '卵', 'たまご', 'tamago', 'Egg', 'たまご', ['allergy'], { day: 35 }),
  P('nyuuseihin', '乳製品', 'にゅうせいひん', 'nyūseihin', 'Dairy', 'にゅうせいひん', ['allergy'], { day: 35 }),
  P('komugi', '小麦', 'こむぎ', 'komugi', 'Wheat', 'こむぎ', ['allergy'], { day: 35 }),
  P('soba', 'そば', 'そば', 'soba', 'Buckwheat', 'そば', ['allergy'], { day: 35 }),
  P('ebi', 'えび', 'えび', 'ebi', 'Shrimp / prawn', 'えび', ['allergy'], { day: 35 }),
  P('kani', 'かに', 'かに', 'kani', 'Crab', 'かに', ['allergy'], { day: 35 }),
  P('piinattsu', 'ピーナッツ', 'ピーナッツ', 'pīnattsu', 'Peanut', 'ピーナッツ', ['allergy'], { day: 35 }),
  P('taberaremasen', '肉と魚が食べられません', 'にくとさかながたべられません', 'niku to sakana ga taberaremasen', "I can't eat meat or fish", 'にくとさかながたべられません', ['allergy'], { day: 35, notes: 'Most broths use fish stock (だし dashi). Carry a written card too.' }),

  // Emergency
  P('tasukete', '助けてください', 'たすけてください', 'tasukete kudasai', 'Help, please', 'たすけてください', ['emergency'], STAR),
  P('kyuukyuusha', '救急車を呼んでください', 'きゅうきゅうしゃをよんでください', 'kyūkyūsha o yonde kudasai', 'Please call an ambulance', 'きゅうきゅうしゃをよんでください', ['emergency'], { day: 35, notes: 'Ambulance and fire 119, police 110.' }),
  P('kibun', '気分が悪いです', 'きぶんがわるいです', 'kibun ga warui desu', 'I feel sick', 'きぶんがわるいです', ['emergency'], { day: 35 }),
  P('mayoi', '道に迷いました', 'みちにまよいました', 'michi ni mayoimashita', "I'm lost", 'みちにまよいました', ['emergency', 'directions'], { day: 35 }),
  P('saifu', '財布をなくしました', 'さいふをなくしました', 'saifu o nakushimashita', 'I lost my wallet', 'さいふをなくしました', ['emergency'], { day: 35, notes: 'The 交番 (kōban, police box) handles lost property.' }),
  P('yakkyoku', '薬局はどこですか', 'やっきょくはどこですか', 'yakkyoku wa doko desu ka', 'Where is a pharmacy?', 'やっきょくわどこですか', ['emergency'], { day: 35, notes: 'Hospital: 病院 (byōin).' }),
];

// Cards with a blank (〜) are practised as a real sentence. The prompt,
// the answer and the audio use the example; the pattern and a note on
// what fills the blank come after. Progress stays on the pattern's id.
//   id: [jp, kana, romaji, en, pattern note]
const EXAMPLES = {
  'ph:onegai': ['ラーメンをお願いします', 'ラーメンをおねがいします', 'rāmen o onegaishimasu', 'Ramen, please', 'Any thing + をお願いします. を (said "o") marks the thing you want.'],
  'ph:doko': ['駅はどこですか', 'えきはどこですか', 'eki wa doko desu ka', 'Where is the station?', 'Any place + はどこですか. は is said "wa" here: it marks what you’re asking about.'],
  'ph:arimasu-ka': ['コインロッカーはありますか', 'コインロッカーはありますか', 'koin rokkā wa arimasu ka', 'Are there coin lockers?', 'Any thing + はありますか (said "wa arimasu ka").'],
  'ph:made-ikura': ['京都まで、いくらですか', 'きょうとまで、いくらですか', 'Kyōto made, ikura desu ka', 'How much to Kyoto?', 'Any place + まで (to, as far as), then いくらですか.'],
  'ph:densha-iku': ['この電車は渋谷に行きますか', 'このでんしゃはしぶやにいきますか', 'kono densha wa Shibuya ni ikimasu ka', 'Does this train go to Shibuya?', 'Any place + に (to) goes in the gap.'],
  'ph:nanbansen': ['新宿行きは何番線ですか', 'しんじゅくいきはなんばんせんですか', 'Shinjuku-iki wa nanbansen desu ka', 'Which platform for trains to Shinjuku?', 'Destination + 行き (bound for). On signs 行き is also read ゆき.'],
  'ph:eki-doko': ['上野駅はどこですか', 'うえのえきはどこですか', 'Ueno-eki wa doko desu ka', 'Where is Ueno Station?', 'Station name + 駅はどこですか.'],
  'ph:tsugi-wa': ['次は品川', 'つぎはしながわ', 'tsugi wa Shinagawa', 'Next stop is Shinagawa', 'The announcement, then the station name.'],
  'ph:yoyaku': ['予約しています。リサです', 'よやくしています。リサです', 'yoyaku shite imasu. Risa desu', 'I have a reservation. I’m Lisa', 'Your name goes before です.'],
  'ph:ikitai': ['浅草へ行きたいです', 'あさくさへいきたいです', 'Asakusa e ikitai desu', 'I want to go to Asakusa', 'Any place + へ (to; said "e") + 行きたいです.'],
  'ph:arerugii': ['えびアレルギーがあります', 'えびアレルギーがあります', 'ebi arerugī ga arimasu', 'I’m allergic to shrimp', 'The allergen + アレルギーがあります. See the allergy words for more.'],
  'ph:haitte': ['卵は入っていますか', 'たまごははいっていますか', 'tamago wa haitte imasu ka', 'Does this contain egg?', 'Ingredient + は入っていますか.'],
  'ph:nuki': ['ねぎ抜きでお願いします', 'ねぎぬきでおねがいします', 'negi-nuki de onegaishimasu', 'No spring onion, please', 'Ingredient + 抜き (without) + でお願いします.'],
};
for (const p of PHRASES) {
  const e = EXAMPLES[p.id];
  if (!e) continue;
  const [jp, kana, romaji, en, notes] = e;
  p.example = { jp, kana, romaji, en };
  p.notes = notes;
}
// The only example whose audio changes: it used to say 英語のメニューはありますか,
// which is its own card.
PHRASES.find((p) => p.id === 'ph:arimasu-ka').speak = 'コインロッカーわありますか';

// Signs. Pick-the-meaning quiz, shown styled like a sign. 1–15 unlock in
// week 4, the rest in week 5.
const SIGN_ROWS = [
  ['入口', 'いりぐち', 'iriguchi', 'Entrance'], ['出口', 'でぐち', 'deguchi', 'Exit'],
  ['東口', 'ひがしぐち', 'higashiguchi', 'East exit', '西口 west, 南口 south, 北口 north.'],
  ['駅', 'えき', 'eki', 'Station'], ['改札', 'かいさつ', 'kaisatsu', 'Ticket gate'],
  ['〜行き', '〜いき / 〜ゆき', '~iki / ~yuki', 'Bound for ~'], ['番線', 'ばんせん', 'bansen', 'Platform (number)'],
  ['乗り換え', 'のりかえ', 'norikae', 'Transfer'], ['男', 'おとこ', 'otoko', 'Men'], ['女', 'おんな', 'onna', 'Women'],
  ['お手洗い', 'おてあらい', 'otearai', 'Toilet'], ['禁煙', 'きんえん', 'kin’en', 'No smoking'],
  ['喫煙所', 'きつえんじょ', 'kitsuenjo', 'Smoking area'], ['禁止', 'きんし', 'kinshi', 'Prohibited', 'Anything + 禁止 is "no ~".'],
  ['立入禁止', 'たちいりきんし', 'tachiiri kinshi', 'No entry'],
  ['押', 'おす', 'osu', 'Push'], ['引', 'ひく', 'hiku', 'Pull'],
  ['営業中', 'えいぎょうちゅう', 'eigyōchū', 'Open (for business)', '中 means "in progress".'],
  ['準備中', 'じゅんびちゅう', 'junbichū', 'Preparing (closed for now)'], ['定休日', 'ていきゅうび', 'teikyūbi', 'Regular day off'],
  ['休業', 'きゅうぎょう', 'kyūgyō', 'Closed for business'], ['年末年始', 'ねんまつねんし', 'nenmatsu nenshi', 'Year-end / New Year holidays', 'Often on closure notices with dates.'],
  ['円', 'えん', 'en', 'Yen'], ['税込', 'ぜいこみ', 'zeikomi', 'Tax included'], ['税抜', 'ぜいぬき', 'zeinuki', 'Before tax'],
  ['大人', 'おとな', 'otona', 'Adult'], ['子供', 'こども', 'kodomo', 'Child'], ['非常口', 'ひじょうぐち', 'hijōguchi', 'Emergency exit'],
  ['危険', 'きけん', 'kiken', 'Danger'], ['無料', 'むりょう', 'muryō', 'Free (no charge)', '有料 (yūryō) is "paid".'],
  ['本日', 'ほんじつ', 'honjitsu', 'Today', '本日休業 = closed today.'], ['休み', 'やすみ', 'yasumi', 'Closed / day off'],
  ['遅延', 'ちえん', 'chien', 'Delay (trains)'], ['雪', 'ゆき', 'yuki', 'Snow'],
  ['福袋', 'ふくぶくろ', 'fukubukuro', 'Lucky bag (New Year sale)', 'Sales usually start around 2 January.'],
  ['初詣', 'はつもうで', 'hatsumōde', 'First shrine visit of the year'],
];
export const SIGNS = SIGN_ROWS.map(([jp, kana, romaji, en, notes], i) => ({
  id: `sign:${jp}`, deck: 'sign', jp, kana, romaji, en, ...(notes ? { notes } : {}), speak: kana.split(' / ')[0].replace('〜', ''), day: i < 15 ? 21 : 28,
}));

// Number rules: the irregular forms, as flashcards. Readings are checked
// against toJapaneseReading in the tests.
const N = (id, jp, kana, romaji, en, notes) => ({ id: `num:${id}`, deck: 'num', jp, kana, romaji, en, speak: kana.split(' / ')[0], day: 7, ...(notes ? { notes } : {}) });
export const NUMBERS = [
  N('4', '4', 'よん / し', 'yon / shi', 'four', 'Say よん. し also means death, so it’s avoided.'),
  N('7', '7', 'なな / しち', 'nana / shichi', 'seven', 'Say なな; しち is easy to confuse with いち.'),
  N('9', '9', 'きゅう / く', 'kyū / ku', 'nine'),
  N('300', '300', 'さんびゃく', 'sanbyaku', '300', '三 voices the next sound: ひゃく → びゃく.'),
  N('600', '600', 'ろっぴゃく', 'roppyaku', '600', '六 doubles it: ろっ + ぴゃく.'),
  N('800', '800', 'はっぴゃく', 'happyaku', '800', '八 doubles it: はっ + ぴゃく.'),
  N('3000', '3,000', 'さんぜん', 'sanzen', '3,000'),
  N('6000', '6,000', 'ろくせん', 'rokusen', '6,000', 'Regular! ろっせん is the classic overcorrection.'),
  N('8000', '8,000', 'はっせん', 'hassen', '8,000'),
  N('10000', '10,000', 'いちまん', 'ichiman', '10,000', '万 always takes its number: いちまん, never just まん.'),
  N('4yen', '¥4', 'よえん', 'yoen', '4 yen'),
  N('hours', '4時 / 7時 / 9時', 'よじ / しちじ / くじ', 'yoji / shichiji / kuji', "4, 7 and 9 o'clock"),
  N('people', '1人 / 2人 / 4人', 'ひとり / ふたり / よにん', 'hitori / futari / yonin', '1, 2 and 4 people', 'From three on it’s regular: さんにん, ごにん.'),
  N('fun', '1分 / 3分 / 10分', 'いっぷん / さんぷん / じゅっぷん', 'ippun / sanpun / juppun', '1, 3 and 10 minutes'),
];

export const ITEMS = [...KANA, ...MENU, ...PHRASES, ...SIGNS, ...NUMBERS];
export const ITEM = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

export const DECKS = {
  hira: { name: 'Hiragana', newPerDay: 15, retention: 'core' },
  kata: { name: 'Katakana', newPerDay: 15, retention: 'core' },
  menu: { name: 'Katakana words', newPerDay: 6, retention: 'rest' },
  num: { name: 'Number rules', newPerDay: 6, retention: 'core' },
  phrase: { name: 'Phrases', newPerDay: 6, retention: 'rest' },
  sign: { name: 'Signs', newPerDay: 4, retention: 'rest' },
};
// Order the daily session works through: kana first, everything else
// depends on it.
export const DECK_ORDER = ['hira', 'kata', 'menu', 'num', 'phrase', 'sign'];

// Which ways an item is quizzed. Each one is its own card.
//   recognize  see it → pick (romaji for kana, meaning for words/signs)
//   listen     hear it → pick the kana / say what it means
//   produce    see the English → say it → reveal and grade yourself
export function directionsFor(item) {
  if (item.deck === 'hira' || item.deck === 'kata') {
    // を sounds like お, so a listening quiz has two right answers.
    return item.word || item.jp === 'を' || item.jp === 'ヲ' ? ['recognize'] : ['recognize', 'listen'];
  }
  if (item.deck === 'phrase') return [item.listen ? 'listen' : 'produce'];
  if (item.deck === 'num') return ['produce'];
  return ['recognize'];
}

export const TOFUGU = {
  hira: 'https://www.tofugu.com/japanese/learn-hiragana/',
  kata: 'https://www.tofugu.com/japanese/learn-katakana/',
};
