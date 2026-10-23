// How to do each movement: setup, steps, cues and common mistakes, keyed by
// moveKey() in plan.js. These are general form notes added in the app, not
// part of the plan: the plan's own times, reps and cues win where they
// differ. The Movements tab and each session show them as "How to do it".
//
//   { setup?, steps, cues?, avoid?, guess?, fromPlan? }
//   fromPlan: condensed from the long cues in the earlier calendar version
//          of your plan, rather than written in the app
//   guess: the plan's name could mean more than one movement; this is the
//          most likely one, and the text says what's uncertain
//
// CHECK: the ones without fromPlan are general coaching practice written from the movement
// names, not from a cited source. Worth a skim with a coach.

export default {
  'bridge prep': {
    fromPlan: true,
    setup: 'Lie on your back, knees bent, feet flat and hip-width, heels close to your bum so the shins are roughly vertical. Arms by your sides, palms down.',
    steps: ['Brace the belly and squeeze the glutes.', 'Press through the feet and lift the hips until there’s a straight line from knees to shoulders.', 'Hold a moment at the top, then lower with control.'],
    cues: ['It’s a glute exercise: power from the bum, not an arch from the back.'],
    avoid: ['Arching past the straight line', 'Knees falling out'],
  },
  'camel at pole': {
    fromPlan: true,
    setup: 'Kneel facing the pole, knees hip-width, shins and tops of the feet flat. Hold the pole with both hands at chest height.',
    steps: [
      'Push the hips forward, past the knees, and keep pushing them forward the whole time.',
      'Lift the chest up and forward and start to arch the upper back.',
      'Let the head drop back gently, using the pole for support. Breathe 5 seconds in, 5 out.',
      'Come up to upright kneeling to finish, and sit back on the heels if needed.',
    ],
    cues: ['Chest opens first, then the hips follow.', 'Often deeper on a second hold.'],
    avoid: ['Sitting the hips back towards the heels', 'Cranking the neck'],
  },
  'hip extension end range strength': {
    fromPlan: true,
    steps: [
      'Kneeling lunge: back knee on the floor. Squeeze the back-leg glute and lift that knee 1 to 2 cm off the floor. Hold 5 seconds, lower.',
      'Front-split back-leg lifts: face the pole holding it, in a lunge or half-split shape. Lift the straight back leg up behind you, pause, lower slowly.',
    ],
    cues: ['The lift comes from the glute and back of the hip, not by arching the lower back.', 'Small range is fine; this is strength at the end of your range.'],
    avoid: ['Twisting the hips open to get the leg higher'],
  },
  'hyperflexion cars with band': {
    fromPlan: true,
    setup: 'Stand holding a light resistance band with both hands, arms straight, with light tension in it.',
    steps: [
      'Make giant circles: from in front of you, arc overhead and behind your head, continue round to the side and down.',
      'Keep the circles as large as possible, then reverse direction.',
    ],
    cues: ['The band gives feedback on your overhead range.', 'Ribs stay down.'],
    avoid: ['Bending the elbows', 'Arching the back to get the arms further back'],
  },
  'lat stretch on roller': {
    fromPlan: true,
    setup: 'Kneel with a foam roller in front of you and both hands on it.',
    steps: [
      'Sit your hips back towards your heels and roll the roller forward until your arms are fully extended.',
      'Push the chest down towards the floor until you feel it from the armpit to the lower back.',
      'Breathe 5 seconds in, 5 out; on each exhale let the chest sink slightly lower.',
    ],
    avoid: ['Letting the hips drift forward off the heels'],
  },
  'pole chest stretches': {
    fromPlan: true,
    setup: 'Stand side-on to the pole, holding it with the arm nearest it.',
    steps: [
      'High: forearm vertical, hand up above head height.',
      'Middle: forearm at shoulder height, elbow bent 90° (goal post).',
      'Low: forearm lower, hand pointing down towards belly height.',
      'In each position, rotate your chest away from the pole until you feel the chest and front of the shoulder. Breathe 5 seconds in, 5 out.',
    ],
    cues: ['Keep the hips square; the turn comes from the chest.'],
    avoid: ['Arching the lower back', 'Shrugging the shoulder'],
  },
  'shoulder extension': {
    fromPlan: true,
    setup: 'Lie face down, arms by your sides, palms up. Forehead on the mat or head turned to the side.',
    steps: [
      'Reach back and clasp your hands together (or hold a strap between them).',
      'With straight arms, lift the hands up towards the ceiling, squeezing the shoulder blades together.',
      'Breathe, and try to lift a little higher on each exhale.',
    ],
    avoid: ['Bending the elbows', 'Lifting the chest to cheat the height'],
  },
  'thoracic extension over roller': {
    fromPlan: true,
    setup: 'Lie on your back across a foam roller at mid-back, knees bent, hands behind your head or arms overhead.',
    steps: [
      'Gently extend backwards over the roller.',
      'Hold 20 to 30 seconds, then walk the roller up or down to the next segment.',
      'Cover 2 to 3 segments.',
    ],
    cues: ['Chin slightly tucked so the neck doesn’t take over.'],
    avoid: ['Rolling down into the lower back'],
  },
  '90 90 hip rotations': {
    setup: 'Sit with both knees bent to 90°: front shin across your body, back shin out to the side behind you. Hands on the floor behind you.',
    steps: [
      'Sit tall and lift both knees, keeping your feet on the floor.',
      'Rotate both knees over to the other side, landing in the mirror-image 90/90.',
      'Keep going side to side, slowly, for the time given.',
    ],
    cues: ['Lead with the hips, not by throwing the knees.', 'Use your hands less as it gets easier.'],
    avoid: ['Forcing a knee down to the floor', 'Collapsing the chest forward'],
  },
  'active middle split strength': {
    steps: [
      'Horse stance lower: feet wide, toes turned out. Sit down slowly between your feet over about 4 seconds, knees tracking over toes, then stand.',
      'Or Cossack squat: feet wide, shift onto one leg and sit down into it while the other leg stays straight with toes up. Lower slowly, push back up, switch sides.',
      'Or side-lying leg lift: lie on your side, bottom knee bent for balance, top leg straight and turned so the kneecap faces forward. Lift it as high as it goes, pause, lower slowly.',
    ],
    cues: ['Work at the end of your range, slowly.', 'Keep the chest up in the squats.'],
    avoid: ['Knees caving in', 'Rolling the hips back in the side-lying lift'],
  },
  'ankle circles': {
    setup: 'Sit with one leg out, or lie on your back with one foot in the air.',
    steps: ['Draw the biggest slow circles you can with the toes, moving only at the ankle.', 'Go both directions, then switch feet.'],
    cues: ['Keep the shin still.'],
  },
  'banded hamstring curls at pole': {
    setup: 'Loop a band around the pole base. Lie face down with your feet towards the pole and the band around one ankle, or both.',
    steps: [
      'Curl your heel towards your bum against the band.',
      'Lower back down over 4 seconds until the leg is straight.',
    ],
    cues: ['Squeeze your glutes and keep your hips pressed into the floor.', 'Lower slower than you lift.'],
    avoid: ['Hips lifting off the floor', 'Letting the band snap the leg straight'],
  },
  'cardio': {
    steps: ['Anything that gets you warm and slightly sweaty: a choreo run-through, dancing, jump rope, jumping jacks, or mopping and sweeping.', 'Build up gradually rather than starting flat out.'],
    cues: ['You’re done when you’re warm, not exhausted.'],
  },
  'cat cow': {
    setup: 'Hands and knees: hands under shoulders, knees under hips.',
    steps: [
      'Inhale: drop the belly, lift the chest and tailbone, look forward (cow).',
      'Exhale: push the floor away, round the whole spine, tuck the tailbone, drop the head (cat).',
      'Move slowly between the two.',
    ],
    cues: ['Thoracic bias: aim most of the movement at the upper back, between the shoulder blades.'],
    avoid: ['Doing it all from the lower back', 'Sinking into the shoulders'],
  },
  'childs pose': {
    setup: 'Kneel, big toes together, knees together or wide.',
    steps: ['Sit your hips back towards your heels.', 'Walk your hands forward on the floor, forehead down.', 'Let the back and shoulders go soft and breathe.'],
    cues: ['Knees wide gives a deeper shoulder and chest release.', 'A cushion under the forehead or hips is fine.'],
  },
  'constructive rest and breathing': {
    setup: 'Lie on your back, knees bent, feet flat and hip-width or a little wider. Let the knees rest against each other.',
    steps: ['Hands on your belly or ribs.', 'Breathe slowly and let your back sink into the floor.'],
    cues: ['Nothing to do or hold; let the muscles that worked switch off.'],
  },
  'contract relax hip flexor': {
    setup: 'Low lunge, back knee on the floor (padded), pelvis tucked so you feel the front of the back hip.',
    steps: [
      'Press the back shin or knee into the floor, as if dragging it forward, at about a third to half of your effort, for 5 to 10 seconds.',
      'Relax and sink a little deeper into the lunge for about 20 seconds.',
      'Repeat, then switch sides.',
    ],
    cues: ['Keep the pelvis tucked throughout; that’s what aims it at the hip flexor.'],
    avoid: ['Pressing at full effort', 'Arching the lower back to get deeper'],
  },
  'cool down': {
    steps: ['The movements listed for this block (child’s pose, supine twists, breathing). Each one has its own page.'],
  },
  'couch stretch': {
    setup: 'Kneel facing away from a wall or couch. Put one knee in the corner with that shin up the wall, the other foot flat in front in a lunge.',
    steps: ['Tuck the pelvis and squeeze the glute of the back leg.', 'Bring your torso upright only as far as you can with the pelvis still tucked.', 'Hold and breathe, then switch sides.'],
    cues: ['Hands on the front knee or blocks to start.', 'Pad the back knee.'],
    avoid: ['Arching the lower back', 'Forcing the torso upright'],
  },
  'deep breathing': {
    setup: 'Comfortable seated or lying position, eyes closed if you like.',
    steps: ['Breathe in through the nose for about 5 seconds, into the belly and sides of the ribs.', 'Breathe out through the mouth for about 5 seconds.', 'Repeat for the time given.'],
  },
  'foam roll lats': {
    setup: 'Lie on your side with the foam roller under your armpit, bottom arm reaching overhead.',
    steps: ['Roll slowly down a few inches towards your ribs and back up.', 'Pause on tender spots and breathe, 10 to 15 seconds.', 'Switch sides.'],
    cues: ['Turn slightly towards your back or chest to find different parts of the muscle.'],
    avoid: ['Rolling fast', 'Rolling on the shoulder joint itself'],
  },
  'full bridge': {
    setup: 'Lie on your back, knees bent, feet flat and hip-width, close to your bum. Hands by your ears, fingers pointing towards your shoulders, elbows up.',
    steps: [
      'Press into hands and feet and lift onto the top of your head first; pause and set the elbows in.',
      'Press up through straight-as-possible arms, pushing the chest towards the wall behind your hands.',
      'Come down by tucking the chin and lowering the upper back first.',
    ],
    cues: ['Open shoulders and chest first, then hips; let the lower back add depth last.', 'Hands on blocks if your wrists complain.'],
    avoid: ['Knees or feet flaring out', 'Dropping onto the head on the way down'],
  },
  'half kneeling hip flexor with reach over': {
    setup: 'Half-kneeling: back knee down, front foot flat ahead.',
    steps: [
      'Tuck the pelvis and squeeze the back glute until you feel the front of the back hip.',
      'Reach the arm on the back-leg side up and over towards the front-leg side.',
      'Hold and breathe, then switch sides.',
    ],
    cues: ['Reach long through the side of the body rather than leaning far.'],
    avoid: ['Arching the lower back', 'Letting the pelvis untuck as you reach'],
  },
  'half splits active': {
    setup: 'From a low lunge, shift your hips back over the back knee and straighten the front leg, heel down, toes up.',
    steps: ['Hinge forward from the hips with a flat back.', 'Actively pull the front heel down into the floor and lift the toes to work the leg, not just hang in it.', 'Hold, then switch sides.'],
    cues: ['Hands on blocks so the back can stay flat.'],
    avoid: ['Rounding the back to reach lower', 'Locking the front knee hard'],
  },
  'hip circles and lunges': {
    steps: ['Hip circles: stand on one leg (hold the pole if you like), lift the other knee and draw big circles with it both ways.', 'Lunges: step forward into a lunge, back knee towards the floor, and push back up. Alternate legs.'],
    cues: ['Big, controlled movement; this is a warm-up, not a stretch.'],
  },
  'leg lifts at pole': {
    setup: 'Stand tall next to or facing the pole, one hand on it for balance.',
    steps: ['Lift the working leg straight, front, side or back, as high as you can with control.', 'Pause briefly at the top and lower slowly.'],
    cues: ['Keep the standing leg straight and torso upright.', 'Height comes from the leg muscles, not momentum.'],
    avoid: ['Swinging', 'Leaning back or sideways to get the leg higher'],
  },
  'leg swings': {
    setup: 'Stand side-on to the pole or a wall, holding it.',
    steps: ['Swing the outside leg forward and back, starting small and getting bigger.', 'Then face the pole and swing the leg side to side across your body.', 'Switch legs.'],
    cues: ['Relaxed and rhythmic, not kicks.'],
  },
  'locust': {
    setup: 'Lie face down, arms by your sides (or forward or out for harder), forehead down.',
    steps: ['Lift the chest and legs off the floor together by squeezing the upper back and glutes.', 'Hold, keeping the neck long, then lower.'],
    cues: ['Look at the floor just ahead of you.', 'Feel it between the shoulder blades, not as a lower-back crunch.'],
    avoid: ['Cranking the head up', 'Holding your breath'],
  },
  'march or light cardio': {
    steps: ['March on the spot, lifting the knees, swinging the arms. Build up to light jogging or jumping jacks if you like.'],
    cues: ['Just enough to feel warm.'],
  },
  'middle split': {
    setup: 'Sit or kneel with legs wide, feet flexed and knees pointing up at the ceiling. Hands or forearms on the floor or blocks in front.',
    steps: ['Ease the legs wider only as far as you can with the knees still pointing up.', 'Breathe, and let the inner thighs soften on each exhale.', 'To come out, use your hands and bring the legs together slowly.'],
    cues: ['Hips over or slightly in front of the knees, not sitting back.'],
    avoid: ['Knees rolling forward', 'Bouncing'],
  },
  'pnf hamstring': {
    setup: 'Sit with the leg straight in front (or lie on your back with a strap around the foot), at a comfortable stretch.',
    steps: [
      'Press the heel down into the floor (or into the strap) at about a third to half of your effort, for 5 to 10 seconds.',
      'Relax and fold a little deeper, or pull the leg a little closer, for about 20 seconds.',
      'Repeat, then switch sides.',
    ],
    cues: ['Fold from the hips with a long back.'],
    avoid: ['Pressing at full effort', 'Rounding hard through the back'],
  },
  'point and flex': {
    setup: 'Sit with the legs straight.',
    steps: ['Point the feet fully, toes reaching away.', 'Then flex, pulling the toes back towards you.', 'Alternate slowly.'],
    cues: ['Keep the knees straight and still.'],
  },
  'psoas lunge': {
    setup: 'Low lunge with the back knee down (padded), front knee over the ankle.',
    steps: ['Tuck the pelvis (tailbone down) and squeeze the back glute.', 'Shift the hips slightly forward until you feel the front of the back hip.', 'Torso upright, hold and breathe, then switch sides.'],
    avoid: ['Sinking deep with an arched lower back'],
  },
  'rotator cuff': {
    setup: 'Lie on your back with the foam roller (or a ball) behind one shoulder blade. Arm out to the side, palm up.',
    steps: ['Make small movements to roll across the back of the shoulder blade.', 'Pause on tender spots, then switch sides.'],
    cues: ['Small movements. This is the meat of the shoulder blade, not the joint.'],
  },
  'seated pike compression lifts': {
    setup: 'Sit tall with the legs straight and together, toes pointed. Hands flat on the floor beside your knees.',
    steps: ['Lift one heel 2 to 5 cm off the floor without leaning back.', 'Hold 3 seconds, lower with control, then switch legs.'],
    cues: ['Keep the knee locked straight; the lift comes from the front of the hip.', 'Hands further back makes it easier.'],
    avoid: ['Leaning back', 'Bending the knee to get the heel up'],
  },
  'segmental cat cow': {
    setup: 'Hands and knees, hands under shoulders, knees under hips.',
    steps: [
      'Round and arch mainly through the upper back, between the shoulder blades.',
      'Try to keep the lower back fairly still while the movement happens higher up.',
      'Go slowly; aim to move one section of the spine at a time.',
    ],
    cues: ['Small and precise beats big and sloppy.'],
  },
  'segmental spinal waves': {
    guess: 'Not sure which version the plan means: a standing body wave, or the same idea on hands and knees. This is the standing one.',
    setup: 'Stand with feet hip-width, knees soft.',
    steps: [
      'Start the wave at the top: drop the chin, then let it roll down through the chest, ribs, waist and finally the pelvis.',
      'Reverse it, leading from the pelvis back up to the head.',
      'Keep the waves slow and try to move one section at a time.',
    ],
    cues: ['Think of moving each vertebra in turn, especially through the upper back.'],
    avoid: ['Moving the whole spine as one block'],
  },
  'shoulder cars': {
    setup: 'Stand tall, ribs down, one arm by your side. Make a fist and tense the rest of the body a little to keep it still.',
    steps: [
      'Move the arm through the biggest circle the shoulder allows: forward, up overhead, back and round down.',
      'Take 5 to 10 seconds per circle, then reverse.',
    ],
    cues: ['Only the shoulder moves; torso and ribs stay still.'],
    avoid: ['Arching the back or twisting to get the arm further'],
  },
  'shoulder hyperflexion on bench': {
    setup: 'Lie on your back on a bench or raised surface (8 to 12 inches high) with your shoulders near the end, so your arms can go overhead and down below bench level. Knees bent, feet on the bench or floor.',
    steps: [
      'Ribs down and lower back flat before you start.',
      'Take straight arms overhead and let them lower towards the floor behind you.',
      'Follow the plan’s rounds for holds and load.',
    ],
    cues: ['If the ribs flare or the back arches, the range is coming from your spine. Ease off until they stay down.'],
    avoid: ['Arching off the bench', 'Letting any weight pull you deeper than you can lift out of'],
  },
  'sphinx to cobra pulses': {
    setup: 'Lie face down, propped on forearms with elbows under shoulders (sphinx).',
    steps: ['Press up onto straight-ish arms into cobra, leading with the chest.', 'Lower back to sphinx. Slowly, about 5 seconds each way.'],
    cues: ['Shoulders down away from the ears; hips stay on the floor.', 'Aim the bend at the mid and upper back.'],
    avoid: ['Cranking the neck back', 'Pushing into the lower back'],
  },
  'standing splits': {
    setup: 'Face the pole and hold it with both hands.',
    steps: ['Stand on one leg and lift the other straight back behind you.', 'Hinge forward 20 to 30 degrees, lifting the back leg higher as you go.', 'Hold, then switch legs.'],
    cues: ['Hips square to the pole: the lifted hip doesn’t roll open.', 'Standing knee straight but not locked hard.'],
    avoid: ['Opening the hip to get the leg higher', 'Collapsing the chest towards the floor'],
  },
  'supine twists': {
    setup: 'Lie on your back.',
    steps: ['Bring one knee to your chest and let it drop across your body to the other side.', 'Reach the same-side arm out and turn your head towards it.', 'Hold and breathe, then switch sides.'],
    cues: ['Let gravity do it; keep both shoulders as close to the floor as is comfortable.'],
  },
  'supported anterior chain opener on roller': {
    guess: 'Not sure which version the plan means. This is the common one: lying back along a foam roller to open the chest, shoulders and front of the hips.',
    setup: 'Sit at one end of a foam roller and lie back along it so it supports your head and spine, tailbone on the end. Knees bent, feet flat.',
    steps: [
      'Let the arms fall open to the sides, palms up, in a T or goal-post shape.',
      'For more front-of-hip stretch, slide one or both legs out straight.',
      'Breathe and let the chest and front of the shoulders open.',
    ],
    avoid: ['Forcing the arms to the floor'],
  },
  'supported split descents': {
    setup: 'Lunge position with blocks or the pole for support, front heel on a slidey surface (sock on a smooth floor, or a towel).',
    steps: ['Slowly slide the front heel forward and the hips down towards the floor, using your hands to control it.', 'Go as low as you can control, then press back up to the lunge.'],
    cues: ['Hips square, front toes up.', 'Slow on the way down.'],
    avoid: ['Dropping into the bottom', 'Hips twisting open'],
  },
  'supported split left': {
    setup: 'Front splits position with your left leg in front, with blocks or cushions under your hands and under the front thigh or hips so you can relax.',
    steps: ['Square the hips: back hip forward, front hip back.', 'Front heel down, toes up; back knee and kneecap pointing at the floor (or toes tucked).', 'Relax into the support and breathe; ease a little deeper in the second half.'],
    cues: ['Measure support height so you can see progress.'],
    avoid: ['Hips twisting open', 'Bouncing'],
  },
  'supported split right': {
    setup: 'Front splits position with your right leg in front, with blocks or cushions under your hands and under the front thigh or hips so you can relax.',
    steps: ['Square the hips: back hip forward, front hip back.', 'Front heel down, toes up; back knee and kneecap pointing at the floor (or toes tucked).', 'Relax into the support and breathe; ease a little deeper in the second half.'],
    cues: ['Measure support height so you can see progress.'],
    avoid: ['Hips twisting open', 'Bouncing'],
  },
  'supported split right and left': {
    setup: 'Front splits position with blocks or cushions under your hands and under the front thigh or hips so you can relax.',
    steps: ['Square the hips: back hip forward, front hip back.', 'Front heel down, toes up; back knee pointing at the floor.', 'Breathe and ease slightly deeper, then switch legs.'],
    avoid: ['Hips twisting open', 'Bouncing'],
  },
  'theragun': {
    steps: ['Turn it on before it touches you, and float it over the muscle with light pressure.', 'Keep it moving slowly along the muscle for the time given.'],
    cues: ['Low speed when you’re tired or sore.'],
    avoid: ['Bones, joints, the spine and the front or sides of the neck', 'Pressing hard'],
  },
  'thoracic roll': {
    setup: 'Lie on your back with the foam roller across your mid-back (bra-line). Cross your arms over your chest or support your head. Lift your hips slightly.',
    steps: ['Roll slowly up towards the base of the neck and back down.', 'On tender spots, pause and gently arch back over the roller.'],
    cues: ['Stay between the bottom of the shoulder blades and the base of the neck.'],
    avoid: ['Rolling the lower back', 'Letting the head hang back'],
  },
  'thread the needle': {
    setup: 'Hands and knees.',
    steps: ['Lift one arm and slide it under the other arm along the floor, palm up.', 'Lower that shoulder and the side of your head to the floor.', 'Hold, come back up, switch sides.'],
    cues: ['Keep the hips over the knees so the twist comes from the upper back.'],
  },
  'top of foot stretch': {
    setup: 'Kneel with the tops of your feet flat on the floor, or stand and tuck the toes of one foot under behind you.',
    steps: ['Gently sit back (kneeling) or press the top of the foot towards the floor (standing) until you feel the front of the ankle and foot.', 'Hold, easing off if anything pinches.'],
    avoid: ['Sitting your whole weight back if it pinches'],
  },
  'transition': {
    steps: ['Not a movement: drink water and set up for the next block (blocks, strap, clear floor space).'],
  },
  'upper back roll': {
    setup: 'Lie on your back with the foam roller across your upper back, arms crossed over your chest.',
    steps: ['Lift your hips a little and rock gently side to side.', 'Focus on the area between the shoulder blades, with medium pressure.'],
    avoid: ['Rolling onto the neck'],
  },
  'wall clocks': {
    guess: 'Not sure exactly what the plan means here. This is the common shoulder version: an isometric press at each clock position.',
    setup: 'Stand side-on to a wall with the arm nearest it straight, palm flat on the wall.',
    steps: [
      'Start with the hand at 12 o’clock (straight up). Press the palm firmly into the wall for 30 seconds.',
      'Move to 3, 6 and 9 o’clock, pressing at each.',
      'Then go round the other way, and switch arms.',
    ],
    cues: ['Shoulder down away from the ear; ribs down.'],
  },
  'wall slides': {
    setup: 'Stand with your back, head and bum against a wall, feet a little out from it. Arms in a goal-post shape, elbows and backs of the wrists against the wall.',
    steps: ['Slide the arms up overhead as far as you can while keeping contact.', 'Slide back down to goal-post. Slowly.'],
    cues: ['Lower back stays pressed to the wall; the movement comes from the upper back and shoulders.'],
    avoid: ['Arching away from the wall to get higher'],
  },
  'warm up': {
    steps: ['Leg swings, hip circles and walking around until you feel loose. Each has its own page where it’s a separate movement.'],
  },
  'wide straddle fold': {
    setup: 'Sit with the legs wide, knees and toes pointing up.',
    steps: ['Sit tall, then walk the hands forward and fold from the hips.', 'Relax and breathe; let the fold come gradually.'],
    cues: ['A cushion under the hips helps tilt the pelvis forward.'],
    avoid: ['Rounding hard from the upper back', 'Knees rolling in'],
  },
  'wrist prep': {
    steps: [
      'Wrist circles: interlace the fingers and roll the wrists, both ways.',
      'Quadruped rocks: on hands and knees, rock forward and back over the hands, first with fingers forward, then with fingers pointing back towards your knees.',
      'Palm lifts: hands flat, lift the palms off the floor keeping the fingers down, then lower.',
    ],
    cues: ['Gentle; this gets the wrists ready for weight.'],
  },
  'wrist reset': {
    steps: [
      'Wrist flexion stretch: arm straight in front, palm down. With the other hand, gently bend the back of the hand towards you. Hold, switch.',
      'Or kneel with the backs of the hands on the floor, fingers towards your knees, and lean back gently.',
      'Shake out the forearms and hands.',
    ],
  },
};
