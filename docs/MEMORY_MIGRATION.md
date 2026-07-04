# Memory Migration Inventory

Status: Stage 0 read-only inventory. No real data was moved, deleted, copied, or overwritten.

Design source: `LONG_TERM_CONTEXT_ARCHITECTURE.md`

## Summary

| Path | Current Type | Suggested Type | Scope | Suggested Location | Status | Risk |
|---|---|---|---|---|---|---|
| `~/.pi/agent/pi-hermes-memory/USER.md` | Runtime Markdown | Memory | Global User Memory | Keep under `~/.pi/agent/pi-hermes-memory/USER.md` | Existing | May contain personal data; do not copy into Git |
| `~/.pi/agent/pi-hermes-memory/MEMORY.md` | Runtime Markdown | Memory | Global Memory | Keep under `~/.pi/agent/pi-hermes-memory/MEMORY.md` | Existing | May contain private facts; do not copy into Git |
| `~/.pi/agent/pi-hermes-memory/sessions.db` | SQLite cache/archive index | Session index | Global machine-local cache | Keep machine-local | Existing | SQLite is rebuildable cache; do not Git sync |
| `~/.pi/agent/pi-hermes-memory/skills/` | Skill directory | Global Skills | Global Skill | Keep under `~/.pi/agent/pi-hermes-memory/skills/` | Existing empty directory | None observed |
| `~/.pi/agent/projects-memory/doc2/skills/` | Legacy central project skills | Workspace Skills candidate | Legacy compatibility | Review before any migration | Existing empty directory | Real migration requires confirmation |
| `~/.pi/memory/INDEX.md` | Legacy Markdown index | Knowledge candidate | Global Knowledge | `~/.pi/knowledge/INDEX.md` if confirmed | Existing legacy path | Do not copy sensitive contents into repo |
| `~/.pi/memory/MEMORY_POLICY.md` | Legacy policy Markdown | Knowledge candidate | Global Knowledge | Reference from `~/.pi/knowledge/INDEX.md` if still active | Existing legacy path | Needs explicit review before use |
| `~/.pi/memory/TEMPLATE.md` | Legacy Markdown template | Knowledge or Skill candidate | Global | Review before classification | Existing legacy path | Unknown semantics without content review |
| `~/.pi/memory/daily-push.md` | Legacy Markdown | Knowledge or Live Context candidate | Global or Workspace unknown | Review before classification | Existing legacy path | Could contain time-sensitive or private data |
| `~/.pi/knowledge/` | Missing directory | Knowledge index root | Global Knowledge | `~/.pi/knowledge/INDEX.md` | Missing | Init command must not overwrite if later created |
| `<repo>/.pi/` | Missing directory | Workspace Overlay root | Workspace | `<workspace-root>/.pi/` | Missing | Init command may create only on explicit request |
| `<repo>/AGENTS.md` | Repo Markdown | Live Context / Knowledge candidate | Workspace | Existing source of truth if active | Existing | Avoid duplicate Knowledge copy |
| `<repo>/README.md` | Repo Markdown | Knowledge candidate | Workspace | Existing source of truth if active | Existing | Avoid duplicate Knowledge copy |
| `<repo>/PLAN.md` | Repo Markdown | Live Context candidate | Workspace | Existing source of truth if active | Existing | May be stale or task-local |
| `<repo>/docs/ROADMAP.md` | Repo Markdown | Knowledge candidate | Workspace | Existing source of truth if active | Existing | Avoid duplicate Knowledge copy |
| `<repo>/docs/PUBLISHING.md` | Repo Markdown | Skill candidate | Workspace Skill or Knowledge | Existing source of truth if active | Existing | Consider Skill only through foreground workflow |

## Notes

- Stage 0 was read-only for real `~/.pi` data.
- No legacy data migration has been performed.
- Any migration from `~/.pi/memory/` or `~/.pi/agent/projects-memory/` must stop for explicit confirmation first.
- Workspace terminology is canonical for new work. Existing `project` paths and APIs are treated as legacy compatibility boundaries.
