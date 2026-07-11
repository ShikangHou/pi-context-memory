import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseManager } from '../../src/store/db.js';
import { getMemories, syncMemoryEntry } from '../../src/store/sqlite-memory-store.js';
import { inspectMemoryConsistency, repairMemoryConsistency } from '../../src/store/memory-reconciler.js';
import { recordMemorySyncState } from '../../src/store/memory-sync-state.js';

describe('memory-reconciler', () => {
  let tmpDir: string;
  let dbManager: DatabaseManager;
  let sourceFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-reconciler-'));
    dbManager = new DatabaseManager(tmpDir);
    sourceFile = path.join(tmpDir, 'MEMORY.md');
  });

  afterEach(() => {
    dbManager.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reports a stable-ID row whose Markdown content has diverged', () => {
    const original = 'original <!-- id=mem_doctor, created=2026-07-11, updated=2026-07-11, last=2026-07-11 -->';
    fs.writeFileSync(sourceFile, original);
    syncMemoryEntry(dbManager, {
      content: 'original', target: 'memory', memoryUid: 'mem_doctor', sourceFile,
      sourceHash: 'outdated-hash',
    });

    const report = inspectMemoryConsistency(dbManager);
    assert.strictEqual(report.divergentRows, 1);
    assert.strictEqual(report.healthy, false);
  });

  it('removes a mirror row after its entry disappears from Markdown', () => {
    const kept = 'kept <!-- id=mem_kept, created=2026-07-11, updated=2026-07-11, last=2026-07-11 -->';
    fs.writeFileSync(sourceFile, kept);
    syncMemoryEntry(dbManager, { content: 'kept', target: 'memory', memoryUid: 'mem_kept', sourceFile, sourceHash: 'hash-kept' });
    syncMemoryEntry(dbManager, { content: 'gone', target: 'memory', memoryUid: 'mem_gone', sourceFile, sourceHash: 'hash-gone' });

    const before = inspectMemoryConsistency(dbManager);
    assert.strictEqual(before.orphanedRows, 1);
    const repaired = repairMemoryConsistency(dbManager);

    assert.strictEqual(repaired.removedRows, 1);
    assert.deepStrictEqual(getMemories(dbManager).map((entry) => entry.memoryUid), ['mem_kept']);
  });

  it('detects a changed file after sync state was recorded', () => {
    fs.writeFileSync(sourceFile, 'one');
    recordMemorySyncState(dbManager, sourceFile, 1);
    fs.writeFileSync(sourceFile, 'two');
    const report = inspectMemoryConsistency(dbManager);
    assert.strictEqual(report.staleSyncStates, 1);
  });
});
