# Japan Prep

A daily 20–30 minute trainer for a trip to Japan: kana, ~90 survival
phrases, ~36 signs, katakana menu words, and generated drills for prices,
times, counters and platform numbers. Reviews run on FSRS, capped so every
card comes back before the trip date. Installable, works offline.

Built from a research write-up Lisa had done (kept outside the repo). The
parts of it this app follows, and where it departs:

## What's in

- **Daily session.** Today → Start runs due kana, then phrases/signs, then
  three minutes of number drills.
- **Scheduling** (`srs.js`). FSRS-5 with its default weights, written out
  here rather than pulled from `ts-fsrs`, since nothing here ships from npm.
  Target recall 0.92 for kana and numbers, 0.90 for the rest. Learning steps
  are 1 and 10 minutes, with no fuzz. The longest interval is
  `daysLeft − 2`, kept between 1 and 21 (`maxInterval`), and `dueAt` applies
  it at read time, so the cap shrinking each day pulls older cards in.
- **Pre-trip sweep.** Turns on by itself 5 days out, or from Settings. No
  new cards; anything with predicted recall under 0.95 is shown, weakest
  first.
- **Grading.** Kana, signs and menu words are multiple choice and graded
  automatically: wrong is Again, right but over 6 s is Hard. Phrases and
  number rules are graded by you, with Again / Good / Easy or a swipe.
- **Unlocks** count days from the start date: hiragana and starred phrases
  on day 0, katakana on day 6, number rules in week 2, menu words and
  restaurant/konbini in week 3, trains and signs 1–15 in week 4, and so on
  (`day` in `content.js`).
- **Phrasebook.** Everything, searchable, with audio at 1× and 0.75×.
- **Roleplay** (`roleplay.js`). Five scenes (ramen shop, train ticket, hotel,
  directions, konbini) at three levels. It builds a prompt you copy into the
  Claude app, with no API key needed. Claude plays the staff and gives
  corrections at the end. On the plan's roleplay days (Tue/Thu/Sat from
  week 3, every other day in week 8), Today suggests a scene.
- **Stroke order** on the teaching screen for kana and sign kanji, animated
  from [KanjiVG](https://kanjivg.tagaini.net/) (CC BY-SA 3.0, credited on
  screen). Each file is fetched from jsDelivr the first time it's shown and
  then cached by `sw.js`, so it needs a connection once per character
  (`strokes.js`).

## Deliberately different from the write-up

- **No Vite/React/Dexie/ts-fsrs.** This repo has no build step. State is one
  `localStorage` key, `japan-prep:state` (see `normalizeState`). Review logs
  are kept compact so two months of use stays well under the quota.
- **Audio is the browser voice only.** The write-up recommends committed
  MP3s from Google Cloud TTS for fixed phrases. That needs a billing account
  (or a Mac's `say -v Kyoko`), so it isn't done yet. Each item's `speak`
  string is written phonetically (particle は as わ) so the browser voice
  reads it right. Adding MP3s later means an `audio` field and a precache
  entry in `sw.js`.
- **No cloud sync, and roleplay runs in the Claude app.** An in-app version
  and sync both need a server holding a secret (the write-up's Cloudflare
  Worker). For now, Settings → Download
  backup / Import merges a JSON export (newer cards win, history unioned), and
  that also moves progress between devices.
- **No speech recognition**, as the write-up advises.

## Open questions

`grep -rn CHECK: .` lists them. The main ones: a native speaker should read
`PHRASES` and `SIGNS` once, and the FSRS-5 default weights in `srs.js` should
be checked against the published list.
