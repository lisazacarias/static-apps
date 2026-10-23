// Dev-only: print every movement's "How to do it" notes as Markdown, with
// where each came from and how the plan uses it, for cross-checking.
//
//   npm run form-doc > movement-descriptions.md
import { movementIndex } from '../plan.js';
import ROUTINE from '../routine.js';
import FORM from '../form.js';

const index = movementIndex(ROUTINE);
const plain = (t) => t.replace(/\s*\[\d+\](\[\d+\])*/g, '');
const tag = (f) => (f.guess ? 'Best guess' : f.fromPlan ? 'From your calendar' : 'Standard technique');
const out = [
  '# Flex Training: movement descriptions',
  '',
  `These are the "How to do it" notes the app shows for every movement in your plan (version ${ROUTINE.guide.version}). Each one is tagged with where it came from:`,
  '',
  '- **From your calendar:** taken from the cues in your Flex Training calendar events.',
  '- **Standard technique:** general form notes, not from your calendar. Reviewed for accuracy and for consistency with your plan.',
  '- **Best guess:** your calendar only gives the name, so this is my best reading. Tell me if it\'s not what you do.',
  '',
  'Under each one, **In your plan** gives the plan\'s own time and dose. The app follows those, not the description.',
  '',
  '## Best guesses',
  '',
  ...index.filter((m) => FORM[m.key]?.guess).map((m) => `- **${m.name}**: ${FORM[m.key].guess}`),
  '',
  '---',
  '',
];
for (const m of index) {
  const f = FORM[m.key];
  out.push(`## ${m.name}`, '', `*${tag(f)}*`, '');
  if (f.guess || f.note) out.push(`> ${f.guess || f.note}`, '');
  if (f.intro) out.push(`**${f.intro}**`, '');
  if (f.setup) out.push(`**Setup.** ${f.setup}`, '');
  f.steps.forEach((s, i) => out.push(`${i + 1}. ${s}`));
  out.push('');
  if (f.cues?.length) out.push('**Cues**', '', ...f.cues.map((c) => `- ${c}`), '');
  if (f.avoid?.length) out.push('**Avoid**', '', ...f.avoid.map((c) => `- ${c}`), '');
  out.push('**In your plan**', '');
  for (const u of m.uses) {
    out.push(`- ${u.session}${u.version ? ` (${u.version})` : ''}${u.name !== m.name ? `, as "${u.name}"` : ''}: ${u.duration}${u.detail ? `. ${plain(u.detail)}` : ''}`);
  }
  out.push('');
}
process.stdout.write(out.join('\n'));
