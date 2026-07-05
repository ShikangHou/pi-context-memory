import { describe, it } from "node:test";
import assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  inspectSkillsForGovernance,
  summarizeSkillGovernance,
} from "../../src/context/skill-governance.js";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pi-skill-governance-"));
}

function writeSkill(filePath: string, frontmatter: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${frontmatter}\n\n# Body\n`, "utf-8");
}

describe("skill-governance", () => {
  it("reports invalid skills and duplicate names across scopes", () => {
    const root = makeTempDir();
    const globalSkills = path.join(root, "global");
    const workspaceSkills = path.join(root, "workspace");

    writeSkill(path.join(globalSkills, "build", "SKILL.md"), [
      "---",
      "name: build",
      "description: Build workflow",
      "---",
    ].join("\n"));
    writeSkill(path.join(workspaceSkills, "build", "SKILL.md"), [
      "---",
      "name: build",
      "description: Workspace build workflow",
      "---",
    ].join("\n"));
    writeSkill(path.join(workspaceSkills, "broken", "SKILL.md"), [
      "---",
      "name: broken",
      "---",
    ].join("\n"));

    const inspection = inspectSkillsForGovernance([
      { dir: globalSkills, scope: "global" },
      { dir: workspaceSkills, scope: "workspace" },
    ]);

    assert.deepStrictEqual(inspection.duplicateNames, ["build"]);
    assert.strictEqual(inspection.invalidSkills.length, 1);
    assert.deepStrictEqual(inspection.invalidSkills[0].issues, ["missing description"]);

    const summary = summarizeSkillGovernance(inspection).join("\n");
    assert.match(summary, /Skill verification: issues \(3 skills\)/);
    assert.match(summary, /Similar Skills: duplicate names build/);
  });
});

