import type { ExtensionAPI, ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import type { DatabaseManager } from '../store/db.js';
import type { MemoryQuarantine } from '../security/memory-quarantine.js';
import { inspectMemoryConsistency, repairMemoryConsistency, type MemoryDoctorReport } from '../store/memory-reconciler.js';
import { syncMarkdownMemoriesToSqlite } from './sync-markdown-memories.js';

interface MemoryDoctorOptions {
  globalDir: string;
  projectsMemoryDir?: string;
  agentRoot: string;
  quarantine: MemoryQuarantine;
  resolveActiveWorkspace?: (cwd?: string) => Promise<{ id: string; displayName: string; memoryDir: string } | null>;
}

function formatReport(report: MemoryDoctorReport): string {
  return [
    `Memory Doctor (${report.healthy ? 'healthy' : 'attention required'})`,
    `Markdown source files checked: ${report.filesChecked}`,
    `SQLite mirror rows checked: ${report.sqliteRowsChecked}`,
    `Missing Memory IDs: ${report.missingMemoryIds}`,
    `Divergent rows: ${report.divergentRows}`,
    `Orphaned rows: ${report.orphanedRows}`,
    `Missing source files: ${report.missingSourceFiles.length}`,
    `FTS inconsistencies: ${report.ftsInconsistencies}`,
    `Stale sync states: ${report.staleSyncStates}`,
    `Quarantine entries: ${report.quarantineEntries}`,
    report.missingSourceFiles.length ? `Missing files:\n${report.missingSourceFiles.map((file) => `- ${file}`).join('\n')}` : '',
    'No fixes were applied.',
  ].filter(Boolean).join('\n');
}

export function registerMemoryDoctorCommands(
  pi: ExtensionAPI,
  dbManager: DatabaseManager,
  options: MemoryDoctorOptions,
): void {
  pi.registerCommand('memory-doctor', {
    description: 'Run read-only diagnostics for Markdown and SQLite memory consistency',
    handler: async (_args, ctx: ExtensionCommandContext) => {
      const report = inspectMemoryConsistency(dbManager, options.quarantine.list().length);
      ctx.ui.notify(formatReport(report), report.healthy ? 'info' : 'warning');
    },
  });

  pi.registerCommand('memory-repair', {
    description: 'Re-import Markdown and remove stale SQLite mirror rows',
    handler: async (_args, ctx: ExtensionCommandContext) => {
      try {
        const active = await options.resolveActiveWorkspace?.(ctx.cwd);
        const synced = syncMarkdownMemoriesToSqlite(
          dbManager,
          options.globalDir,
          options.projectsMemoryDir,
          options.agentRoot,
          active ? { id: active.id, name: active.displayName, memoryDir: active.memoryDir } : null,
          options.quarantine,
        );
        const repaired = repairMemoryConsistency(dbManager);
        const report = inspectMemoryConsistency(dbManager, options.quarantine.list().length);
        const output = [
          'Memory Repair complete',
          `Imported rows: ${synced.imported}`,
          `Removed stale mirror rows: ${repaired.removedRows}`,
          `Recorded source files: ${repaired.filesRecorded}`,
          '',
          formatReport(report).replace('No fixes were applied.', 'No Markdown files or quarantine entries were deleted.'),
        ].join('\n');
        ctx.ui.notify(output, report.healthy ? 'info' : 'warning');
      } catch (error) {
        ctx.ui.notify(`Memory Repair failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
      }
    },
  });
}
