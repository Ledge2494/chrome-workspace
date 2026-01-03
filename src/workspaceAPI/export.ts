import { readState } from './toolbox';

export async function exportSingleWorkspace(
  workspaceName: string
): Promise<string> {
  const state = await readState();
  const workspace = state.workspaces[workspaceName];
  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceName}`);
  }
  return JSON.stringify(
    { workspaces: { [workspaceName]: workspace } },
    null,
    2
  );
}

export async function exportMultipleWorkspaces(
  workspaceNames: string[]
): Promise<string> {
  const state = await readState();
  const workspaces: Record<string, (typeof state.workspaces)[string]> = {};
  for (const name of workspaceNames) {
    const workspace = state.workspaces[name];
    if (workspace) {
      workspaces[name] = workspace;
    }
  }
  return JSON.stringify({ workspaces }, null, 2);
}

export async function exportAll(): Promise<string> {
  const state = await readState();
  return JSON.stringify(state, null, 2);
}
