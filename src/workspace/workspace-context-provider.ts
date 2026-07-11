import * as path from "node:path";
import { detectProject, type ProjectInfo } from "../project.js";
import { MemoryStore } from "../store/memory-store.js";
import type { MemoryConfig } from "../types.js";
import { resolveWorkspace } from "./resolve-workspace.js";
import { migrateWorkspaceLayout } from "./workspace-layout-migration.js";

export interface ActiveWorkspaceContext {
  id: string;
  displayName: string;
  rootDir: string | null;
  memoryDir: string;
  skillsDir: string;
  store: MemoryStore;
}

type StoreFactory = (config: MemoryConfig, project: ProjectInfo) => MemoryStore;

/** Resolves and caches the active Workspace from Pi-provided cwd values. */
export class WorkspaceContextProvider {
  private readonly contexts = new Map<string, Promise<ActiveWorkspaceContext>>();
  private active: ActiveWorkspaceContext | null = null;

  constructor(
    private readonly config: MemoryConfig,
    private readonly createStore: StoreFactory = (storeConfig) => new MemoryStore(storeConfig),
  ) {}

  seed(project: ProjectInfo, store: MemoryStore): void {
    const context = this.toContext(project, store);
    if (!context) return;
    this.contexts.set(context.id, Promise.resolve(context));
    this.active = context;
  }

  async refresh(cwd?: string): Promise<ActiveWorkspaceContext | null> {
    if (this.config.projectMemoryMode !== "central") {
      const workspace = resolveWorkspace({ cwd });
      if (workspace) {
        try { migrateWorkspaceLayout(workspace.rootDir, this.config.projectMemoryDirName); } catch { /* context remains usable */ }
      }
    }
    const project = detectProject(this.config, cwd);
    if (!project.memoryDir || !project.workspaceId || !project.name) {
      this.active = null;
      return null;
    }

    let pending = this.contexts.get(project.workspaceId);
    if (!pending) {
      pending = this.createContext(project);
      this.contexts.set(project.workspaceId, pending);
    }

    try {
      const context = await pending;
      this.active = context;
      return context;
    } catch (error) {
      this.contexts.delete(project.workspaceId);
      throw error;
    }
  }

  getActive(): ActiveWorkspaceContext | null {
    return this.active;
  }

  private async createContext(project: ProjectInfo): Promise<ActiveWorkspaceContext> {
    const store = this.createStore({
      ...this.config,
      memoryCharLimit: this.config.projectCharLimit,
      memoryDir: project.memoryDir!,
    }, project);
    await store.loadFromDisk();
    return this.toContext(project, store)!;
  }

  private toContext(project: ProjectInfo, store: MemoryStore): ActiveWorkspaceContext | null {
    if (!project.memoryDir || !project.workspaceId || !project.name) return null;
    return {
      id: project.workspaceId,
      displayName: project.name,
      rootDir: project.rootDir,
      memoryDir: project.memoryDir,
      skillsDir: path.join(project.memoryDir, "skills"),
      store,
    };
  }
}
