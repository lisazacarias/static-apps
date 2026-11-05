// Shared by scripts/steps.mjs and the steps test.
import { checklist, playPhases } from '../plan.js';
import ROUTINE from '../routine.js';

export function stepsText() {
  const seen = new Set();
  const lines = [];
  for (const s of ROUTINE.sessions) {
    for (const variant of ['full', ...(s.versions || []).map((v) => v.id)]) {
      for (const { item } of checklist(s, variant)) {
        const steps = playPhases(item).filter((p) => p.kind !== 'ready')
          .map((p) => (p.kind === 'switch' ? `⇄ ${p.label}` : `${p.label || p.kind} ${p.seconds}s`)).join(' | ');
        const line = `${s.id} / ${item.name} (${item.duration}): ${steps}`;
        if (!seen.has(line)) { seen.add(line); lines.push(line); }
      }
    }
  }
  return lines.join('\n') + '\n';
}
