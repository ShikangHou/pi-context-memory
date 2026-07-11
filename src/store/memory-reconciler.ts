import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { ENTRY_DELIMITER } from '../constants.js';
import type { DatabaseManager } from './db.js';
import { parseMarkdownMemoryEntry } from './sqlite-memory-store.js';
import { getMemorySyncStates, hashMemoryFile, recordMemorySyncState } from './memory-sync-state.js';

export interface MemoryDoctorReport {
  filesChecked: number;
  sqliteRowsChecked: number;
  missingSourceFiles: string[];
  missingMemoryIds: number;
  divergentRows: number;
  orphanedRows: number;
  ftsInconsistencies: number;
  staleSyncStates: number;
  quarantineEntries: number;
  healthy: boolean;
}

type MirrorRow = { id: number; memory_uid: string | null; source_file: string; source_hash: string | null };

function entryIdentity(raw: string): { uid: string | null; hash: string } {
  const parsed = parseMarkdownMemoryEntry(raw, 'memory');
  return {
    uid: parsed.memoryUid ?? null,
    hash: createHash('sha256').update(raw.trim()).digest('hex'),
  };
}

function readIdentities(sourceFile: string): Array<{ uid: string | null; hash: string }> {
  const raw = fs.readFileSync(sourceFile, 'utf8').trim();
  if (!raw) return [];
  return raw.split(ENTRY_DELIMITER).map((entry) => entry.trim()).filter(Boolean).map(entryIdentity);
}

function mirrorRows(dbManager: DatabaseManager): MirrorRow[] {
  return dbManager.getDb().prepare(`
    SELECT id, memory_uid, source_file, source_hash FROM memories
    WHERE source_file IS NOT NULL ORDER BY id
  `).all() as MirrorRow[];
}

export function inspectMemoryConsistency(dbManager: DatabaseManager, quarantineEntries = 0): MemoryDoctorReport {
  const rows = mirrorRows(dbManager);
  const files = [...new Set(rows.map((row) => row.source_file))];
  const missingSourceFiles = files.filter((file) => !fs.existsSync(file));
  let missingMemoryIds = 0;
  let divergentRows = 0;
  let orphanedRows = 0;

  for (const sourceFile of files.filter((file) => fs.existsSync(file))) {
    const identities = readIdentities(sourceFile);
    missingMemoryIds += identities.filter((entry) => !entry.uid).length;
    const uidSet = new Set(identities.flatMap((entry) => entry.uid ? [entry.uid] : []));
    const hashSet = new Set(identities.map((entry) => entry.hash));
    for (const row of rows.filter((candidate) => candidate.source_file === sourceFile)) {
      const present = row.memory_uid ? uidSet.has(row.memory_uid) : !!row.source_hash && hashSet.has(row.source_hash);
      if (!present) orphanedRows++;
      else if (row.source_hash && !hashSet.has(row.source_hash)) divergentRows++;
    }
  }
  orphanedRows += rows.filter((row) => missingSourceFiles.includes(row.source_file)).length;

  const db = dbManager.getDb();
  const fts = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM memories) AS memories_count,
      (SELECT COUNT(*) FROM memory_fts) AS fts_count
  `).get() as { memories_count: number; fts_count: number };
  const states = getMemorySyncStates(dbManager);
  const staleSyncStates = states.filter((state) => (
    !fs.existsSync(state.sourceFile) || hashMemoryFile(state.sourceFile) !== state.contentHash || state.lastError !== null
  )).length;
  const ftsInconsistencies = Math.abs(fts.memories_count - fts.fts_count);
  const healthy = missingSourceFiles.length === 0 && missingMemoryIds === 0 && divergentRows === 0
    && orphanedRows === 0 && ftsInconsistencies === 0 && staleSyncStates === 0 && quarantineEntries === 0;
  return { filesChecked: files.length, sqliteRowsChecked: rows.length, missingSourceFiles, missingMemoryIds, divergentRows, orphanedRows, ftsInconsistencies, staleSyncStates, quarantineEntries, healthy };
}

export function repairMemoryConsistency(dbManager: DatabaseManager): { removedRows: number; filesRecorded: number } {
  const db = dbManager.getDb();
  const reconcile = () => {
    const rows = mirrorRows(dbManager);
    const files = [...new Set(rows.map((row) => row.source_file))];
    const removableIds: number[] = [];
    let revision = Date.now();
    let filesRecorded = 0;

    for (const sourceFile of files) {
      if (!fs.existsSync(sourceFile)) {
        removableIds.push(...rows.filter((row) => row.source_file === sourceFile).map((row) => row.id));
        continue;
      }
      const identities = readIdentities(sourceFile);
      const uidSet = new Set(identities.flatMap((entry) => entry.uid ? [entry.uid] : []));
      const hashSet = new Set(identities.map((entry) => entry.hash));
      for (const row of rows.filter((candidate) => candidate.source_file === sourceFile)) {
        if (row.memory_uid ? !uidSet.has(row.memory_uid) : !row.source_hash || !hashSet.has(row.source_hash)) removableIds.push(row.id);
      }
      recordMemorySyncState(dbManager, sourceFile, revision++);
      filesRecorded++;
    }

    if (removableIds.length > 0) {
      const placeholders = removableIds.map(() => '?').join(', ');
      db.prepare(`DELETE FROM memories WHERE id IN (${placeholders})`).run(...removableIds);
    }
    return { removedRows: removableIds.length, filesRecorded };
  };

  return db.transaction ? db.transaction(reconcile)() : reconcile();
}
