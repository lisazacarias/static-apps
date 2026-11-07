// Roleplay scenes for practising with Claude in the Claude app. No API
// key: the app builds a prompt, you copy it into a chat. No DOM, so the
// tests import it as shipped.
//
// Scenes, levels and the week plan follow the research notes (see
// README.md). The prompt asks for the polite register real staff use and
// for corrections at the end, rather than mid-scene.

export const SCENES = [
  {
    id: 'ramen', name: 'Ramen shop', emoji: '🍜',
    who: 'a staff member at a small ramen shop in Tokyo that has a ticket machine (券売機) by the door',
    goal: 'get seated, buy and hand over a meal ticket, answer questions about the order (noodle firmness, portion size), ask for water, and leave politely',
  },
  {
    id: 'train', name: 'Train ticket', emoji: '🚄',
    who: 'a clerk at the JR ticket office (みどりの窓口) at Tokyo Station',
    goal: 'buy a Shinkansen ticket to Kyoto for tomorrow morning, choose a reserved or unreserved seat, ask the price, and ask which platform it leaves from',
  },
  {
    id: 'hotel', name: 'Hotel check-in', emoji: '🏨',
    who: 'a receptionist at the front desk of a business hotel in Osaka',
    goal: 'check in with a reservation, ask what time breakfast starts and what the Wi-Fi password is, and ask to leave luggage after checking out tomorrow',
  },
  {
    id: 'directions', name: 'Asking directions', emoji: '🗺️',
    who: 'a friendly local in their thirties standing near a big crossing in Shibuya',
    goal: 'ask the way to the nearest station, understand left/right/straight/traffic-light directions, and ask how many minutes it takes on foot',
  },
  {
    id: 'konbini', name: 'Konbini', emoji: '🏪',
    who: 'a clerk at the register of a convenience store (コンビニ)',
    goal: 'buy a bento and a drink, answer whether to heat it up, whether a bag is needed and whether there is a point card, and pay by card',
  },
];
export const SCENE = Object.fromEntries(SCENES.map((s) => [s.id, s]));

export const LEVELS = {
  1: {
    name: 'L1 · Beginner',
    rules: 'Use very short, simple sentences. Write each of your lines three times: in kana, then in romaji, then in English in brackets. After each line, give me 3 short reply options I could use, each in kana, romaji and English.',
  },
  2: {
    name: 'L2 · Getting there',
    rules: 'Use short, natural sentences. Write each line in kana (with kanji only where very common), then romaji. Don’t give English unless I type "eigo?". After each line, give me 2 short reply hints in romaji.',
  },
  3: {
    name: 'L3 · Like the real thing',
    rules: 'Speak the way real staff do, including the set keigo phrases they use, written in normal Japanese (kanji and kana). No romaji, no English and no hints unless I type "help".',
  },
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// "late January" from 2027-01-25: when the trip is, for the scene's setting.
export function tripWhen(tripDate) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tripDate || '');
  if (!m) return 'soon';
  const day = Number(m[3]);
  return `${day <= 10 ? 'early' : day <= 20 ? 'mid' : 'late'} ${MONTHS[Number(m[2]) - 1]}`;
}

// The full prompt for a scene at a level, ready to paste into Claude.
export function promptFor(sceneId, level, tripDate) {
  const s = SCENE[sceneId];
  const l = LEVELS[level];
  if (!s || !l) throw new Error(`no scene ${sceneId} at level ${level}`);
  return [
    `Let's do a Japanese roleplay. You are ${s.who}. I'm a beginner tourist visiting Japan in ${tripWhen(tripDate)} (I speak English and Spanish). My goal in this scene: ${s.goal}.`,
    '',
    `Level ${level}: ${l.rules}`,
    '',
    'Rules for the scene:',
    '- Stay in character and use the polite register real staff use with customers. Never use casual or anime-style speech.',
    '- You speak first. Keep each turn to one or two sentences.',
    '- I may answer in Japanese, romaji, or English when I’m stuck. Reply in character either way, and gently nudge me back to Japanese.',
    '- If what I say is understandable, carry on naturally and briefly echo the correct way to say it, as a real clerk might. If it isn’t, react like a real clerk would (すみません、もう一度お願いします).',
    '- Don’t explain grammar during the scene.',
    '- End the scene when my goal is done, or after about 12 turns.',
    '',
    'When the scene ends, write "— end of scene —" and then give me feedback:',
    '1. Each line of mine that could be more natural, more polite or more correct: what I said → a better version (kana and romaji) → why, in 20 words or fewer. Point out anything rude or anime-style.',
    '2. Two things I did well.',
    '3. Up to three phrases worth adding to my flashcards, each in kana, romaji and English.',
  ].join('\n');
}

// Roleplay days and scenes from the 11-week plan. Tuesdays, Thursdays and
// Saturdays (weekday 0 = Sunday), except in the final week:
//   weeks 3–6, by week since the start date: one scene a week, L1 → L2
//   weeks 7–8 (35–22 days out): all five scenes in turn at L2
//   weeks 9–10 (21–8 days out): all five in turn at L3
//   week 11 (the last 7 days): an L3 scene every other day, 7, 5, 3 and 1 days out
// The last three count back from the trip date (daysLeft), like stageOf in
// session.js. → { scene, level } or null.
const EARLY = {
  3: [['ramen', 1], ['ramen', 1], ['ramen', 1]],
  4: [['train', 1], ['train', 2], ['train', 2]],
  5: [['hotel', 1], ['hotel', 2], ['hotel', 2]],
  6: [['directions', 2], ['ramen', 2], ['directions', 2]],
};
const ROLEPLAY_DAYS = [2, 4, 6]; // Tue, Thu, Sat
const ROTATION = ['konbini', 'ramen', 'train', 'hotel', 'directions'];

export function sceneFor({ week, weekday, daysLeft }) {
  if (daysLeft < 0) return null;
  if (daysLeft <= 7) {
    if (daysLeft % 2 === 0) return null;
    return { scene: ROTATION[((7 - daysLeft) / 2) % ROTATION.length], level: 3 };
  }
  const slot = ROLEPLAY_DAYS.indexOf(weekday);
  if (slot < 0) return null;
  if (daysLeft <= 35) {
    // A new scene each roleplay day: count the Tue/Thu/Sat days already
    // passed since 35 days out. Counting real days, not weeks, keeps the
    // rotation whole whatever weekday the trip falls on.
    let n = 0;
    for (let back = 1; back <= 35 - daysLeft; back++) {
      if (ROLEPLAY_DAYS.includes((((weekday - back) % 7) + 7) % 7)) n++;
    }
    return { scene: ROTATION[n % ROTATION.length], level: daysLeft <= 21 ? 3 : 2 };
  }
  const plan = EARLY[week];
  if (!plan) return null;
  const [scene, level] = plan[slot];
  return { scene, level };
}

// Claude's new-chat page. The ?q= parameter pre-fills the message box.
// CHECK: does claude.ai/new still honour ?q=? If not, the copied prompt still works by pasting.
export const claudeUrl = (prompt) => `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
