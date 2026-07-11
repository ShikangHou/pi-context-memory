import fs from 'node:fs';
import { createHash } from 'node:crypto';
import type { DatabaseManager } from './db.js';

export interface MemorySyncState {
  sourceFile: string;
  size: number;
  mtimeMs: number;
  contentHash: string;
  lastSyncedAt: string;
  sqliteRevision: number;
  lastError: string | null;
}

export function hashMemoryFile(sourceFile: string): string {
  return createHash('sha256').update(fs.readFileSync(sourceFile)).digest('hex');
}

export function recordMemorySyncState(
  dbManager: DatabaseManager,
  sourceFile: string,
  sqliteRevision: number,
  lastError: string | null = null,
): void {
  const stat = fs.statSync(sourceFile);
  dbManager.getDb().prepare(`
    INSERT INTO memory_sync_state (source_file, size, mtime_ms, content_hash, last_synced_at, sqlite_revision, last_error)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_file) DO UPDATE SET
      size = excluded.size,
      mtime_ms = excluded.mtime_ms,
      content_hash = excluded.content_hash,
      last_synced_at = excluded.last_synced_at,
      sqlite_revision = excluded.sqlite_revision,
      last_error = excluded.last_error
  `).run(sourceFile, stat.size, stat.mtimeMs, hashMemoryFile(sourceFile), new Date().toISOString(), sqliteRevision, lastError);
}

export function getMemorySyncStates(dbManager: DatabaseManager): MemorySyncState[] {
  return (dbManager.getDb().prepare(`
    SELECT source_file, size, mtime_ms, content_hash, last_synced_at, sqlite_revision, last_error
    FROM memory_sync_state ORDER BY source_file
  `).all() as Array<Record<string, unknown>>).map((row) => ({
    sourceFile: String(row.source_file),
    size: Number(row.size),
    mtimeMs: Number(row.mtime_ms),
    contentHash: String(row.content_hash),
    lastSyncedAt: String(row.last_synced_at),
    sqliteRevision: Number(row.sqlite_revision),
    lastError: row.last_error == null ? null : String(row.last_error),
  }));
}
