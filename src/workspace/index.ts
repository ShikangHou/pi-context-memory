export {
  deriveWorkspaceId,
  findGitRoot,
  findLegacyProjectMarkerRoot,
  findWorkspaceMarkerRoot,
  resolveWorkspace,
  resolveWorkspaceIdentity,
  resolveWorkspaceRoot,
} from "./resolve-workspace.js";
export type {
  WorkspaceInfo,
  WorkspaceResolutionOptions,
  WorkspaceSource,
} from "./resolve-workspace.js";
export { WorkspaceContextProvider } from "./workspace-context-provider.js";
export type { ActiveWorkspaceContext } from "./workspace-context-provider.js";
