import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { loadConfig } from "../../src/config.js";
import { WorkspaceContextProvider } from "../../src/workspace/workspace-context-provider.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function makeRepo(parent: string, name = "repo"): string {
  const root = path.join(parent, name);
  fs.mkdirSync(path.join(root, ".git"), { recursive: true });
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  return root;
}

describe("WorkspaceContextProvider", () => {
  it("switches stores and IDs when cwd moves between same-named Workspaces", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "workspace-provider-"));
    roots.push(tmp);
    const first = makeRepo(path.join(tmp, "one"));
    const second = makeRepo(path.join(tmp, "two"));
    const provider = new WorkspaceContextProvider(loadConfig(path.join(tmp, "missing-config.json")));

    const firstContext = await provider.refresh(path.join(first, "src"));
    assert.ok(firstContext);
    await firstContext.store.add("memory", "first Workspace only");

    const secondContext = await provider.refresh(path.join(second, "src"));
    assert.ok(secondContext);
    await secondContext.store.add("memory", "second Workspace only");

    assert.notStrictEqual(firstContext.id, secondContext.id);
    assert.notStrictEqual(firstContext.memoryDir, secondContext.memoryDir);
    assert.deepStrictEqual(firstContext.store.getMemoryEntries().map((entry) => entry.replace(/\s*<!--.*$/, "")), ["first Workspace only"]);
    assert.deepStrictEqual(secondContext.store.getMemoryEntries().map((entry) => entry.replace(/\s*<!--.*$/, "")), ["second Workspace only"]);
    assert.strictEqual(provider.getActive()?.id, secondContext.id);
  });

  it("clears active context outside a Workspace", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "workspace-provider-none-"));
    roots.push(tmp);
    const repo = makeRepo(path.join(tmp, "with-repo"));
    const plain = path.join(tmp, "plain");
    fs.mkdirSync(plain, { recursive: true });
    const provider = new WorkspaceContextProvider(loadConfig(path.join(tmp, "missing-config.json")));

    assert.ok(await provider.refresh(repo));
    assert.strictEqual(await provider.refresh(plain), null);
    assert.strictEqual(provider.getActive(), null);
  });
});
