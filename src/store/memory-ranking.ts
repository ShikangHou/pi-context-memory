import type { MemoryCategory } from '../types.js';

export interface RecallCandidate {
  id: string;
  content: string;
  workspaceId: string | null;
  category: MemoryCategory | null;
  bm25Score?: number;
  created?: string;
  lastReferenced?: string;
  confidence?: number;
  graphScore?: number;
  stale?: boolean;
  conflicted?: boolean;
  quarantined?: boolean;
  superseded?: boolean;
  expired?: boolean;
}

export interface RankedRecallCandidate extends RecallCandidate {
  finalScore: number;
  scoreReasons: string[];
}

const CATEGORY_BOOST: Partial<Record<MemoryCategory, number>> = {
  correction: 8, failure: 6, 'tool-quirk': 5, convention: 4, preference: 3, insight: 1,
};

export function rankMemoryCandidates(candidates: RecallCandidate[], workspaceId: string | null, now = new Date()): RankedRecallCandidate[] {
  return candidates
    .filter((candidate) => candidate.workspaceId === null || candidate.workspaceId === workspaceId)
    .filter((candidate) => !candidate.quarantined && !candidate.superseded && !candidate.expired)
    .map((candidate) => {
      const reasons: string[] = [];
      let score = candidate.bm25Score ?? 0;
      if (candidate.workspaceId && candidate.workspaceId === workspaceId) { score += 5; reasons.push('workspace:+5'); }
      const category = candidate.category ? CATEGORY_BOOST[candidate.category] ?? 0 : 0;
      if (category) { score += category; reasons.push(`category:+${category}`); }
      const timestamp = Date.parse(candidate.lastReferenced ?? candidate.created ?? '');
      if (Number.isFinite(timestamp)) {
        const ageDays = Math.max(0, (now.getTime() - timestamp) / 86_400_000);
        const recency = Math.max(0, 2 - ageDays / 30);
        score += recency;
        reasons.push(`recency:+${recency.toFixed(2)}`);
      }
      score += candidate.confidence ?? 0;
      score += candidate.graphScore ?? 0;
      if (candidate.stale) { score -= 4; reasons.push('stale:-4'); }
      if (candidate.conflicted) { score -= 7; reasons.push('conflict:-7'); }
      return { ...candidate, finalScore: score, scoreReasons: reasons };
    })
    .sort((a, b) => b.finalScore - a.finalScore || a.id.localeCompare(b.id));
}
