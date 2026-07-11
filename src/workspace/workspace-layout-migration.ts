import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ENTRY_DELIMITER } from '../constants.js';
import { validateMemoryContent } from '../security/memory-validation.js';

export interface WorkspaceLayoutMigrationItem {
  source: string;
  target: string;
  hash: string;
  action: 'copied' | 'verified' | 'conflict' | 'rejected';
}

export interface WorkspaceLayoutMigrationReport {
  version: 1;
  workspaceRoot: string;
  createdAt: string;
  switched: boolean;
  items: WorkspaceLayoutMigrationItem[];
  warnings: string[];
}

const hashFile = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function filesUnder(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const stat = fs.statSync(root);
  if (stat.isFile()) return [root];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) =>
    filesUnder(path.join(root, entry.name)));
}

function atomicWrite(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, content, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temp, file);
}

/** Copy and hash-validate legacy repo-local content before callers switch to shared/. */
export function migrateWorkspaceLayout(workspaceRoot: string, piDirName = '.pi', now = new Date()): WorkspaceLayoutMigrationReport {
  const piDir = path.join(path.resolve(workspaceRoot), piDirName);
  const sharedDir = path.join(piDir, 'shared');
  fs.mkdirSync(sharedDir, { recursive: true });
  fs.mkdirSync(path.join(piDir, 'private'), { recursive: true, mode: 0o700 });
  fs.mkdirSync(path.join(piDir, 'runtime'), { recursive: true, mode: 0o700 });
  const mappings = [
    [path.join(piDir, 'MEMORY.md'), path.join(sharedDir, 'MEMORY.md')],
    [path.join(piDir, 'WORKSPACE.md'), path.join(sharedDir, 'WORKSPACE.md')],
    [path.join(piDir, 'knowledge'), path.join(sharedDir, 'knowledge')],
    [path.join(piDir, 'skills'), path.join(sharedDir, 'skills')],
  ] as const;
  const report: WorkspaceLayoutMigrationReport = {
    version: 1, workspaceRoot: path.resolve(workspaceRoot), createdAt: now.toISOString(),
    switched: true, items: [], warnings: [],
  };
  for (const [sourceRoot, targetRoot] of mappings) {
    for (const source of filesUnder(sourceRoot)) {
      const target = fs.statSync(sourceRoot).isFile()
        ? targetRoot
        : path.join(targetRoot, path.relative(sourceRoot, source));
      const sourceHash = hashFile(source);
      if (path.basename(source) === 'MEMORY.md') {
        const unsafe = fs.readFileSync(source, 'utf8').split(ENTRY_DELIMITER).filter(Boolean).find((entry) =>
          !validateMemoryContent(entry, { source, trustLevel: 'untrusted', phase: 'import' }).accepted);
        if (unsafe) {
          report.items.push({ source, target, hash: sourceHash, action: 'rejected' });
          report.warnings.push(`Unsafe memory was not migrated: ${source}`);
          continue;
        }
      }
      if (fs.existsSync(target)) {
        const action = hashFile(target) === sourceHash ? 'verified' : 'conflict';
        report.items.push({ source, target, hash: sourceHash, action });
        if (action === 'conflict') report.warnings.push(`Existing target differs; preserved both: ${target}`);
        continue;
      }
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
      if (hashFile(target) !== sourceHash) {
        fs.rmSync(target, { force: true });
        throw new Error(`Workspace migration verification failed: ${target}`);
      }
      report.items.push({ source, target, hash: sourceHash, action: 'copied' });
    }
  }
  atomicWrite(path.join(piDir, 'runtime', 'migration-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

/** Explicit rollback removes only migration-created copies whose hashes still match. */
export function rollbackWorkspaceLayout(report: WorkspaceLayoutMigrationReport): { removed: string[]; preserved: string[] } {
  const removed: string[] = []; const preserved: string[] = [];
  for (const item of report.items.filter((entry) => entry.action === 'copied')) {
    if (!fs.existsSync(item.target)) continue;
    if (hashFile(item.target) !== item.hash) { preserved.push(item.target); continue; }
    fs.rmSync(item.target);
    removed.push(item.target);
  }
  return { removed, preserved };
}
