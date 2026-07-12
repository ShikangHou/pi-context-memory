import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { MemoryQuarantine } from "../security/memory-quarantine.js";

export function registerQuarantineCommands(pi: ExtensionAPI, quarantine: MemoryQuarantine): void {
  pi.registerCommand("memory-quarantine", {
    description: "List quarantined memory content without injecting it into model context",
    handler: async (_args, ctx) => {
      const entries = quarantine.list();
      if (entries.length === 0) {
        ctx.ui.notify("Memory quarantine is empty.", "info");
        return;
      }
      const lines = ["Memory Quarantine", "─────────────────"];
      for (const entry of entries) {
        lines.push(`${entry.id} · ${entry.phase} · ${entry.source} · ${entry.createdAt}`);
        lines.push(`  Matches: ${entry.injectionMatches.join(", ") || entry.secretMatches.join(", ") || "policy"}`);
        lines.push(`  Preview: ${entry.content.replace(/\s+/g, " ").slice(0, 120)}`);
      }
      lines.push(`Directory: ${quarantine.getDirectory()}`);
      ctx.ui.notify(lines.join("\n"), "warning");
    },
  });

  pi.registerCommand("memory-quarantine-delete", {
    description: "Delete one quarantined memory by ID",
    handler: async (args, ctx) => {
      const id = String(args ?? "").trim();
      if (!id) {
        ctx.ui.notify("Usage: /memory-quarantine-delete <id>", "warning");
        return;
      }
      const deleted = quarantine.delete(id);
      ctx.ui.notify(
        deleted ? `Deleted quarantined memory ${id}.` : `Quarantine entry not found: ${id}`,
        deleted ? "info" : "warning",
      );
    },
  });
}
