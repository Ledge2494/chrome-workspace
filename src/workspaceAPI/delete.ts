import { readState, writeState, withWriteLock } from './toolbox';

export async function deleteWorkspace(name: string): Promise<boolean> {
  return withWriteLock(async () => {
    const state = await readState();

    if (!state.workspaces?.[name]) return false;

    // Can't delete a workspace that is currently open in any window
    if (name in state.activeWorkspaces) return false;

    delete state.workspaces[name];
    state.workspaceOrder = state.workspaceOrder.filter(n => n !== name);

    await writeState(state);
    return true;
  });
}

export default { deleteWorkspace };
