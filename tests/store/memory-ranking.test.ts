import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rankMemoryCandidates } from '../../src/store/memory-ranking.js';
import { packMemoryCandidates } from '../../src/store/memory-budget-packer.js';

describe('memory ranking and budget packing', () => {
  const base = { content: 'memory', bm25Score: 1, created: '2026-01-01', lastReferenced: '2026-01-01' };
  it('excludes wrong-workspace and unsafe lifecycle candidates', () => {
    const ranked = rankMemoryCandidates([
      { ...base, id: 'right', workspaceId: 'a', category: 'convention' },
      { ...base, id: 'wrong', workspaceId: 'b', category: 'correction' },
      { ...base, id: 'bad', workspaceId: null, category: null, quarantined: true },
    ], 'a', new Date('2026-01-02'));
    assert.deepStrictEqual(ranked.map((item) => item.id), ['right']);
  });
  it('ranks corrections and matching failures above ordinary memories', () => {
    const ranked = rankMemoryCandidates([
      { ...base, id: 'ordinary', workspaceId: 'a', category: 'insight' },
      { ...base, id: 'correction', workspaceId: 'a', category: 'correction' },
      { ...base, id: 'failure', workspaceId: 'a', category: 'failure' },
    ], 'a', new Date('2026-01-02'));
    assert.deepStrictEqual(ranked.map((item) => item.id), ['correction', 'failure', 'ordinary']);
  });
  it('reserves interleaved workspace/global capacity and enforces hard budgets', () => {
    const ranked = rankMemoryCandidates([
      { ...base, id: 'g1', workspaceId: null, category: 'correction' },
      { ...base, id: 'g2', workspaceId: null, category: 'failure' },
      { ...base, id: 'w1', workspaceId: 'a', category: 'convention' },
      { ...base, id: 'w2', workspaceId: 'a', category: 'insight' },
    ], 'a', new Date('2026-01-02'));
    const packed = packMemoryCandidates(ranked, 'a', { topK: 3, maxChars: 180, maxEntryChars: 20, maxTokens: 45 });
    assert.ok(packed.selected.some((item) => item.workspaceId === 'a'));
    assert.ok(packed.selected.some((item) => item.workspaceId === null));
    assert.ok(packed.chars <= 180);
    assert.ok(packed.estimatedTokens <= 45);
  });
});
