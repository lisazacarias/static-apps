// The flexibility plan: the session menu, the weekly rules, and what the
// app's Guide shows. Converted from "Flexibility Plan: Session Menu and
// Weekly Rules" (updated 2026-10-23); edit here from now on.
//
//   sessions  { id, title, kind 'big'|'short'|'prep', length, minutes, about?,
//             notes?, sections, after?, deload?, short? }
//   sections  [{ title?, minutes?, note?, items }]; an item marked whole is
//             the section itself
//   item      { name, duration, detail?, cues? }. [n] in any text cites
//             guide.references
//   guide     minimums, placement rules, example weeks, stop rules, deload,
//             progress log, busy week, physio questions, references
//   library   longer write-ups from the earlier calendar plan, keyed by
//             moveKey() in plan.js — kept for setup and form; the session's
//             own times and reps win
export default {
  "guide": {
    "updated": "2026-10-23",
    "intro": "Updated October 23, 2026. This plan is built from a menu of sessions and a few placement rules, so you can build each week around whatever pole, dance, rehearsal and climbing sessions you have. Numbers in square brackets point to the reference list at the end. Placement rules marked \"coaching judgment\" come from clinical and coaching sources and from reasoning about recovery. No study compares weekly schedules directly.",
    "howTo": [
      "Write down the week's classes first: pole (including pole tricks), dance, any rehearsal or run-through, and any climbing or skating.",
      "Check that the week has every item in the weekly minimums below.",
      "Place the three big sessions using the placement rules. Fill the gaps with the short sessions.",
      "If you are sore, tired or short of time, use a session's short version. Do not skip the week's minimums entirely."
    ],
    "minimumsNote": "These give you three exposures a week to each of your priority areas. In the one maintenance trial I found, three sessions a week held range of motion and one a week did not, though confidence in that finding is low [37].",
    "minimums": [
      {
        "session": "splits-intensive",
        "count": 1,
        "serves": "Front splits (goal 1), middle split (goal 3)"
      },
      {
        "session": "shoulder-hyperflexion",
        "count": 1,
        "serves": "Shoulder hyperflexion (goal 2)"
      },
      {
        "session": "hips-backbend",
        "count": 1,
        "serves": "Backbend (goal 4), plus a lighter front-split and middle-split exposure"
      },
      {
        "session": "splits-snack",
        "count": 1,
        "serves": "Third front-split and middle-split exposure"
      },
      {
        "session": "shoulder-recovery",
        "count": 1,
        "serves": "Second shoulder exposure"
      },
      {
        "session": "shoulder-reset",
        "count": 1,
        "serves": "Third shoulder exposure"
      }
    ],
    "rules": [
      {
        "rule": "Splits Intensive goes on the free day with the most recovery before your next hard class.",
        "why": "Aim for at least 48 hours, and 72 if you can. It includes eccentric hamstring work, and soreness from eccentric work typically peaks 24 to 72 hours later [39].",
        "evidence": "coaching judgment, consistent with the clinical literature on lengthened-state eccentric training [40]"
      },
      {
        "rule": "Shoulder Hyperflexion goes on a free day, at least 48 hours before pole and 24 hours after it.",
        "why": "Never on a pole or pole-tricks day. Shoulders are the most common pole injury site [12][13].",
        "evidence": "coaching judgment"
      },
      {
        "rule": "Hips & Backbend goes on a free evening, never on a pole day.",
        "why": "If pole is the next day, stop bridging at 2 reps and about 80% of your usual depth.",
        "evidence": "coaching judgment"
      },
      {
        "rule": "Do not do loaded end-range work for the same region on consecutive days.",
        "why": "That covers eccentric hamstring work, bridge depth and hyperflexion lift-offs.",
        "evidence": "coaching judgment"
      },
      {
        "rule": "Class days get dynamic prep only.",
        "why": "Use the Class-day prep module below, with any static holds kept under 60 seconds per muscle group. Short holds cost only about 1 to 2% of strength and power [34], and the 2024 meta-analysis found holds over 60 seconds impair isolated maximal strength while jumping and sprinting were not significantly reduced [35]. In one extreme study, about 30 minutes of calf stretching left a 9% strength deficit an hour later [34]. Keep long passive work for a non-class day, or at least a few hours before class.",
        "evidence": "research-backed"
      },
      {
        "rule": "After class, stretching is optional.",
        "why": "It is not a proven recovery tool [3]. If you do stretch, stay at your usual depth and never chase new depth when tired.",
        "evidence": "research-backed (recovery) and coaching judgment (depth)"
      },
      {
        "rule": "Late sessions are maintenance only.",
        "why": "Gentle stretching at 9 to 10 PM does not harm sleep [21], but strenuous exercise within about 4 hours of sleep can [22]. Rehearsal and pole are the likelier culprits than stretching.",
        "evidence": "research-backed"
      },
      {
        "rule": "Fill the gaps with the short sessions.",
        "why": "The Splits Snack, Shoulder Reset and Shoulder Recovery are low-risk and keep your weekly exposures up.",
        "evidence": "research-backed for exposure counts (low confidence), coaching judgment for placement"
      },
      {
        "rule": "If a session is cut, use its short version.",
        "why": "A skipped week costs little, because range gains stay above baseline for 2 to 6 weeks after stretching stops, with a small decline [37].",
        "evidence": "research-backed"
      }
    ],
    "busyWeek": {
      "intro": "Keep three exposures to your top two goals and skip the rest.",
      "items": [
        "Splits Intensive, 18-minute version, once.",
        "Splits Snack, once or twice.",
        "Shoulder Hyperflexion, 18-minute version, once.",
        "Shoulder Reset, 5-minute version, once or twice.",
        "Skip Hips & Backbend if you must. Do its 20-minute version if you can."
      ]
    },
    "deload": "Every 4th week, use short versions of every session, drop depth chasing, skip the eccentric lowering in Splits Intensive and Round 2 in Shoulder Hyperflexion, and keep bridges to 2 reps at 80% depth. Also deload in any week with illness, poor sleep or a performance, and move the fixed deload rather than stacking two. This is standard coaching practice. I found no flexibility-specific trial testing deload timing.",
    "progressLog": "Every 4 weeks, measure cold and at the same time of day: front-split height from the floor (each side), middle-split width, bridge hand-to-heel distance, and supine shoulder flexion with the lower back flat [31]. This shows whether the plan is working, which matters more when your schedule changes from week to week.",
    "stopIntro": "These apply in every session. Stop the drill and drop to an easier version if you notice any of the following.",
    "stopRules": [
      {
        "area": "Shoulder",
        "text": "A deep or front-of-shoulder pinch (rather than a lat or armpit stretch), clicking or clunking, a dead-arm feeling, tingling or numbness into the arm, or shoulder ache still present the next morning [20]."
      },
      {
        "area": "Wrist",
        "text": "Pinching at the back of the wrist in weight-bearing, or wrist pain lasting into the next day [19]."
      },
      {
        "area": "Low back",
        "text": "Sharp or one-sided low-back pain when arching, pain when standing on one leg and leaning back, or low-back pain that lasts more than a few days or returns after backbend days. See a physio or sports doctor if it lasts 1 to 2 weeks, because standard X-rays can miss pars stress injuries [16][17][18]."
      },
      {
        "area": "Hamstring",
        "text": "Sharp pain or a pop high at the sit bone during front splits, or bruising afterward. All hamstring injuries in one pole cohort came from front-split moves [12]."
      }
    ],
    "questions": [
      "A filmed side view of your bridge, plus a hip extension measurement, to see whether the bend is shared across hips, thoracic spine and shoulders or hinges in the lower back [15].",
      "Whether your age and back history change how much lumbar extension volume suits you.",
      "Optional: a shoulder stability exam before adding any external load at end-range shoulder flexion. Since you are not hypermobile, this is lower priority than it would be otherwise, but the benefit of passive loading is unsupported either way [33].",
      "Whether your eccentric hamstring volume suits your history, if you have ever strained a hamstring [40]."
    ],
    "caveat": "I am not a physio, and this plan is not a substitute for one. Evidence for the specific combination of methods in advanced pole and dance athletes is thin. Most dose-response data come from ordinary adults and from the hamstrings and calves. The safety concerns about loaded passive shoulder hyperflexion rest on mechanisms and clinical opinion, not on injury-outcome trials. Pole injury figures come mostly from self-reported surveys.",
    "examples": [
      {
        "title": "Week A: pole Wednesday, dance Thursday, pole dance Friday",
        "days": [
          {
            "day": 0,
            "classes": [],
            "sessions": [
              "splits-snack",
              "shoulder-reset"
            ],
            "why": "Friday has no free slot, so the snack moves here"
          },
          {
            "day": 1,
            "classes": [],
            "sessions": [
              "hips-backbend"
            ],
            "why": "Pole is tomorrow, so bridge reps stay submaximal"
          },
          {
            "day": 2,
            "classes": [
              "pole"
            ],
            "sessions": [
              "shoulder-recovery"
            ],
            "why": "Class-day rule 6"
          },
          {
            "day": 3,
            "classes": [
              "dance"
            ],
            "sessions": [
              "class-prep"
            ],
            "why": "Class-day rule 5"
          },
          {
            "day": 4,
            "classes": [
              "pole-dance"
            ],
            "sessions": [],
            "why": "Class day"
          },
          {
            "day": 5,
            "classes": [],
            "sessions": [
              "splits-intensive"
            ],
            "why": "4 days before the next pole class. Do it at about 70% volume if Friday left you tired."
          },
          {
            "day": 6,
            "classes": [],
            "sessions": [
              "shoulder-hyperflexion"
            ],
            "why": "72 hours before pole. If there is an evening rehearsal, finish at least 3 to 4 hours before it."
          }
        ]
      },
      {
        "title": "Week B: pole Tuesday, dance Thursday, no Friday class, Sunday evening rehearsal",
        "days": [
          {
            "day": 0,
            "classes": [],
            "sessions": [
              "shoulder-reset"
            ],
            "why": "Light, and a day before pole"
          },
          {
            "day": 1,
            "classes": [
              "pole"
            ],
            "sessions": [
              "shoulder-recovery"
            ],
            "why": "Class-day rule 6"
          },
          {
            "day": 2,
            "classes": [],
            "sessions": [
              "hips-backbend"
            ],
            "why": "A free evening. Keep bridge reps submaximal the day after pole."
          },
          {
            "day": 3,
            "classes": [
              "dance"
            ],
            "sessions": [
              "class-prep"
            ],
            "why": "Class-day rule 5"
          },
          {
            "day": 4,
            "classes": [],
            "sessions": [
              "splits-snack"
            ],
            "why": "Usual depth, the day before the intensive"
          },
          {
            "day": 5,
            "classes": [],
            "sessions": [
              "splits-intensive"
            ],
            "why": "Most recovery before the next hard class"
          },
          {
            "day": 6,
            "classes": [
              "rehearsal"
            ],
            "sessions": [
              "shoulder-hyperflexion"
            ],
            "why": "48 hours before pole. Done 3 to 4 hours before rehearsal."
          }
        ]
      }
    ],
    "references": [
      {
        "n": 1,
        "kind": "R",
        "text": "Ingram et al., Optimising the dose of static stretching to improve flexibility: a systematic review, meta-analysis and multivariate meta-regression. Sports Medicine",
        "site": "Semantic Scholar record",
        "url": "https://www.semanticscholar.org/paper/Optimising-the-Dose-of-Static-Stretching-to-Improve-Ingram-Tomkinson/9b555dbcf0dc27858cfe40d38681aee001f19a77"
      },
      {
        "n": 2,
        "kind": "R",
        "text": "Konrad et al., Chronic effects of stretching on range of motion with consideration of potential moderating variables: a systematic review with meta-analysis. Journal of Sport and Health Science, 2024",
        "site": "ScienceDirect",
        "url": "https://www.sciencedirect.com/science/article/pii/S2095254623000571"
      },
      {
        "n": 3,
        "kind": "C",
        "text": "Warneke et al., Practical recommendations on stretching exercise: a Delphi consensus statement of international research experts, 2025",
        "site": "PubMed Central",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC12305623/"
      },
      {
        "n": 4,
        "kind": "R",
        "text": "Warneke et al., Foam rolling and stretching do not provide superior acute flexibility and stiffness improvements compared to any other warm-up intervention: a systematic review with meta-analysis. Journal of Sport and Health Science, 2024",
        "site": "ScienceDirect",
        "url": "https://www.sciencedirect.com/science/article/pii/S2095254624000061"
      },
      {
        "n": 5,
        "kind": "R",
        "text": "Alizadeh et al., Resistance training induces improvements in range of motion: a systematic review and meta-analysis. Sports Medicine, 2023",
        "site": "ResearchGate",
        "url": "https://www.researchgate.net/publication/366977328_Resistance_Training_Induces_Improvements_in_Range_of_Motion_A_Systematic_Review_and_Meta-Analysis"
      },
      {
        "n": 6,
        "kind": "R",
        "text": "Afonso et al., Strength training versus stretching for improving range of motion: a systematic review and meta-analysis. Healthcare, 2021",
        "site": "MDPI",
        "url": "https://www.mdpi.com/2227-9032/9/4/427"
      },
      {
        "n": 7,
        "kind": "R",
        "text": "Eight weeks of eccentric training at long muscle length increases fascicle length independently of adaptations in passive mechanical properties. Journal of Applied Physiology, 2025",
        "site": "American Physiological Society",
        "url": "https://journals.physiology.org/doi/full/10.1152/japplphysiol.00859.2024"
      },
      {
        "n": 8,
        "kind": "R",
        "text": "Mechanisms underlying range of motion improvements following acute and chronic static stretching: a systematic review, meta-analysis and multivariate meta-regression",
        "site": "PubMed Central",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC12152101/"
      },
      {
        "n": 9,
        "kind": "R",
        "text": "What is the optimal contraction intensity and duration in the performance of relaxation techniques for maximal increase of range of motion? PNF and Movement",
        "site": "Korea Science",
        "url": "https://www.koreascience.or.kr/article/JAKO201617559404415.page"
      },
      {
        "n": 10,
        "kind": "R",
        "text": "Bonnar, Deivert and Gould, 2004, hold-relax contraction durations of 3, 6 and 10 seconds",
        "site": "PubMed",
        "url": "https://pubmed.ncbi.nlm.nih.gov/15756164/"
      },
      {
        "n": 11,
        "kind": "R",
        "text": "Optimal stretching dose for improving range of motion in non-athletes and athletes with hamstring shortening: a dose-response meta-analysis",
        "site": "PubMed",
        "url": "https://pubmed.ncbi.nlm.nih.gov/42551249/"
      },
      {
        "n": 12,
        "kind": "R",
        "text": "Incidence, mechanisms, and characteristics of injuries in pole dancers: a prospective cohort study",
        "site": "PubMed",
        "url": "https://pubmed.ncbi.nlm.nih.gov/36053493/"
      },
      {
        "n": 13,
        "kind": "R",
        "text": "Lee et al., Prevalence of pole dance injuries from a global online survey, 2020",
        "site": "PubMed",
        "url": "https://pubmed.ncbi.nlm.nih.gov/31663312/"
      },
      {
        "n": 14,
        "kind": "C",
        "text": "The Pole Physio, Anatomy of a backbend, part 2",
        "site": "thepolephysio.com",
        "url": "https://www.thepolephysio.com/post/anatomy-of-a-backbend-part-2"
      },
      {
        "n": 15,
        "kind": "R",
        "text": "The impact of lower back pain on hip extension and lumbosacral lateral flexion in junior gymnasts during back-bending, 2025",
        "site": "PubMed Central",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC12612811/"
      },
      {
        "n": 16,
        "kind": "C",
        "text": "Gymnastics Medicine, Spine injuries",
        "site": "gymnasticsmedicine.org",
        "url": "https://gymnasticsmedicine.org/spine/"
      },
      {
        "n": 17,
        "kind": "C",
        "text": "Physiopedia, Lumbar spondylolysis in extension related sport",
        "site": "Physiopedia",
        "url": "https://www.physio-pedia.com/Lumbar_Spondylolysis_in_Extension_Related_Sport"
      },
      {
        "n": 18,
        "kind": "C",
        "text": "Low back pain in dancers. Medscape",
        "site": "Medscape",
        "url": "https://www.medscape.com/viewarticle/717393_4"
      },
      {
        "n": 19,
        "kind": "C",
        "text": "Wrist pain in gymnastics. Warringah Physiotherapy",
        "site": "warringahphysio.com.au",
        "url": "https://www.warringahphysio.com.au/single-post/2020/06/22/wrist-pain-in-gymnastics"
      },
      {
        "n": 20,
        "kind": "C",
        "text": "Physiopedia, Anterior shoulder instability",
        "site": "Physiopedia",
        "url": "https://www.physio-pedia.com/Anterior_Shoulder_Instability"
      },
      {
        "n": 21,
        "kind": "R",
        "text": "Stutz, Eiholzer and Spengler, Effects of evening exercise on sleep in healthy participants: a systematic review and meta-analysis. Sports Medicine, 2019",
        "site": "Springer",
        "url": "https://link.springer.com/article/10.1007/s40279-018-1015-0"
      },
      {
        "n": 22,
        "kind": "R",
        "text": "Dose-response relationship between evening exercise and sleep. Nature Communications, 2025",
        "site": "Nature",
        "url": "https://www.nature.com/articles/s41467-025-58271-x"
      },
      {
        "n": 23,
        "kind": "R",
        "text": "Effects of active and passive warm-ups on range of motion, strength, and muscle passive properties in ankle plantarflexor muscles",
        "site": "PubMed",
        "url": "https://pubmed.ncbi.nlm.nih.gov/29933358"
      },
      {
        "n": 24,
        "kind": "R",
        "text": "Passive vs. active warm-up combined with stretching on hamstring flexibility and maximal voluntary contractions",
        "site": "PubMed",
        "url": "https://pubmed.ncbi.nlm.nih.gov/40333835/"
      },
      {
        "n": 25,
        "kind": "R",
        "text": "The effects of massage guns on performance and recovery: a systematic review",
        "site": "ResearchGate",
        "url": "https://www.researchgate.net/publication/374006054_The_Effects_of_Massage_Guns_on_Performance_and_Recovery_A_Systematic_Review"
      },
      {
        "n": 26,
        "kind": "R",
        "text": "Leabeater et al., Under the gun: percussive massage therapy and physical and perceptual recovery in active adults, 2024",
        "site": "PubMed Central",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC10976339/"
      },
      {
        "n": 27,
        "kind": "R",
        "text": "Foam rolling training effects on range of motion: a systematic review and meta-analysis. Sports Medicine",
        "site": "Springer",
        "url": "https://link.springer.com/article/10.1007/s40279-022-01699-8"
      },
      {
        "n": 28,
        "kind": "R",
        "text": "Static stretch training versus foam rolling training effects on range of motion: a systematic review and meta-analysis. Sports Medicine",
        "site": "Springer",
        "url": "https://link.springer.com/article/10.1007/s40279-024-02041-0"
      },
      {
        "n": 29,
        "kind": "R",
        "text": "Effects of latissimus dorsi length on shoulder flexion in canoeists, swimmers, rugby players, and controls. Journal of Sport and Health Science, 2013",
        "site": "ScienceDirect",
        "url": "https://www.sciencedirect.com/science/article/pii/S2095254613000215"
      },
      {
        "n": 30,
        "kind": "C",
        "text": "The Prehab Guys, How to assess and improve shoulder overhead mobility",
        "site": "theprehabguys.com",
        "url": "https://landing.theprehabguys.com/shoulder-mobility/"
      },
      {
        "n": 31,
        "kind": "C",
        "text": "Lattice Training, Flexibility, climbing and performance, part 3",
        "site": "latticetraining.com",
        "url": "https://latticetraining.com/2021/06/22/flexibility-climbing-and-performance-what-why-and-how-part-3/"
      },
      {
        "n": 32,
        "kind": "R",
        "text": "Warneke et al., Effects of a home-based stretching program on bench press maximum strength and shoulder flexibility",
        "site": "ResearchGate",
        "url": "https://www.researchgate.net/profile/David-Behm/publication/373717155_Effects_of_a_Home-Based_Stretching_Program_on_Bench_Press_Maximum_Strength_and_Shoulder_Flexibility/links/65155b874aa1fe04700e77ea/Effects-of-a-Home-Based-Stretching-Program-on-Bench-Press-Maximum-Strength-and-Shoulder-Flexibility.pdf"
      },
      {
        "n": 33,
        "kind": "R",
        "text": "Hypermobility and dance: a review",
        "site": "PubMed",
        "url": "https://pubmed.ncbi.nlm.nih.gov/21695667/"
      },
      {
        "n": 34,
        "kind": "R",
        "text": "Chaabene et al., Acute effects of static stretching on muscle strength and power: an attempt to clarify previous caveats. Frontiers in Physiology, 2019",
        "site": "PubMed Central",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC6895680/"
      },
      {
        "n": 35,
        "kind": "R",
        "text": "Revisiting the stretch-induced force deficit: a systematic review with multilevel meta-analysis of acute effects. Journal of Sport and Health Science, 2024",
        "site": "PubMed Central",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC11336295/"
      },
      {
        "n": 36,
        "kind": "R",
        "text": "Behm and Chaouachi, A review of the acute effects of static and dynamic stretching on performance, 2011",
        "site": "PubMed",
        "url": "https://pubmed.ncbi.nlm.nih.gov/21373870/"
      },
      {
        "n": 37,
        "kind": "R",
        "text": "Detraining effects following chronic stretching training on range of motion: a systematic review and meta-analysis. Sports Medicine Open, 2025",
        "site": "Springer",
        "url": "https://link.springer.com/article/10.1186/s40798-025-00935-5"
      },
      {
        "n": 38,
        "kind": "R",
        "text": "Effects of low-volume static stretching and full range-of-motion resistance training on flexibility in physically active young adults: a randomized controlled trial",
        "site": "DOI",
        "url": "https://doi.org/10.3390/jcm15155783"
      },
      {
        "n": 39,
        "kind": "C",
        "text": "Pliability, Eccentric hamstring exercises for strength and recovery (coaching source on soreness time course)",
        "site": "pliability.com",
        "url": "https://pliability.com/stories/eccentric-hamstring-exercises"
      },
      {
        "n": 40,
        "kind": "C",
        "text": "Schmitt, Tyler and McHugh, Hamstring injury rehabilitation and prevention of reinjury using lengthened state eccentric training: a new concept. International Journal of Sports Physical Therapy, 2012",
        "site": "PubMed Central",
        "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC3362981/"
      }
    ]
  },
  "sessions": [
    {
      "id": "splits-intensive",
      "title": "Splits Intensive",
      "kind": "big",
      "minutes": 90,
      "about": [
        "Your top-priority session. Place it using rules 1 and 4. Active work comes before passive work [5][7]."
      ],
      "sections": [
        {
          "title": "Warm-up",
          "minutes": 10,
          "items": [
            {
              "name": "Cardio",
              "duration": "8 min",
              "detail": "choreo run-through, or mopping and sweeping. Get sweaty and raise the heart rate [4][24]."
            },
            {
              "name": "Transition",
              "duration": "2 min",
              "detail": "water, clear space."
            }
          ]
        },
        {
          "title": "Active flexibility",
          "minutes": 14,
          "items": [
            {
              "name": "Standing splits at pole",
              "duration": "4 min",
              "detail": "hinge forward 20 to 30 degrees, hips square, 60 s per leg."
            },
            {
              "name": "Leg lifts at pole",
              "duration": "4 min",
              "detail": "front, side and back, 10 reps each leg."
            },
            {
              "name": "Supported split descents",
              "duration": "4 min",
              "detail": "slow slide to near the floor, 3 to 4 reps per side."
            },
            {
              "name": "Seated pike compression lifts",
              "duration": "2 min",
              "detail": "legs straight, hands beside the knees, lift one heel 2 to 5 cm, hold 3 s, 6 reps per leg."
            }
          ]
        },
        {
          "title": "Hip flexor block",
          "minutes": 20,
          "note": "Priority",
          "items": [
            {
              "name": "Psoas lunge",
              "duration": "4 min",
              "detail": "pelvis tucked, torso upright, 2 min per side."
            },
            {
              "name": "Hip extension end-range strength",
              "duration": "4 min",
              "detail": "kneeling lunge with the back knee down. Squeeze the back-leg glute and lift the back knee 1 to 2 cm off the floor, hold 5 s, 5 reps per side. Then front-split back-leg lifts at the pole, 2 x 8 per side [5][15]."
            },
            {
              "name": "Couch stretch, extended",
              "duration": "6 min",
              "detail": "3 min per side. Don't force."
            },
            {
              "name": "90/90 hip rotations",
              "duration": "2 min",
              "detail": "1 min each direction."
            },
            {
              "name": "Contract-relax hip flexor",
              "duration": "4 min",
              "detail": "press at about 30 to 50% effort for 5 to 10 s, sink for 20 s, 2 min per side [9][10]."
            }
          ]
        },
        {
          "title": "Hamstring block",
          "minutes": 11,
          "items": [
            {
              "name": "Half splits, active",
              "duration": "4 min",
              "detail": "flat back, hinge from the hips, 2 min per side."
            },
            {
              "name": "Banded hamstring curls at pole",
              "duration": "3 min",
              "detail": "band looped at the pole base, 4-second lowering, 3 sets of 8 to 10 reps."
            },
            {
              "name": "PNF hamstring",
              "duration": "4 min",
              "detail": "press at about 30 to 50% effort for 5 to 10 s, fold deeper for 20 s, 2 min per side [9][10][11]."
            }
          ],
          "note": "Start the eccentric lowering conservatively: 2 sets of 6 to 8 for the first few weeks, then build. Skip the lowering if you are still sore from a previous session [39][40]."
        },
        {
          "title": "Split work",
          "minutes": 28,
          "items": [
            {
              "name": "Supported split right",
              "duration": "8 min",
              "detail": "square hips, ease deeper in the second half."
            },
            {
              "name": "Supported split left",
              "duration": "8 min",
              "detail": "same protocol."
            },
            {
              "name": "Middle split",
              "duration": "8 min",
              "detail": "breathe, ease wider on the exhale if it's there."
            },
            {
              "name": "Wide straddle fold",
              "duration": "2 min"
            },
            {
              "name": "Active middle-split strength",
              "duration": "2 min",
              "detail": "horse-stance or Cossack-squat slow lowers, 1 x 6 per side, or side-lying top-leg lifts at end range, 10 per side [5][6]."
            }
          ]
        },
        {
          "title": "Ankle mobility",
          "minutes": 3,
          "items": [
            {
              "name": "Ankle circles",
              "duration": "1 min"
            },
            {
              "name": "Point and flex",
              "duration": "1 min"
            },
            {
              "name": "Top-of-foot stretch",
              "duration": "1 min"
            }
          ]
        },
        {
          "title": "Cool down",
          "minutes": 5,
          "items": [
            {
              "name": "Child's pose",
              "duration": "2 min"
            },
            {
              "name": "Supine twists",
              "duration": "2 min"
            },
            {
              "name": "Deep breathing",
              "duration": "1 min"
            }
          ]
        }
      ],
      "deload": "No depth chasing. Skip the eccentric lowering or use a light band only.",
      "short": {
        "minutes": 18,
        "items": [
          {
            "name": "Cardio",
            "duration": "3 min",
            "detail": "mopping, sweeping or quick movement to raise the heart rate."
          },
          {
            "name": "Couch stretch",
            "duration": "4 min",
            "detail": "shin vertical against the wall, torso upright, 2 min per side. Don't force."
          },
          {
            "name": "Contract-relax hip flexor",
            "duration": "2 min",
            "detail": "press the back shin down 5 to 10 s, relax deeper for 20 s, 1 min per side."
          },
          {
            "name": "Supported split, right and left",
            "duration": "6 min",
            "detail": "4 to 6 inch support, square hips, front heel down and toes up, back knee down. Ease slightly deeper, 3 min per side."
          },
          {
            "name": "Middle split",
            "duration": "2 min",
            "detail": "knees pointing up, breathe, ease wider on exhales if it's there."
          },
          {
            "name": "Cool down",
            "duration": "2 min",
            "detail": "child's pose and deep breathing."
          }
        ],
        "skip": "hamstring block, active flexibility and ankle mobility"
      },
      "length": "~90 min"
    },
    {
      "id": "shoulder-hyperflexion",
      "title": "Shoulder Hyperflexion",
      "kind": "big",
      "minutes": 55,
      "about": [
        "Your second-priority session. Place it using rules 2 and 4. This session works on shoulder hyperflexion past 180 degrees. The bench block is the key exercise."
      ],
      "sections": [
        {
          "title": "Tissue prep",
          "minutes": 10,
          "items": [
            {
              "name": "Thoracic spine roll",
              "duration": "3 min"
            },
            {
              "name": "Lats roll",
              "duration": "3 min"
            },
            {
              "name": "Upper back roll",
              "duration": "2 min"
            },
            {
              "name": "Rotator cuff",
              "duration": "2 min"
            }
          ]
        },
        {
          "title": "Theragun",
          "minutes": 2,
          "note": "Optional",
          "items": [
            {
              "name": "Theragun",
              "duration": "2 min",
              "detail": "Upper traps, rear delts, lats. A small, short-lived range gain at best [4][25].",
              "whole": true
            }
          ]
        },
        {
          "title": "Hyperflexion CARs with band",
          "minutes": 5,
          "items": [
            {
              "name": "Hyperflexion CARs with band",
              "duration": "5 min",
              "detail": "Giant circles overhead, 10 clockwise and 10 counter-clockwise per arm.",
              "whole": true
            }
          ]
        },
        {
          "title": "Pole chest stretches",
          "minutes": 12,
          "items": [
            {
              "name": "Pole chest stretches",
              "duration": "12 min",
              "detail": "High, middle and low positions, 2 min per side each. Breathe 5 s in, 5 s out.",
              "whole": true
            }
          ]
        },
        {
          "title": "Lat stretch on roller",
          "minutes": 4,
          "items": [
            {
              "name": "Lat stretch on roller",
              "duration": "4 min",
              "detail": "Hold 1 for 2 min, rest 30 s, hold 2 for 1.5 min. Ease a bit deeper on round 2 if it's there. Lat length limits overhead range [29].",
              "whole": true
            }
          ]
        },
        {
          "title": "Shoulder extension",
          "minutes": 4,
          "items": [
            {
              "name": "Shoulder extension",
              "duration": "4 min",
              "detail": "Hold 1 for 2 min, rest 30 s, hold 2 for 1.5 min. Ease deeper if available.",
              "whole": true
            }
          ]
        },
        {
          "title": "Shoulder hyperflexion on bench",
          "minutes": 13,
          "note": "Key exercise. Rest 1 min between rounds.",
          "items": [
            {
              "name": "Round 1, passive",
              "duration": "3.5 min",
              "detail": "hands empty. 2 x 90 s holds with 30 s rest, relaxing into the deepest position."
            },
            {
              "name": "Round 2, active",
              "duration": "4 min",
              "detail": "(a) Lift-offs: with the arms at your deepest comfortable overhead position, lift both arms 2 to 5 cm off the bench using your shoulders and upper back, hold 5 s, lower slowly. 3 sets of 5. (b) Optional light eccentric pullover: 0.5 to 2 kg per hand, or a very light band. Lower over 4 seconds into range, pause 2 s, return. 2 sets of 6. Keep the ribs down. Never let the weight pull you deeper than you can lift out of [5][6][7]."
            },
            {
              "name": "Round 3, unweighted",
              "duration": "3 min",
              "detail": "hold at today's available depth, no forcing toward a target."
            }
          ]
        },
        {
          "title": "Cool down",
          "minutes": 5,
          "items": [
            {
              "name": "Child's pose",
              "duration": "2 min"
            },
            {
              "name": "Thread-the-needle",
              "duration": "2 min"
            },
            {
              "name": "Deep breathing",
              "duration": "1 min"
            }
          ]
        }
      ],
      "notes": [
        {
          "label": "How to measure",
          "text": "Lie on your back with knees bent and the lower back flat. If the ribs flare or the back arches, that range is coming from your spine, not your shoulder. Tight lats commonly cause this compensation [29][30]."
        },
        {
          "label": "Stop rule",
          "text": "Drop to the passive round only if you feel a deep or front-of-shoulder pinch, clicking, a dead-arm feeling, tingling into the arm, or shoulder ache that is still there the next morning [20]."
        }
      ],
      "deload": "Do the passive round only and skip Round 2.",
      "short": {
        "minutes": 18,
        "items": [
          {
            "name": "Theragun",
            "duration": "3 min",
            "detail": "upper traps and lats, quick pass (optional)."
          },
          {
            "name": "Pole chest stretch",
            "duration": "3 min",
            "detail": "middle position only. Breathe 5 s in, 5 s out."
          },
          {
            "name": "Lat stretch on roller",
            "duration": "2 min",
            "detail": "1 hold, ease into it."
          },
          {
            "name": "Shoulder hyperflexion on bench",
            "duration": "8 min",
            "detail": "a passive round (3 min), an active lift-off round (3 min) and a short rest. Skip round 3."
          },
          {
            "name": "Cool down",
            "duration": "2 min",
            "detail": "child's pose and breathing."
          }
        ],
        "skip": "full tissue prep, band CARs, shoulder extension, and the high and low chest stretch positions"
      },
      "length": "~55 min"
    },
    {
      "id": "hips-backbend",
      "title": "Hips & Backbend",
      "kind": "big",
      "minutes": 60,
      "about": [
        "This session opens the front of the body, builds backbend depth, and gives your front splits and middle split a lighter exposure. Place it using rules 3 and 4."
      ],
      "sections": [
        {
          "title": "Warm-up",
          "minutes": 10,
          "items": [
            {
              "name": "Cardio",
              "duration": "4 min",
              "detail": "dance, jump rope or jumping jacks. Mopping or sweeping counts, but keep going until you are slightly warm [4][24]."
            },
            {
              "name": "Cat-cow",
              "duration": "2 min",
              "detail": "15 slow reps, thoracic bias."
            },
            {
              "name": "Segmental spinal waves",
              "duration": "2 min"
            },
            {
              "name": "Wrist prep",
              "duration": "2 min",
              "detail": "wrist circles 10 each way. Quadruped rocks forward and back over the hands, 10 with fingers forward and 10 with fingers pointing back. Palm lifts, 10 reps [19]."
            }
          ]
        },
        {
          "title": "Open the restrictors",
          "minutes": 14,
          "items": [
            {
              "name": "Couch or kneeling hip flexor",
              "duration": "3 min",
              "detail": "90 s per side, pelvis tucked."
            },
            {
              "name": "Half-kneeling hip flexor with reach-over",
              "duration": "2 min",
              "detail": "60 s per side."
            },
            {
              "name": "Supported anterior-chain opener on roller",
              "duration": "2 min"
            },
            {
              "name": "Thoracic roll and arch-backs",
              "duration": "4 min",
              "detail": "4 positions, 30 s each, 2 rounds."
            },
            {
              "name": "Sphinx to cobra pulses",
              "duration": "3 min",
              "detail": "about 9 slow reps."
            }
          ]
        },
        {
          "title": "Activate the extensors",
          "minutes": 6,
          "items": [
            {
              "name": "Locust",
              "duration": "3 min",
              "detail": "3 x 20 s hold, 20 s rest."
            },
            {
              "name": "Bridge prep or glute bridge",
              "duration": "1.5 min",
              "detail": "10 reps."
            },
            {
              "name": "Thoracic bridge with block squeeze",
              "duration": "1.5 min",
              "detail": "3 x 30 s."
            }
          ]
        },
        {
          "title": "Depth and skill work",
          "minutes": 14,
          "note": "Do this fresh",
          "items": [
            {
              "name": "Camel at pole",
              "duration": "4 min",
              "detail": "2 x 90 s holds. The chest opens first, then the hips follow."
            },
            {
              "name": "Diagnostic bridge breathing test",
              "duration": "2 min",
              "detail": "does a soft-belly exhale open depth?"
            },
            {
              "name": "Full bridge depth focus",
              "duration": "8 min",
              "detail": "3 reps x 45 s. Press the shoulders and chest open before sinking into the lower back. Use hands on blocks if your wrists complain. If pole is the next day, stop at 2 reps and about 80% of your usual depth. Today's depth is the right depth [1][2]."
            }
          ]
        },
        {
          "title": "Front-split and middle-split exposure",
          "minutes": 10,
          "note": "Usual depth",
          "items": [
            {
              "name": "Supported split right",
              "duration": "3 min"
            },
            {
              "name": "Supported split left",
              "duration": "3 min"
            },
            {
              "name": "Middle split",
              "duration": "4 min",
              "detail": "breathe, no pushing."
            }
          ]
        },
        {
          "title": "Cool down",
          "minutes": 6,
          "items": [
            {
              "name": "Child's pose",
              "duration": "2 min"
            },
            {
              "name": "Supine twists",
              "duration": "2 min"
            },
            {
              "name": "Constructive rest and breathing",
              "duration": "2 min"
            }
          ]
        }
      ],
      "notes": [
        {
          "label": "Depth cue",
          "text": "The lower back moves more easily than the upper back, so it will try to do all the work. Open the shoulders and chest first, then use hip extension to share the bend, and let the lower back add depth last. The thoracic spine gives only a small share of the total extension, so shoulder flexion and hip extension are the bigger levers [14][15][16]."
        },
        {
          "label": "Stop rule",
          "text": "Stop backbending for the day if you get sharp or one-sided low-back pain when arching. See the stop rules above."
        }
      ],
      "deload": "No depth chasing. Just move through and breathe. Keep bridges to 2 reps at 80% depth.",
      "short": {
        "minutes": 20,
        "items": [
          {
            "name": "Cardio",
            "duration": "2 min",
            "detail": "Mopping or sweeping works."
          },
          {
            "name": "Cat-cow",
            "duration": "1 min"
          },
          {
            "name": "Wrist prep",
            "duration": "1 min"
          },
          {
            "name": "Couch or kneeling hip flexor",
            "duration": "2 min",
            "detail": "1 min per side."
          },
          {
            "name": "Sphinx to cobra pulses",
            "duration": "2 min"
          },
          {
            "name": "Locust",
            "duration": "1 min",
            "detail": "short holds."
          },
          {
            "name": "Camel at pole",
            "duration": "2 min",
            "detail": "1 x 90 s hold, rise slowly."
          },
          {
            "name": "Full bridge, depth focus",
            "duration": "7 min",
            "detail": "2 reps x 45 to 60 s, easing deeper on exhales."
          },
          {
            "name": "Cool down",
            "duration": "2 min",
            "detail": "child's pose, then slow breaths."
          }
        ]
      },
      "length": "~60 min"
    },
    {
      "id": "shoulder-recovery",
      "title": "Shoulder Recovery after pole",
      "kind": "short",
      "minutes": 20,
      "about": [
        "Do this after pole class, keeping intensity at 5 out of 10 or lower and stopping for any front-of-shoulder pinch [12][20]. Skip the Theragun if you are tired."
      ],
      "sections": [
        {
          "items": [
            {
              "name": "Pole chest stretch, middle position",
              "duration": "4 min",
              "detail": "2 min per side. Breathe 5 s in, 5 s out."
            },
            {
              "name": "Thoracic extension over roller",
              "duration": "3 min",
              "detail": "lie across a foam roller at mid-back, hands behind the head or arms overhead. Extend gently backward over it. Walk the roller up or down 2 to 3 segments, holding each 20 to 30 s. Keep the chin slightly tucked [14]."
            },
            {
              "name": "Wall slides",
              "duration": "3 min",
              "detail": "back flat against a wall, arms in goal-post position. Slide the arms overhead and back down, keeping the lower back pressed flat."
            },
            {
              "name": "Segmental cat-cow",
              "duration": "2 min",
              "detail": "exaggerate the rounding and arching through the upper back while the lower back stays more neutral."
            },
            {
              "name": "Thread-the-needle and arm circles",
              "duration": "3 min"
            },
            {
              "name": "Child's pose and deep breathing",
              "duration": "2 min"
            },
            {
              "name": "Theragun",
              "duration": "3 min",
              "detail": "(optional) upper traps and lats only. It has no proven recovery benefit [26]."
            }
          ]
        }
      ],
      "short": {
        "minutes": 10,
        "items": [
          {
            "name": "Pole chest stretch, middle position",
            "duration": "4 min"
          },
          {
            "name": "Thoracic extension over roller",
            "duration": "3 min"
          },
          {
            "name": "Child's pose and deep breathing",
            "duration": "3 min"
          }
        ]
      },
      "length": "~20 min"
    },
    {
      "id": "shoulder-reset",
      "title": "Shoulder Reset",
      "kind": "short",
      "minutes": 15,
      "about": [
        "A light session for the day before or after a class. Skip it if exhausted."
      ],
      "sections": [
        {
          "items": [
            {
              "name": "Foam roll lats",
              "duration": "4 min",
              "detail": "roller under the armpit, slow passes. Stop on tender spots, 2 min each side [27][28]."
            },
            {
              "name": "Shoulder CARs",
              "duration": "3 min",
              "detail": "5 reps each direction per arm, 5 to 10 seconds per circle, torso still. Keep the ribs down [30]."
            },
            {
              "name": "Wall clocks",
              "duration": "8 min",
              "detail": "(skip if exhausted) 12, 3, 6 and 9 o'clock positions, 30 s each. Press firmly, reverse direction, then switch arms and repeat."
            }
          ]
        }
      ],
      "short": {
        "minutes": 5,
        "items": [
          {
            "name": "Foam roll lats",
            "duration": "2 min",
            "detail": "1 min per side."
          },
          {
            "name": "Shoulder CARs",
            "duration": "3 min",
            "detail": "5 reps each direction per arm."
          }
        ]
      },
      "length": "~15 min"
    },
    {
      "id": "splits-snack",
      "title": "Splits Snack",
      "kind": "short",
      "minutes": 20,
      "about": [
        "A short third exposure for your front splits and middle split. Stay at your usual depth, and never use it to chase new depth."
      ],
      "sections": [
        {
          "items": [
            {
              "name": "Warm-up",
              "duration": "4 min",
              "detail": "leg swings, hip circles, walk around."
            },
            {
              "name": "Leg lifts at pole",
              "duration": "2 min",
              "detail": "front and side, 8 reps per leg."
            },
            {
              "name": "Couch stretch",
              "duration": "4 min",
              "detail": "shin vertical against the wall, 2 min per side."
            },
            {
              "name": "Supported split right and left",
              "duration": "5 min",
              "detail": "2.5 min per side, square hips, heel down and toes up."
            },
            {
              "name": "Middle split",
              "duration": "3 min",
              "detail": "breathe, ease wider on exhales if it's there."
            },
            {
              "name": "Cool down",
              "duration": "2 min",
              "detail": "child's pose and breathing."
            }
          ]
        }
      ],
      "length": "~20 min"
    },
    {
      "id": "class-prep",
      "title": "Class-day prep",
      "kind": "prep",
      "minutes": 10,
      "about": [
        "Do this before pole, pole tricks, dance or rehearsal. A warm-up of light aerobic activity, large dynamic stretches and sport-specific movement is the standard recommendation, and dynamic stretching shows no harm to later performance [36]. Keep any static hold under 60 seconds per muscle group."
      ],
      "sections": [
        {
          "items": [
            {
              "name": "March or light cardio",
              "duration": "2 min"
            },
            {
              "name": "Leg swings",
              "duration": "2 min",
              "detail": "15 per leg each direction."
            },
            {
              "name": "Hip circles and lunges",
              "duration": "2 min",
              "detail": "8 lunges per side."
            },
            {
              "name": "Shoulder CARs",
              "duration": "2 min",
              "detail": "5 each direction per arm."
            },
            {
              "name": "Cat-cow",
              "duration": "1 min"
            }
          ]
        }
      ],
      "after": [
        "Pole tricks and dance leaps depend on maximal strength and power, so these days are the most important ones to keep long passive holds away from."
      ],
      "length": "5 to 10 min"
    }
  ],
  "library": {
    "bridge prep": [
      {
        "session": "Backbend Intensive",
        "name": "Bridge prep",
        "duration": "2 min",
        "cues": [
          "Lie on back",
          "Knees bent, feet flat on floor",
          "Feet hip-width apart",
          "Heels close to butt (shins roughly vertical)",
          "Arms at sides, palms down",
          "Engage core (draw belly button to spine)",
          "Squeeze glutes (butt muscles)",
          "Press into feet",
          "Lift hips UP toward ceiling",
          "Create straight line from knees to shoulders",
          "Don't arch excessively - focus on glute strength",
          "Hold at top 5 seconds",
          "Lower down",
          "Rest 5-10 seconds",
          "10 reps total",
          "Focus on CONTROL and glute engagement"
        ]
      }
    ],
    "camel at pole": [
      {
        "session": "Backbend Intensive",
        "name": "Camel at pole",
        "duration": "3 min",
        "cues": [
          "Kneel facing pole",
          "Knees hip-width apart",
          "Shins and tops of feet flat on mat",
          "Hold pole with both hands at chest height",
          "First Hold (90 sec):",
          {
            "text": "Push hips FORWARD (key!)",
            "sub": true
          },
          {
            "text": "Hips move forward past knees",
            "sub": true
          },
          {
            "text": "Keep pushing hips forward as you arch back",
            "sub": true
          },
          {
            "text": "Begin to arch upper back",
            "sub": true
          },
          {
            "text": "Let head drop back gently (don't crank)",
            "sub": true
          },
          {
            "text": "Hold pole for support",
            "sub": true
          },
          {
            "text": "Create arc through entire spine",
            "sub": true
          },
          {
            "text": "Push chest up and forward",
            "sub": true
          },
          {
            "text": "Breathe: 5 sec in, 5 sec out",
            "sub": true
          },
          "Rest (30 sec):",
          {
            "text": "Come back to upright kneeling",
            "sub": true
          },
          {
            "text": "Sit back on heels if needed",
            "sub": true
          },
          {
            "text": "Take a few breaths",
            "sub": true
          },
          "Second Hold (90 sec):",
          {
            "text": "Come back into camel",
            "sub": true
          },
          {
            "text": "Push hips forward",
            "sub": true
          },
          {
            "text": "Arch back",
            "sub": true
          },
          {
            "text": "Often can go deeper on round 2",
            "sub": true
          },
          {
            "text": "Hold 90 seconds",
            "sub": true
          },
          {
            "text": "Keep breathing",
            "sub": true
          }
        ]
      }
    ],
    "cat cow": [
      {
        "session": "Backbend Intensive",
        "name": "Cat-cow",
        "duration": "2 min",
        "cues": [
          "Hands and knees (tabletop position)",
          "Inhale: drop belly, lift chest and tailbone (cow)",
          "Exhale: round spine, tuck tailbone (cat)",
          "20 slow repetitions",
          "Focus on thoracic movement (mid-back)",
          "Don't just move from lower back"
        ]
      }
    ],
    "childs pose": [
      {
        "session": "Shoulder Hyperflexion",
        "name": "Child's pose",
        "duration": "2 min",
        "cues": [
          "Sit back on heels",
          "Arms extended forward or alongside body",
          "Forehead to mat",
          "Total relaxation",
          "Let shoulders release completely"
        ]
      },
      {
        "session": "Backbend Intensive",
        "name": "Child's pose",
        "duration": "3 min",
        "cues": [
          "Full rest after bridge work",
          "Sit back on heels",
          "Arms extended forward on floor",
          "Forehead to mat",
          "Total relaxation",
          "No effort",
          "Let entire back release",
          "Counter-pose to all the backbending",
          "Breathe deeply",
          "Hold full 3 minutes"
        ]
      },
      {
        "session": "Backbend Intensive",
        "name": "Child's pose",
        "duration": "2 min",
        "cues": [
          "Come to hands and knees",
          "Sit hips back toward heels",
          "Knees together or wide apart",
          "Arms extended forward on floor",
          "Forehead to mat",
          "Total relaxation",
          "Breathe deeply"
        ]
      }
    ],
    "contract relax hip flexor": [
      {
        "session": "Splits Maintenance",
        "name": "Contract-relax",
        "duration": "2 min",
        "cues": [
          "Low lunge",
          "Press back shin down 5 sec",
          "Relax, sink deeper 15 sec",
          "3 reps per side",
          "1 min each side"
        ]
      }
    ],
    "couch stretch": [
      {
        "session": "Splits Maintenance",
        "name": "Couch stretch",
        "duration": "4 min",
        "cues": [
          "Shin on wall",
          "2 min each side",
          "Try to go deeper than Saturday"
        ]
      }
    ],
    "deep breathing": [
      {
        "session": "Shoulder Hyperflexion",
        "name": "Deep breathing",
        "duration": "1 min",
        "cues": [
          "Comfortable seated or lying position",
          "Close eyes",
          "5 sec inhale through nose",
          "5 sec exhale through mouth",
          "Focus on complete relaxation",
          "6 deep breath cycles"
        ]
      },
      {
        "session": "Backbend Intensive",
        "name": "Deep breathing",
        "duration": "1 min",
        "cues": [
          "Comfortable position",
          "Close eyes",
          "5 sec inhale through nose",
          "5 sec exhale through mouth",
          "6 deep breath cycles"
        ]
      }
    ],
    "foam roll lats": [
      {
        "session": "Shoulder Hyperflexion",
        "name": "Lats roll",
        "duration": "3 min",
        "cues": [
          "Lie on right side, roller under armpit",
          "Right arm overhead",
          "Roll armpit down 6-8\"",
          "5-6 sec each direction",
          "Stop on tender spots 10-15 sec"
        ]
      }
    ],
    "hyperflexion cars with band": [
      {
        "session": "Shoulder Hyperflexion",
        "name": "Hyperflexion CARs with band",
        "duration": "5 min",
        "cues": [
          "Stand with light resistance band overhead",
          "Hold band with both hands, arms straight",
          "Band should have light tension",
          "Make GIANT circles:",
          {
            "text": "From front, arc overhead and BEHIND head",
            "sub": true
          },
          {
            "text": "Continue circling to side, then down",
            "sub": true
          },
          {
            "text": "Reverse direction",
            "sub": true
          },
          "Band provides feedback for hyperflexion range",
          "Keep circles as large as possible",
          "10 circles clockwise per arm (2 min)",
          "10 circles counter-clockwise per arm (2 min)",
          "Rest: 1 min"
        ]
      }
    ],
    "lat stretch on roller": [
      {
        "session": "Shoulder Hyperflexion",
        "name": "Lat stretch on roller",
        "duration": "4 min",
        "cues": [
          "Kneel on mat, roller in front",
          "Both hands on roller",
          "Sit hips back toward heels",
          "Roll roller forward",
          "Extend arms fully",
          "Feel stretch from armpit to lower back",
          "Push chest down toward floor",
          "Hold 1 (2 min):",
          {
            "text": "Breathe: 5 sec in, 5 sec out",
            "sub": true
          },
          {
            "text": "Each exhale, try to push chest slightly lower",
            "sub": true
          },
          "Rest (30 sec):",
          {
            "text": "Sit back on heels",
            "sub": true
          },
          {
            "text": "Shake out arms",
            "sub": true
          },
          "Hold 2 (1.5 min):",
          {
            "text": "Return to stretch",
            "sub": true
          },
          {
            "text": "Should be able to go deeper than round 1",
            "sub": true
          },
          {
            "text": "Really sink into it",
            "sub": true
          }
        ]
      }
    ],
    "leg lifts at pole": [
      {
        "session": "Splits Maintenance",
        "name": "Leg lifts at pole",
        "duration": "3 min",
        "cues": [
          "Face pole, hold at chest height",
          "Front lifts:",
          "Right: 8 reps (up 2 sec, hold 2 sec, down 4 sec)",
          "Left: 8 reps",
          "Side lifts:",
          "Right: 8 reps (torso upright)",
          "Left: 8 reps"
        ]
      }
    ],
    "middle split": [
      {
        "session": "Splits Maintenance",
        "name": "Middle split",
        "duration": "3 min",
        "cues": [
          "Legs wide, feet flexed",
          "Should be wider than Saturday",
          "Try less/no support",
          "3 min hold"
        ]
      }
    ],
    "pole chest stretches": [
      {
        "session": "Shoulder Hyperflexion",
        "name": "High position",
        "duration": "4 min",
        "cues": [
          "Right side to pole",
          "Right forearm vertical, hand UP",
          "Above head height",
          "Rotate chest LEFT (away from pole)",
          "Don't arch lower back",
          "Don't shrug shoulders",
          "Breathe: 5 sec in, 5 sec out",
          "2 min right side",
          "2 min left side"
        ]
      },
      {
        "session": "Shoulder Hyperflexion",
        "name": "Middle position",
        "duration": "4 min",
        "cues": [
          "Forearm at shoulder height",
          "Elbow 90° (goal post position)",
          "Rotate chest away from pole",
          "Keep hips square",
          "2 min right side",
          "2 min left side"
        ]
      },
      {
        "session": "Shoulder Hyperflexion",
        "name": "Low position",
        "duration": "4 min",
        "cues": [
          "Forearm lower, hand pointing DOWN",
          "Toward belly height",
          "Rotate chest away from pole",
          "Feel stretch in chest and front shoulder",
          "2 min right side",
          "2 min left side"
        ]
      }
    ],
    "rotator cuff": [
      {
        "session": "Shoulder Hyperflexion",
        "name": "Rotator cuff",
        "duration": "2 min",
        "cues": [
          "Lie on back",
          "Roller BEHIND right shoulder blade",
          "Right arm out, palm up",
          "SMALL movements",
          "1 min each side"
        ]
      }
    ],
    "shoulder extension": [
      {
        "session": "Shoulder Hyperflexion",
        "name": "Shoulder extension",
        "duration": "4 min",
        "cues": [
          "Lie face down on mat",
          "Arms down by sides, palms up",
          "Reach back, clasp hands together",
          "If can't clasp, use yoga strap between hands",
          "Lift hands UP toward ceiling",
          "Arms stay straight",
          "Squeeze shoulder blades together",
          "Keep forehead on mat or turn head to side",
          "Hold 1 (2 min):",
          {
            "text": "Breathe: 5 sec in, 5 sec out",
            "sub": true
          },
          {
            "text": "Try to lift hands higher with each exhale",
            "sub": true
          },
          "Rest (30 sec):",
          {
            "text": "Lower hands down",
            "sub": true
          },
          {
            "text": "Relax completely",
            "sub": true
          },
          "Hold 2 (1.5 min):",
          {
            "text": "Lift hands again",
            "sub": true
          },
          {
            "text": "Try to lift higher than round 1",
            "sub": true
          },
          {
            "text": "Focus on squeezing shoulder blades",
            "sub": true
          }
        ]
      }
    ],
    "sphinx to cobra pulses": [
      {
        "session": "Backbend Intensive",
        "name": "Sphinx to cobra pulses",
        "duration": "4 min",
        "cues": [
          "Start in sphinx (lie face down, forearms on floor)",
          "Elbows under shoulders",
          "Press to cobra (straighten arms, hands under shoulders)",
          "Focus on arching from MID-BACK, not lower back",
          "Keep hips on floor",
          "Slow: 5 sec up, 5 sec down",
          "15-20 reps",
          "Feel the work in upper/mid back"
        ]
      }
    ],
    "standing splits": [
      {
        "session": "Splits Maintenance",
        "name": "Standing splits",
        "duration": "2 min",
        "cues": [
          "Right leg behind: 45 sec",
          "Left leg behind: 45 sec",
          "Hips square, back straight"
        ]
      }
    ],
    "supine twists": [
      {
        "session": "Splits Maintenance",
        "name": "Supine twists",
        "duration": "60 sec",
        "cues": [
          "30 sec each side"
        ]
      },
      {
        "session": "Backbend Intensive",
        "name": "Supine twists",
        "duration": "2 min",
        "cues": [
          "Lie on back",
          "Right knee to chest, drop to left",
          "Right arm extends right, look right",
          "Hold 60 sec",
          "Switch sides",
          "Hold 60 sec"
        ]
      }
    ],
    "supported split left": [
      {
        "session": "Splits Maintenance",
        "name": "Supported split - left",
        "duration": "4 min",
        "cues": [
          "Same - less support than Saturday",
          "4 min hold",
          "📊 MEASURE distance",
          "📸 PHOTO if breakthrough"
        ]
      }
    ],
    "supported split right": [
      {
        "session": "Splits Maintenance",
        "name": "Supported split - right",
        "duration": "4 min",
        "cues": [
          "Try 2-4\" LESS support than Saturday",
          "Or try NO SUPPORT if you feel ready!",
          "Warm muscles = deepest stretch",
          "Square hips, front heel down, toes up",
          "First 2 min: relax into position",
          "Last 2 min: try to close gap",
          "📊 MEASURE: hips-to-floor",
          "📸 PHOTO if it's deeper than Saturday!"
        ]
      }
    ],
    "theragun": [
      {
        "session": "Splits Maintenance",
        "name": "Theragun",
        "duration": "3 min",
        "cues": [
          "Quick lower body recovery",
          "LOW setting (you're tired)",
          "Hip flexors, hamstrings, glutes"
        ]
      },
      {
        "session": "Shoulder Hyperflexion",
        "name": "Theragun",
        "duration": "5 min",
        "cues": [
          "Upper traps: 1.5 min each side",
          "Rear delts: 1 min each side",
          "Lats: 30 sec each side",
          "Mid-back: 30 sec"
        ]
      },
      {
        "session": "Backbend Intensive",
        "name": "Theragun recovery",
        "duration": "3 min",
        "cues": [
          "Upper back, shoulders, lats",
          "LOW setting (you're tired)",
          "Focus on areas that worked hardest"
        ]
      }
    ],
    "thoracic bridge with block": [
      {
        "session": "Backbend Intensive",
        "name": "Thoracic bridge with block",
        "duration": "4 min",
        "cues": [
          "Lie on back, knees bent, feet flat",
          "Place yoga block between thighs and SQUEEZE",
          "Hands by ears, fingers pointing toward shoulders",
          "Press into hands and feet",
          "Press up into bridge",
          "Block squeeze forces upper back to do the work",
          "Keep squeezing block throughout",
          "Focus on arching UPPER back, not just pushing hips",
          "Head stays relatively neutral",
          "Set 1: 30 sec hold",
          "Rest: 30 sec (lower down, keep block squeezed)",
          "Set 2: 30 sec hold",
          "Rest: 30 sec",
          "Set 3: 30 sec hold",
          "Rest: 30 sec",
          "Set 4: 30 sec hold"
        ]
      }
    ],
    "thoracic roll": [
      {
        "session": "Shoulder Hyperflexion",
        "name": "Thoracic spine roll",
        "duration": "3 min",
        "cues": [
          "Lie on back, roller at bra-line",
          "Cross arms over chest",
          "Lift hips 1-2\""
        ]
      },
      {
        "session": "Backbend Intensive",
        "name": "Thoracic roll",
        "duration": "3 min",
        "cues": [
          "Lie on back, foam roller at mid-back (bra-line)",
          "Cross arms over chest",
          "Lift hips slightly",
          "Roll up and down",
          "Arch over roller on tender spots",
          "6-8 passes"
        ]
      }
    ],
    "thread the needle": [
      {
        "session": "Shoulder Hyperflexion",
        "name": "Thread-the-needle",
        "duration": "2 min",
        "cues": [
          "From hands and knees",
          "Lift right arm",
          "Slide UNDER left arm",
          "Right shoulder and ear to floor",
          "Left hand can stay on floor or reach up",
          "Hold 60 sec",
          "Switch sides",
          "Hold 60 sec"
        ]
      }
    ],
    "upper back roll": [
      {
        "session": "Shoulder Hyperflexion",
        "name": "Upper back roll",
        "duration": "2 min",
        "cues": [
          "Lie on back, roller across upper back",
          "Medium pressure",
          "Roll side to side",
          "Focus between shoulder blades"
        ]
      }
    ],
    "wide straddle fold": [
      {
        "session": "Splits Maintenance",
        "name": "Wide straddle fold",
        "duration": "2 min",
        "cues": [
          "Fold forward",
          "Should feel easier than Saturday"
        ]
      }
    ]
  }
};
