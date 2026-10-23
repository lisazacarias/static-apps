// The weekly routine: what the app shows, and what Export .ics writes.
// Converted once from the Flex Training calendar; edit here from now on.
//
//   sessions  day 0 = Monday … 6 = Sunday; start/end are the calendar block,
//             total is the session's own minute count
//   sections  [{ title, minutes, note?, items }]; an item marked whole is the
//             section itself (its notes are all cues, no named movements)
//   item      { name, duration, detail?, cues? } — a cue is a string, or
//             { text, sub: true } for a line under a step
//   short     the short-on-time version, when there is one
//   library   longer write-ups from earlier versions of the plan, keyed by
//             moveKey() in plan.js; the Movements tab shows them too
export default {
  "sessions": [
    {
      "id": "shoulder-maintenance",
      "title": "Shoulder Maintenance",
      "day": 0,
      "start": "21:15",
      "end": "21:30",
      "total": 15,
      "intro": [
        "⚠️ SKIP if exhausted — listen to your body"
      ],
      "short": {
        "minutes": 5,
        "items": [
          {
            "name": "Foam roll lats",
            "duration": "2 min",
            "detail": "roller under armpit, slow passes, stop on tender spots; 1 min/side"
          },
          {
            "name": "Shoulder CARs",
            "duration": "3 min",
            "detail": "5 reps each direction per arm, big controlled circles, torso still"
          }
        ],
        "skip": "wall clocks"
      },
      "sections": [
        {
          "title": "Foam roll lats",
          "minutes": 4,
          "items": [
            {
              "name": "Foam roll lats",
              "duration": "4 min",
              "cues": [
                "Roller under armpit, slow passes",
                "Stop on tender spots, 2 min each side"
              ],
              "whole": true
            }
          ]
        },
        {
          "title": "Shoulder CARs",
          "minutes": 3,
          "items": [
            {
              "name": "Shoulder CARs",
              "duration": "3 min",
              "cues": [
                "5 reps each direction per arm",
                "Big controlled circles, torso still"
              ],
              "whole": true
            }
          ]
        },
        {
          "title": "Wall clocks",
          "minutes": 8,
          "note": "(skip if exhausted)",
          "items": [
            {
              "name": "Wall clocks",
              "duration": "8 min",
              "cues": [
                "12/3/6/9 o'clock positions, 30s each",
                "Press firmly, reverse direction",
                "Switch arms, repeat"
              ],
              "whole": true
            }
          ]
        }
      ]
    },
    {
      "id": "backbend-intensive",
      "title": "Backbend Intensive",
      "day": 1,
      "start": "19:00",
      "end": "20:30",
      "total": 90,
      "intro": [
        "🎯 BACKBEND OVERHAUL — ANTERIOR CHAIN FOCUS"
      ],
      "short": {
        "minutes": 20,
        "items": [
          {
            "name": "Cardio",
            "duration": "2 min",
            "cues": [
              "Mopping/sweeping or light movement, get heart rate up"
            ]
          },
          {
            "name": "Cat-cow",
            "duration": "1 min",
            "cues": [
              "Hands under shoulders, knees under hips. Round on exhale, arch on inhale"
            ]
          },
          {
            "name": "Couch/kneeling hip flexor",
            "duration": "2 min",
            "cues": [
              "Back foot up behind you, front knee 90°, tuck pelvis, press hips forward. 1 min/side"
            ]
          },
          {
            "name": "Sphinx → cobra pulses",
            "duration": "2 min",
            "cues": [
              "Forearms down → press up to hands. Lead with chest, shoulders down"
            ]
          },
          {
            "name": "Locust",
            "duration": "2 min",
            "cues": [
              "Face down, lift chest + legs together, squeeze glutes/back. Short holds"
            ]
          },
          {
            "name": "Camel at pole",
            "duration": "2 min",
            "cues": [
              "Kneeling, hold pole, lean back and open chest FROM BETWEEN THE SHOULDER BLADES first, hips follow after. 1x90s hold, rise slowly"
            ]
          },
          {
            "name": "Full bridge, depth focus",
            "duration": "7 min",
            "cues": [
              "Hands by ears, feet hip-width, press up evenly. Push the chest/upper back open before letting the lower back take the depth. 2 reps x 45-60s, ease deeper on exhales"
            ]
          },
          {
            "name": "Cool down",
            "duration": "2 min",
            "cues": [
              "Child's pose, then slow breaths"
            ]
          }
        ],
        "skip": "thoracic roll/arch-backs, extensor block, strength/endurance, theragun recovery"
      },
      "sections": [
        {
          "title": "Warm-up",
          "minutes": 8,
          "items": [
            {
              "name": "Cardio",
              "duration": "4 min",
              "detail": "dance/jump rope/jumping jacks, OR mopping/sweeping floors counts"
            },
            {
              "name": "Cat-cow",
              "duration": "2 min",
              "detail": "15 slow reps, thoracic bias — do this regardless of cardio choice, it's spine-specific prep"
            },
            {
              "name": "Segmental spinal waves",
              "duration": "2 min"
            }
          ]
        },
        {
          "title": "Open the restrictors",
          "minutes": 16,
          "items": [
            {
              "name": "Couch/kneeling hip flexor",
              "duration": "3 min",
              "detail": "90s/side, pelvis tucked"
            },
            {
              "name": "Half-kneeling hip flexor w/ reach-over",
              "duration": "2 min",
              "detail": "60s/side"
            },
            {
              "name": "Supported anterior-chain opener on roller",
              "duration": "2 min"
            },
            {
              "name": "Thoracic roll + arch-backs",
              "duration": "6 min",
              "detail": "4 positions, 30s each"
            },
            {
              "name": "Sphinx → cobra pulses",
              "duration": "3 min",
              "detail": "~9 slow reps"
            }
          ]
        },
        {
          "title": "Activate the extensors",
          "minutes": 8,
          "items": [
            {
              "name": "Locust",
              "duration": "3 min",
              "detail": "3x20s hold/20s rest"
            },
            {
              "name": "Bridge prep/glute bridge",
              "duration": "2.5 min",
              "detail": "10 reps"
            },
            {
              "name": "Thoracic bridge w/ block squeeze",
              "duration": "2.5 min",
              "detail": "3x30s"
            }
          ]
        },
        {
          "title": "Depth & skill work",
          "minutes": 22,
          "note": "(fresh, before fatigue) ⚠️ UPPER BACK CUE: your lower back is bendier than your upper back, so it'll try to do all the work here. Actively lift/open from between the shoulder blades BEFORE letting the hips or lower back add depth",
          "items": [
            {
              "name": "Camel at pole",
              "duration": "4 min",
              "detail": "2x90s hold — chest opens first, hips follow"
            },
            {
              "name": "Diagnostic bridge breathing test",
              "duration": "3 min",
              "detail": "does soft-belly exhale open depth?"
            },
            {
              "name": "Full bridge depth focus",
              "duration": "15 min",
              "detail": "3 reps x 45-60s, press the upper back/chest open before sinking into the lower back — today's depth is the right depth"
            }
          ]
        },
        {
          "title": "Strength & endurance",
          "minutes": 16,
          "note": "(fatigue OK)",
          "items": [
            {
              "name": "Bridge shoulder flossing",
              "duration": "8 min",
              "detail": "3 sets of 15-20 rocks — this one directly loads thoracic extension, good for the upper back gap"
            },
            {
              "name": "End-range ab strength",
              "duration": "5 min",
              "detail": "3x5 slow eccentric lowers"
            },
            {
              "name": "Endurance bridge",
              "duration": "3 min",
              "detail": "1x60s steady hold"
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
              "name": "Constructive rest + breathing",
              "duration": "2 min"
            }
          ]
        },
        {
          "title": "Theragun recovery",
          "minutes": 3,
          "items": [
            {
              "name": "Theragun recovery",
              "duration": "3 min",
              "cues": [
                "Upper back, shoulders, lats — low setting"
              ],
              "whole": true
            }
          ]
        }
      ],
      "footer": [
        "EVERY 4TH WEEK: deload — no depth chasing, just move through and breathe."
      ]
    },
    {
      "id": "splits-shoulder",
      "title": "Splits & Shoulder Maintenance",
      "day": 2,
      "start": "21:15",
      "end": "22:15",
      "total": 70,
      "intro": [
        "🎯 Splits maintenance, shoulder recovery post-pole, thoracic extension focus"
      ],
      "short": {
        "minutes": 18,
        "items": [
          {
            "name": "Hip flexor quick hits",
            "duration": "4 min",
            "cues": [
              "Couch stretch, don't force; 2 min/side"
            ]
          },
          {
            "name": "Split maintenance",
            "duration": "4 min",
            "cues": [
              "Hold and breathe, don't push; quick per side"
            ]
          },
          {
            "name": "Theragun",
            "duration": "5 min",
            "cues": [
              "Upper traps, lats — quick pass"
            ]
          },
          {
            "name": "Pole chest stretch, middle position only",
            "duration": "4 min",
            "cues": [
              "Breathe 5s in/5s out; 2 min/side"
            ]
          },
          {
            "name": "Cool down",
            "duration": "1 min",
            "cues": [
              "A few deep breaths"
            ]
          }
        ],
        "skip": "full warm-up, wide straddle/butterfly, high/low chest stretch positions, light mobility block, thoracic extension"
      },
      "sections": [
        {
          "title": "Splits maintenance",
          "minutes": 25,
          "items": [
            {
              "name": "Warm-up",
              "duration": "5 min",
              "detail": "leg swings, hip circles, walk around"
            },
            {
              "name": "Hip flexor quick hits",
              "duration": "8 min",
              "detail": "couch stretch 3 min/side, contract-relax 1 min/side"
            },
            {
              "name": "Split maintenance",
              "duration": "10 min",
              "detail": "less support than Saturday or same + relax deeper — right/left/middle. Just hold and breathe, don't push"
            },
            {
              "name": "Transition",
              "duration": "2 min",
              "detail": "water, Theragun ready"
            }
          ]
        },
        {
          "title": "Shoulder recovery post-pole",
          "minutes": 35,
          "items": [
            {
              "name": "Theragun",
              "duration": "10 min",
              "detail": "upper traps, rear delts, lats, between shoulder blades"
            },
            {
              "name": "Pole chest stretches",
              "duration": "12 min",
              "detail": "high/middle/low position, 2 min/side each"
            },
            {
              "name": "Light mobility",
              "duration": "8 min",
              "detail": "arm circles, thread-the-needle, child's pose w/ arm reaches"
            },
            {
              "name": "Final cool down",
              "duration": "5 min",
              "detail": "child's pose (3 min), deep breathing (2 min)"
            }
          ]
        },
        {
          "title": "Thoracic extension focus",
          "minutes": 10,
          "note": "⚡ NEW — targets upper back specifically, since it's noticeably less mobile than your lower back",
          "items": [
            {
              "name": "Thoracic extension over roller",
              "duration": "3 min",
              "cues": [
                "Lie perpendicular over foam roller at mid-back, hands behind head or arms overhead. Gently extend backward over the roller. Walk the roller up/down 2-3 segments, hold each 20-30s. Keep chin tucked slightly so the neck doesn't take over"
              ]
            },
            {
              "name": "Wall slides / thoracic extension",
              "duration": "3 min",
              "cues": [
                "Stand with back flat against wall, arms in \"goal post\" position (elbows/wrists touching wall). Slide arms up overhead and back down, keeping lower back pressed flat — the movement should come from the upper back/shoulders, not the lumbar arching away from the wall"
              ]
            },
            {
              "name": "Segmental cat-cow",
              "duration": "2 min",
              "cues": [
                "On hands and knees, exaggerate rounding and arching through the upper back specifically — try to keep the lower back more neutral/still while the movement happens between the shoulder blades. This is about teaching your spine to move in sections instead of one big arch"
              ]
            },
            {
              "name": "Prone thoracic extension",
              "duration": "2 min",
              "cues": [
                "Lie face down, hands behind head or by sides. Lift the chest by squeezing the upper back/between the shoulder blades — not by overarching the lower back. Should feel like effort between the shoulder blades, not a lower-back crunch"
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "shoulder-hyperflexion",
      "title": "Shoulder Hyperflexion",
      "day": 4,
      "start": "20:00",
      "end": "20:52",
      "total": 52,
      "intro": [
        "🎯 HYPERFLEXION PAST 180° FOCUSED"
      ],
      "short": {
        "minutes": 18,
        "items": [
          {
            "name": "Theragun",
            "duration": "3 min",
            "detail": "upper traps/lats — quick pass"
          },
          {
            "name": "Pole chest stretch, middle position only",
            "duration": "3 min",
            "detail": "breathe 5s in/5s out, ease in"
          },
          {
            "name": "Lat stretch on roller",
            "duration": "2 min",
            "detail": "1 hold, ease into it"
          },
          {
            "name": "Shoulder hyperflexion on bench",
            "duration": "8 min",
            "detail": "passive round (3 min, hands empty, relax into deepest position) + loaded round (3 min, whatever weight feels right today) + short rest — skip round 3"
          },
          {
            "name": "Cool down",
            "duration": "2 min",
            "detail": "child's pose + breathing"
          }
        ],
        "skip": "full tissue prep, band CARs, shoulder extension, high/low chest stretch positions"
      },
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
          "minutes": 5,
          "items": [
            {
              "name": "Theragun",
              "duration": "5 min",
              "cues": [
                "Upper traps, rear delts, lats, mid-back"
              ],
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
              "cues": [
                "Giant circles overhead",
                "10 clockwise + 10 counter-clockwise per arm"
              ],
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
              "cues": [
                "High/middle/low position, 2 min/side each",
                "Breathe 5s in/5s out"
              ],
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
              "cues": [
                "Hold 1 (2 min), rest (30s), hold 2 (1.5 min)",
                {
                  "text": "Ease a bit deeper on round 2 if it's there",
                  "sub": true
                }
              ],
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
              "cues": [
                "Hold 1 (2 min), rest (30s), hold 2 (1.5 min)",
                {
                  "text": "Ease deeper if available",
                  "sub": true
                }
              ],
              "whole": true
            }
          ]
        },
        {
          "title": "Shoulder hyperflexion on bench",
          "minutes": 12,
          "note": "⚡ MONEY EXERCISE",
          "items": [
            {
              "name": "Shoulder hyperflexion on bench",
              "duration": "12 min",
              "cues": [
                "Round 1, passive (4 min): hands empty, relax into deepest position",
                "Rest (1 min)",
                "Round 2, loaded (4 min): whatever weight/band tension feels right today — don't assume heavier than last time",
                "Rest (1 min)",
                "Round 3, unweighted (3 min): hold at today's available depth, no forcing toward a target"
              ],
              "whole": true
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
      "footer": [
        "EVERY 4TH WEEK: deload — passive round only, skip loading."
      ]
    },
    {
      "id": "splits-intensive",
      "title": "Splits Intensive",
      "day": 5,
      "start": "12:30",
      "end": "14:10",
      "total": 103,
      "short": {
        "minutes": 18,
        "items": [
          {
            "name": "Cardio",
            "duration": "3 min",
            "detail": "mopping/sweeping or quick movement — just get heart rate up"
          },
          {
            "name": "Couch stretch",
            "duration": "4 min",
            "detail": "shin vertical against wall, torso upright, don't force; 2 min/side"
          },
          {
            "name": "Contract-relax hip flexor",
            "duration": "2 min",
            "detail": "press back shin down 5-10s, relax deeper 20s; 1 min/side"
          },
          {
            "name": "Supported split right + left",
            "duration": "6 min",
            "detail": "4-6\" support, square hips, front heel down/toes up, back knee down, ease slightly deeper; 3 min/side"
          },
          {
            "name": "Middle split",
            "duration": "2 min",
            "detail": "knees pointing up, breathe, ease wider on exhales if it's there"
          },
          {
            "name": "Cool down",
            "duration": "2 min",
            "detail": "child's pose + deep breathing"
          }
        ],
        "skip": "theragun, hamstring/banded work, ankle mobility"
      },
      "sections": [
        {
          "title": "Warm-up",
          "minutes": 12,
          "items": [
            {
              "name": "Cardio",
              "duration": "8 min",
              "detail": "choreo run-through, OR mopping/sweeping floors counts — just get sweaty, heart rate up"
            },
            {
              "name": "Transition",
              "duration": "4 min",
              "detail": "water, calm music, clear space"
            }
          ]
        },
        {
          "title": "Active flexibility",
          "minutes": 12,
          "items": [
            {
              "name": "Standing splits at pole",
              "duration": "4 min",
              "detail": "hinge forward 20-30°, hips square, 60s/leg"
            },
            {
              "name": "Leg lifts at pole",
              "duration": "4 min",
              "detail": "front/side/back, 10 reps each leg"
            },
            {
              "name": "Supported split descents",
              "duration": "4 min",
              "detail": "slow slide near-floor, 3-4 reps/side"
            }
          ]
        },
        {
          "title": "Theragun prep",
          "minutes": 5,
          "items": [
            {
              "name": "Theragun prep",
              "duration": "5 min",
              "cues": [
                "Flexibility & Mobility program, hip flexors (gentle)"
              ],
              "whole": true
            }
          ]
        },
        {
          "title": "Hip flexor intensive",
          "minutes": 22,
          "note": "⚡ PRIORITY",
          "items": [
            {
              "name": "Psoas lunge",
              "duration": "4 min",
              "detail": "pelvis tucked, torso upright, 2 min/side"
            },
            {
              "name": "Elevated hip flexor",
              "duration": "4 min",
              "detail": "back foot on 8-12\" riser, 2 min/side"
            },
            {
              "name": "Couch stretch, extended",
              "duration": "8 min",
              "detail": "4 min/side, don't force"
            },
            {
              "name": "90/90 hip rotations",
              "duration": "2 min",
              "detail": "1 min each direction"
            },
            {
              "name": "Contract-relax hip flexor",
              "duration": "4 min",
              "detail": "press 5-10s, sink 20s, 2 min/side"
            }
          ]
        },
        {
          "title": "Hamstring work",
          "minutes": 11,
          "items": [
            {
              "name": "Half splits, active",
              "duration": "4 min",
              "detail": "flat back, hinge from hips, 2 min/side"
            },
            {
              "name": "Banded hamstring curls at pole",
              "duration": "3 min",
              "detail": "band looped at pole base, 3 sets of 12-15 reps"
            },
            {
              "name": "PNF hamstring",
              "duration": "4 min",
              "detail": "press 5-10s, fold deeper 20s, 2 min/side"
            }
          ]
        },
        {
          "title": "Split work",
          "minutes": 26,
          "items": [
            {
              "name": "Supported split right",
              "duration": "8 min",
              "detail": "square hips, ease deeper 2nd half"
            },
            {
              "name": "Supported split left",
              "duration": "8 min",
              "detail": "same protocol"
            },
            {
              "name": "Middle split",
              "duration": "6 min",
              "detail": "breathe, ease wider on exhale if it's there"
            },
            {
              "name": "Wide straddle fold",
              "duration": "2 min"
            },
            {
              "name": "Butterfly",
              "duration": "2 min"
            }
          ]
        },
        {
          "title": "Ankle mobility",
          "minutes": 5,
          "items": [
            {
              "name": "Ankle circles",
              "duration": "1 min"
            },
            {
              "name": "Point/flex",
              "duration": "2 min"
            },
            {
              "name": "Top-of-foot stretch",
              "duration": "2 min"
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
        },
        {
          "title": "Theragun recovery",
          "minutes": 5,
          "items": [
            {
              "name": "Theragun recovery",
              "duration": "5 min",
              "cues": [
                "Lower Body Recovery program, extra time on hip flexors"
              ],
              "whole": true
            }
          ]
        }
      ],
      "footer": [
        "EVERY 4TH WEEK: deload — no depth chasing, just move through and breathe. Skip banded curls or use light band only."
      ]
    },
    {
      "id": "splits-maintenance",
      "title": "Splits Maintenance",
      "day": 6,
      "start": "22:00",
      "end": "22:35",
      "total": 36,
      "intro": [
        "🔀 WARM (just finished rehearsal): skip to Section 1",
        "❄️ COLD (no rehearsal): do Section 0 first",
        "Total: 36 min warm / 48 min cold"
      ],
      "short": {
        "minutes": 10,
        "items": [
          {
            "name": "Couch stretch",
            "duration": "2 min",
            "detail": "shin vertical against wall, ease toward usual depth; 1 min/side"
          },
          {
            "name": "Supported split right + left",
            "duration": "4 min",
            "detail": "square hips, heel down/toes up; 2 min/side"
          },
          {
            "name": "Middle split",
            "duration": "1 min",
            "detail": "breathe, ease wider if available"
          },
          {
            "name": "Cool down",
            "duration": "2 min",
            "detail": "child's pose + breathing"
          }
        ],
        "skip": "leg lifts, standing splits, wide straddle, butterfly, theragun"
      },
      "sections": [
        {
          "title": "Warm-up",
          "minutes": 12,
          "note": "(cold only)",
          "items": [
            {
              "name": "Cardio",
              "duration": "5 min",
              "detail": "march → high knees → jumping jacks, OR mopping/sweeping floors counts"
            },
            {
              "name": "Dynamic leg swings",
              "duration": "4 min",
              "detail": "15/leg each direction — still do this even if you mopped, it's joint-specific prep mopping won't cover"
            },
            {
              "name": "Hip openers",
              "duration": "3 min",
              "detail": "lunges 8/side, hip circles"
            }
          ]
        },
        {
          "title": "Active flexibility",
          "minutes": 7,
          "items": [
            {
              "name": "Leg lifts at pole",
              "duration": "3 min",
              "detail": "front/side, 8 reps/leg"
            },
            {
              "name": "Standing splits",
              "duration": "2 min",
              "detail": "45s/leg, hips square"
            },
            {
              "name": "Active split descents",
              "duration": "2 min",
              "detail": "warm → 1-3\" from floor; cold → comfortable depth only"
            }
          ]
        },
        {
          "title": "Hip flexor quick hits",
          "minutes": 6,
          "items": [
            {
              "name": "Couch stretch",
              "duration": "4 min",
              "detail": "warm → slightly deeper; cold → match usual depth"
            },
            {
              "name": "Contract-relax",
              "duration": "2 min",
              "detail": "2-3 reps/side"
            }
          ]
        },
        {
          "title": "Split work",
          "minutes": 14,
          "items": [
            {
              "name": "Supported split right",
              "duration": "4 min",
              "detail": "warm → less support; cold → same/more support"
            },
            {
              "name": "Supported split left",
              "duration": "4 min",
              "detail": "same protocol"
            },
            {
              "name": "Middle split",
              "duration": "3 min",
              "detail": "warm → push a bit wider; cold → stay comfortable"
            },
            {
              "name": "Wide straddle fold",
              "duration": "2 min"
            },
            {
              "name": "Butterfly",
              "duration": "1 min"
            }
          ]
        },
        {
          "title": "Cool down",
          "minutes": 3,
          "items": [
            {
              "name": "Child's pose",
              "duration": "90s"
            },
            {
              "name": "Supine twists",
              "duration": "30s/side"
            },
            {
              "name": "Deep breathing",
              "duration": "30s"
            }
          ]
        },
        {
          "title": "Theragun",
          "minutes": 3,
          "items": [
            {
              "name": "Theragun",
              "duration": "3 min",
              "cues": [
                "Lower-body recovery, low setting"
              ],
              "whole": true
            }
          ]
        }
      ]
    }
  ],
  "library": {
    "active split descents": [
      {
        "session": "Splits Maintenance",
        "name": "Active split descents",
        "duration": "2 min",
        "cues": [
          "Right leg forward: 3-4 slow descents",
          "You should reach 1-3\" from floor!",
          "Left leg forward: 3-4 descents",
          "Capitalize on warm muscles"
        ]
      }
    ],
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
    "bridge shoulder flossing": [
      {
        "session": "Backbend Intensive",
        "name": "Bridge shoulder flossing",
        "duration": "8 min",
        "cues": [
          "⚡ CRITICAL FOR SHOULDER HYPERFLEXION ⚡",
          "Start in bridge position (hands and feet on floor)",
          "Walk hands toward feet 2-3 inches"
        ]
      }
    ],
    "butterfly": [
      {
        "session": "Splits Maintenance",
        "name": "Butterfly",
        "duration": "1 min",
        "cues": [
          "Quick relaxing stretch"
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
    "full bridge": [
      {
        "session": "Backbend Intensive",
        "name": "Full bridge work",
        "duration": "17 min",
        "cues": [
          "Bridge 1 - Warm-up (60 sec):",
          {
            "text": "Lie on back, knees bent, feet flat",
            "sub": true
          },
          {
            "text": "NO block now (remove it)",
            "sub": true
          },
          {
            "text": "Hands by ears, fingers pointing toward shoulders",
            "sub": true
          },
          {
            "text": "Press into hands and feet",
            "sub": true
          },
          {
            "text": "Press up into full bridge",
            "sub": true
          },
          {
            "text": "Straighten arms as much as possible",
            "sub": true
          },
          {
            "text": "Focus on getting comfortable in position",
            "sub": true
          },
          {
            "text": "Feet parallel, shoulder-width apart",
            "sub": true
          },
          {
            "text": "Press hips UP high",
            "sub": true
          },
          {
            "text": "Hold 60 seconds",
            "sub": true
          },
          {
            "text": "Breathe steadily",
            "sub": true
          },
          {
            "text": "Rest: 45 sec (child's pose)",
            "sub": true
          },
          {
            "text": "Lower down carefully",
            "sub": true
          },
          {
            "text": "Come to hands and knees",
            "sub": true
          },
          {
            "text": "Sit back on heels, arms forward",
            "sub": true
          },
          "Bridge 2 - Depth Work (60 sec):",
          {
            "text": "Lie on back, hands by ears",
            "sub": true
          },
          {
            "text": "Press up into bridge",
            "sub": true
          },
          {
            "text": "Once up, practice rocking:",
            "sub": true
          },
          {
            "text": "Rock forward over shoulders",
            "sub": true
          },
          {
            "text": "Rock back over feet",
            "sub": true
          },
          {
            "text": "Push hips HIGHER toward ceiling",
            "sub": true
          },
          {
            "text": "Try to straighten legs more",
            "sub": true
          },
          {
            "text": "Press chest toward the wall behind you",
            "sub": true
          },
          {
            "text": "This deepens the backbend",
            "sub": true
          },
          {
            "text": "Hold 60 seconds",
            "sub": true
          },
          {
            "text": "Keep breathing",
            "sub": true
          },
          {
            "text": "Rest: 45 sec (child's pose)",
            "sub": true
          },
          "Bridge 3 - Max Effort (45 sec):",
          {
            "text": "Lie on back, hands by ears",
            "sub": true
          },
          {
            "text": "Press up into bridge",
            "sub": true
          },
          {
            "text": "Once stable:",
            "sub": true
          },
          {
            "text": "Try to walk hands 1-2\" closer to feet",
            "sub": true
          },
          {
            "text": "Push hips as high as possible",
            "sub": true
          },
          {
            "text": "Straighten legs as much as you can",
            "sub": true
          },
          {
            "text": "This is your deepest bridge position",
            "sub": true
          },
          {
            "text": "📊 MEASURE: hand-to-foot distance",
            "sub": true
          },
          {
            "text": "📸 TAKE PHOTO from side",
            "sub": true
          },
          {
            "text": "Hold 45 seconds",
            "sub": true
          },
          {
            "text": "Rest: 45 sec (child's pose)",
            "sub": true
          },
          "Bridge 4 - Endurance (45 sec):",
          {
            "text": "Lie on back, hands by ears",
            "sub": true
          },
          {
            "text": "Press up into bridge",
            "sub": true
          },
          {
            "text": "Find a comfortable, sustainable position",
            "sub": true
          },
          {
            "text": "Hold steady (no rocking or adjusting)",
            "sub": true
          },
          {
            "text": "Focus on breathing: 5 sec in, 5 sec out",
            "sub": true
          },
          {
            "text": "Build stamina for holding bridge",
            "sub": true
          },
          {
            "text": "This trains endurance",
            "sub": true
          },
          {
            "text": "Hold 45 seconds",
            "sub": true
          },
          {
            "text": "REST: 2 min (child's pose)",
            "sub": true
          },
          {
            "text": "Full rest after bridge work",
            "sub": true
          },
          {
            "text": "Let entire back release",
            "sub": true
          },
          "Bridge 5 - Active Shoulder Work (60 sec):",
          {
            "text": "Press up into bridge",
            "sub": true
          },
          {
            "text": "Once stable, actively PUSH shoulders forward",
            "sub": true
          },
          {
            "text": "Try to shift more weight over shoulders",
            "sub": true
          },
          {
            "text": "Feel the hyperflexion demand",
            "sub": true
          },
          {
            "text": "This is advanced shoulder work",
            "sub": true
          },
          {
            "text": "Mimics positions needed for contortion",
            "sub": true
          },
          {
            "text": "Hold 60 seconds",
            "sub": true
          },
          {
            "text": "Rest: 45 sec (child's pose)",
            "sub": true
          },
          "Bridge 6 - Final Push (45 sec):",
          {
            "text": "One last bridge",
            "sub": true
          },
          {
            "text": "Everything you've got",
            "sub": true
          },
          {
            "text": "Combine all elements:",
            "sub": true
          },
          {
            "text": "Hands close to feet",
            "sub": true
          },
          {
            "text": "Hips high",
            "sub": true
          },
          {
            "text": "Shoulders pushed forward",
            "sub": true
          },
          {
            "text": "Legs as straight as possible",
            "sub": true
          },
          {
            "text": "Push for maximum depth",
            "sub": true
          },
          {
            "text": "Hold 45 seconds",
            "sub": true
          }
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
    "shoulder hyperflexion on bench": [
      {
        "session": "Shoulder Hyperflexion",
        "name": "Shoulder hyperflexion on bench",
        "duration": "12 min",
        "cues": [
          "Lie on bench/elevated surface (8-12\" high)",
          "Torso and hips on bench",
          "Arms overhead reaching DOWN toward floor behind you",
          "Arms straight",
          "🔑 RIBS STAY DOWN (don't arch lower back!)",
          "Goal: fingers go BELOW bench level (past 180°)",
          "Round 1 - Passive (4 min):",
          {
            "text": "Hands empty, no weights",
            "sub": true
          },
          {
            "text": "Focus: relax into deepest position",
            "sub": true
          },
          {
            "text": "Let gravity pull arms down",
            "sub": true
          },
          {
            "text": "Breathe: 5 sec in, 5 sec out",
            "sub": true
          },
          {
            "text": "With each exhale, try to lower hands 1/4\" closer to floor",
            "sub": true
          },
          {
            "text": "Don't force - let it happen naturally",
            "sub": true
          },
          "Rest (1 min):",
          {
            "text": "Bring arms down to sides",
            "sub": true
          },
          {
            "text": "Sit up, shake out shoulders",
            "sub": true
          },
          {
            "text": "Breathe normally",
            "sub": true
          },
          "Round 2 - Loaded (4 min):",
          {
            "text": "2-3 lb wrist weights (heavier than Tuesday!)",
            "sub": true
          },
          {
            "text": "OR resistance band anchored to wall/pole behind you",
            "sub": true
          },
          {
            "text": "Band should have moderate tension, gently pulling arms deeper",
            "sub": true
          },
          {
            "text": "This is KEY for past-180° adaptation",
            "sub": true
          },
          {
            "text": "The load helps tissue adapt to hyperflexion range",
            "sub": true
          },
          {
            "text": "Breathe steadily",
            "sub": true
          },
          {
            "text": "Don't hold breath",
            "sub": true
          },
          "Rest (1 min):",
          {
            "text": "Remove weights/band",
            "sub": true
          },
          {
            "text": "Bring arms to sides",
            "sub": true
          },
          {
            "text": "Sit up",
            "sub": true
          },
          "Round 3 - Max Depth (3 min):",
          {
            "text": "Return to unweighted",
            "sub": true
          },
          {
            "text": "Should be able to go 1-2\" deeper than Round 1",
            "sub": true
          },
          {
            "text": "This is your deepest position of the day",
            "sub": true
          },
          {
            "text": "📊 MEASURE: fingertip-to-floor distance",
            "sub": true
          },
          {
            "text": "(Negative number = fingers below bench level!)",
            "sub": true
          },
          {
            "text": "📸 TAKE PHOTO from side if breakthrough",
            "sub": true
          },
          {
            "text": "Hold full 3 minutes",
            "sub": true
          },
          {
            "text": "Keep breathing",
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
