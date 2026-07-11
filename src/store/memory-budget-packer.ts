import type { RankedRecallCandidate } from './memory-ranking.js';

export interface RecallBudget {
  topK: number;
  maxChars: number;
  maxEntryChars: number;
  maxTokens: number;
}

export interface PackedRecall {
  selected: RankedRecallCandidate[];
  excluded: Array<{ id: string; reason: string }>;
  text: string;
  chars: number;
  estimatedTokens: number;
}

const estimateTokens = (text: string) => Math.ceil(text.length / 4);

export function packMemoryCandidates(
  ranked: RankedRecallCandidate[],
  workspaceId: string | null,
  budget: RecallBudget,
): PackedRecall {
  const selected: RankedRecallCandidate[] = [];
  const excluded: Array<{ id: string; reason: string }> = [];
  const seen = new Set<string>();
  const workspace = ranked.filter((item) => item.workspaceId === workspaceId && workspaceId !== null);
  const global = ranked.filter((item) => item.workspaceId === null);
  const interleaved: RankedRecallCandidate[] = [];
  while (workspace.length || global.length) {
    if (workspace.length) interleaved.push(workspace.shift()!);
    if (global.length) interleaved.push(global.shift()!);
  }
  const open = `<retrieved-memory source="pi-context-memory" security="untrusted-context" workspace-id="${workspaceId ?? ''}">\n`;
  const close = '</retrieved-memory>';
  let body = '';
  for (const candidate of interleaved) {
    if (selected.length >= budget.topK) { excluded.push({ id: candidate.id, reason: 'top-k' }); continue; }
    if (seen.has(candidate.id)) { excluded.push({ id: candidate.id, reason: 'duplicate-id' }); continue; }
    const content = candidate.content.length > budget.maxEntryChars
      ? `${candidate.content.slice(0, Math.max(0, budget.maxEntryChars - 1))}…`
      : candidate.content;
    const line = `- [${candidate.id}] ${content}\n`;
    const nextText = open + body + line + close;
    if (nextText.length > budget.maxChars || estimateTokens(nextText) > budget.maxTokens) {
      excluded.push({ id: candidate.id, reason: 'budget' });
      continue;
    }
    seen.add(candidate.id);
    selected.push(candidate);
    body += line;
  }
  const text = selected.length === 0 ? '' : open + body + close;
  return { selected, excluded, text, chars: text.length, estimatedTokens: estimateTokens(text) };
}
