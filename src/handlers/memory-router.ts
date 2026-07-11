export interface MemoryRouterDecision {
  decision: 'retrieve' | 'skip';
  reasons: string[];
  query: string;
}

const RETRIEVAL_SIGNALS: Array<[RegExp, string]> = [
  [/\b(previously|last time|remember|continue|same issue|again)\b/i, 'prior-context'],
  [/(?:^|\s)(?:[\w.-]+\/)+[\w.-]+|\b(?:package\.json|tsconfig|config|README)\b/i, 'workspace-artifact'],
  [/\b(test|build|ci|deploy(?:ment)?|failed?|error|exception|timeout)\b/i, 'failure-or-workflow'],
  [/\b(prefer|preference|style|convention|always|never)\b/i, 'preference-or-convention'],
];

const SKIP_SIGNALS: Array<[RegExp, string]> = [
  [/^\s*(translate|翻译)\b/i, 'translation'],
  [/^\s*(format|reformat|capitalize|lowercase)\b/i, 'formatting-only'],
  [/^\s*(what is|define|explain)\b/i, 'generic-knowledge'],
];

export function routeMemory(query: string, toolFailure?: string | null): MemoryRouterDecision {
  const normalized = [query, toolFailure].filter(Boolean).join(' ').trim();
  if (!normalized) return { decision: 'skip', reasons: ['empty-input'], query: '' };
  const retrieveReasons = RETRIEVAL_SIGNALS.filter(([pattern]) => pattern.test(normalized)).map(([, reason]) => reason);
  if (toolFailure?.trim()) retrieveReasons.push('current-tool-failure');
  if (retrieveReasons.length > 0) {
    return { decision: 'retrieve', reasons: [...new Set(retrieveReasons)], query: normalized };
  }
  const skipped = SKIP_SIGNALS.find(([pattern]) => pattern.test(normalized));
  return { decision: 'skip', reasons: [skipped?.[1] ?? 'no-durable-context-signal'], query: normalized };
}
