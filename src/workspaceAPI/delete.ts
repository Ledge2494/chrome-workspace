import { readState, writeState } from './toolbox';

export async function deleteWorkspace(name: string): Promise<boolean> {
  const state = await readState();
  // Workspace doesn't exist
  if (!state.workspaces || !state.workspaces[name]) return false;
  // Can't delete active workspace
  if (state.activeWorkspaceName === name) return false;

  delete state.workspaces[name];

  await writeState(state);
  return true;
}

export default { deleteWorkspace };
