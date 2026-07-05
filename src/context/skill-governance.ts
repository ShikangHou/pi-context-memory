import * as fs from "node:fs";
import * as path from "node:path";

export interface SkillGovernanceEntry {
  name: string;
  description: string;
  path: string;
  scope: "global" | "workspace";
  valid: boolean;
  issues: string[];
}

export interface SkillGovernanceInspection {
  entries: SkillGovernanceEntry[];
  invalidSkills: SkillGovernanceEntry[];
  duplicateNames: string[];
  errors: string[];
}

function listSkillFiles(rootDir: string): string[] {
  if (!fs.existsSync(rootDir)) return [];
  const files: string[] = [];
  for (const item of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = path.join(rootDir, item.name);
    if (item.isFile() && item.name === "SKILL.md") {
      files.push(fullPath);
    } else if (item.isDirectory()) {
      const skillPath = path.join(fullPath, "SKILL.md");
      if (fs.existsSync(skillPath)) files.push(skillPath);
    }
  }
  return files.sort();
}

function parseFrontmatter(markdown: string): Record<string, string> | null {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const data: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!field) continue;
    data[field[1]] = field[2].replace(/^["']|["']$/g, "").trim();
  }
  return data;
}

function inspectSkillFile(filePath: string, scope: "global" | "workspace"): SkillGovernanceEntry {
  const issues: string[] = [];
  let name = "";
  let description = "";

  try {
    const frontmatter = parseFrontmatter(fs.readFileSync(filePath, "utf-8"));
    if (!frontmatter) {
      issues.push("missing frontmatter");
    } else {
      name = frontmatter.name ?? "";
      description = frontmatter.description ?? "";
      if (!name) issues.push("missing name");
      if (!description) issues.push("missing description");
    }
  } catch (err) {
    issues.push(err instanceof Error ? err.message : String(err));
  }

  return {
    name,
    description,
    path: filePath,
    scope,
    valid: issues.length === 0,
    issues,
  };
}

function findDuplicates(values: string[]): string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort();
}

export function inspectSkillsForGovernance(
  roots: Array<{ dir: string; scope: "global" | "workspace" }>,
): SkillGovernanceInspection {
  const entries: SkillGovernanceEntry[] = [];
  const errors: string[] = [];

  for (const root of roots) {
    try {
      for (const filePath of listSkillFiles(root.dir)) {
        entries.push(inspectSkillFile(filePath, root.scope));
      }
    } catch (err) {
      errors.push(`${root.dir}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    entries,
    invalidSkills: entries.filter((entry) => !entry.valid),
    duplicateNames: findDuplicates(entries.map((entry) => entry.name)),
    errors,
  };
}

export function summarizeSkillGovernance(inspection: SkillGovernanceInspection): string[] {
  const lines = [`Skill verification: ${inspection.invalidSkills.length === 0 ? "ok" : "issues"} (${inspection.entries.length} skills)`];
  if (inspection.invalidSkills.length > 0) {
    lines.push(`Invalid Skills: ${inspection.invalidSkills.map((entry) => `${entry.path} [${entry.issues.join(", ")}]`).join("; ")}`);
  }
  if (inspection.duplicateNames.length > 0) {
    lines.push(`Similar Skills: duplicate names ${inspection.duplicateNames.join(", ")}`);
  } else {
    lines.push("Similar Skills: none");
  }
  if (inspection.errors.length > 0) {
    lines.push(`Skill inspection errors: ${inspection.errors.join("; ")}`);
  }
  return lines;
}

