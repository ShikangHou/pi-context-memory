import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import type { MemoryValidationOptions, ValidationResult } from "./memory-validation.js";

export interface QuarantineEntry {
  id: string;
  createdAt: string;
  content: string;
  source: string;
  trustLevel: MemoryValidationOptions["trustLevel"];
  phase: MemoryValidationOptions["phase"];
  secretMatches: string[];
  injectionMatches: string[];
  reason?: string;
}

export class MemoryQuarantine {
  constructor(private readonly directory: string) {}

  add(content: string, options: MemoryValidationOptions, validation: ValidationResult): QuarantineEntry {
    fs.mkdirSync(this.directory, { recursive: true });
    const existing = this.list().find((entry) => (
      entry.content === content && entry.source === options.source && entry.phase === options.phase
    ));
    if (existing) return existing;
    const entry: QuarantineEntry = {
      id: `q_${randomUUID()}`,
      createdAt: new Date().toISOString(),
      content,
      source: options.source,
      trustLevel: options.trustLevel,
      phase: options.phase,
      secretMatches: validation.secretMatches,
      injectionMatches: validation.injectionMatches,
      reason: validation.reason,
    };
    const target = this.pathFor(entry.id);
    const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(entry, null, 2), { encoding: "utf8", mode: 0o600 });
    fs.renameSync(temp, target);
    return entry;
  }

  list(): QuarantineEntry[] {
    if (!fs.existsSync(this.directory)) return [];
    return fs.readdirSync(this.directory)
      .filter((name) => /^q_[0-9a-f-]+\.json$/i.test(name))
      .map((name) => {
        try {
          return JSON.parse(fs.readFileSync(path.join(this.directory, name), "utf8")) as QuarantineEntry;
        } catch {
          return null;
        }
      })
      .filter((entry): entry is QuarantineEntry => entry !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  delete(id: string): boolean {
    if (!/^q_[0-9a-f-]+$/i.test(id)) return false;
    const target = this.pathFor(id);
    if (!fs.existsSync(target)) return false;
    fs.unlinkSync(target);
    return true;
  }

  getDirectory(): string {
    return this.directory;
  }

  private pathFor(id: string): string {
    return path.join(this.directory, `${id}.json`);
  }
}
