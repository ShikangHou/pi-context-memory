/**
 * Preview context command — /memory-preview-context shows the policy-only prompt
 * or legacy memory blocks appended to the system prompt.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { MemoryStore } from "../store/memory-store.js";
import { resolveMemoryPolicyPrompt } from "../prompt-context.js";
import type { MemoryConfig } from "../types.js";
import type { ActiveWorkspaceContext } from "../workspace/workspace-context-provider.js";

export function registerPreviewContextCommand(
  pi: ExtensionAPI,
  store: MemoryStore,
  projectStore: MemoryStore | null,
  projectName: string,
  config: Pick<MemoryConfig, "memoryMode" | "memoryPolicyStyle" | "memoryPolicyCustomText"> = { memoryMode: "policy-only" },
  resolveWorkspaceContext?: (cwd?: string) => Promise<ActiveWorkspaceContext | null>,
): void {
  pi.registerCommand("memory-preview-context", {
    description: "Preview the memory policy or legacy memory context blocks",
    handler: async (_args, ctx) => {
      const dynamicWorkspace = resolveWorkspaceContext
        ? await resolveWorkspaceContext(ctx.cwd)
        : undefined;
      const activeProjectStore = resolveWorkspaceContext ? dynamicWorkspace?.store ?? null : projectStore;
      const activeProjectName = resolveWorkspaceContext ? dynamicWorkspace?.displayName ?? "" : projectName;
      if (config.memoryMode === "policy-only") {
        const policyPrompt = resolveMemoryPolicyPrompt(config);
        const lines: string[] = [];
        lines.push("");
        lines.push("  ╔══════════════════════════════════════════════╗");
        lines.push("  ║        Injected Context Preview             ║");
        lines.push("  ╚══════════════════════════════════════════════╝");
        lines.push("");
        lines.push("  Mode: policy-only");
        lines.push(`  Policy style: ${config.memoryPolicyStyle ?? "full"}`);
        lines.push("  This is the memory policy appended to the system prompt.");
        lines.push("  Full Markdown memories are NOT injected in this mode.");
        lines.push("");
        if (policyPrompt) {
          lines.push(policyPrompt);
          lines.push("");
          lines.push("  Blocks shown: 1");
        } else {
          lines.push("  No memory policy context is injected for this policy style.");
          lines.push("");
          lines.push("  Blocks shown: 0");
        }
        ctx.ui.notify(lines.join("\n"), "info");
        return;
      }

      const memoryBlock = store.formatForSystemPrompt();
      const projectBlock = activeProjectStore ? activeProjectStore.formatProjectBlock(activeProjectName) : "";

      const lines: string[] = [];
      lines.push("");
      lines.push("  ╔══════════════════════════════════════════════╗");
      lines.push("  ║        👀 Injected Context Preview          ║");
      lines.push("  ╚══════════════════════════════════════════════╝");
      lines.push("");
      lines.push("  This is the memory context appended to the system prompt.");
      lines.push("  (Core hidden system instructions are NOT shown.)");
      lines.push("");

      let blockCount = 0;

      if (memoryBlock) {
        blockCount++;
        lines.push("  ── MEMORY + USER + RECENT FAILURES ─────────────────────────");
        lines.push(memoryBlock);
        lines.push("");
      }

      if (projectBlock) {
        blockCount++;
        lines.push(`  ── PROJECT MEMORY (${activeProjectName}) ─────────────────────────`);
        lines.push(projectBlock);
        lines.push("");
      }

      if (blockCount === 0) {
        lines.push("  No memory context blocks are currently injected.");
        lines.push("  Add memory entries, then run this command again.");
        lines.push("");
      }

      lines.push(`  Blocks shown: ${blockCount}`);
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });
}
