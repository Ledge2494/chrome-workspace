import { readState, writeState, withWriteLock } from './toolbox';
import { StoredTab, Workspace } from './workspaceType';

export async function createWorkspace(
  name: string,
  logo: string
): Promise<Workspace> {
  return withWriteLock(async () => {
    const state = await readState();
    if (!state.workspaces) state.workspaces = {};
    if (state.workspaces[name]) {
      throw new Error(`Workspace already exists: ${name}`);
    }
    const defaultTab: StoredTab = {
      url: 'chrome://newtab/',
      title: 'New Tab',
      active: true,
      index: 0,
      pinned: false,
    };
    const wk: Workspace = {
      name,
      logo,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tabs: [defaultTab],
      groups: [],
    };
    state.workspaces[name] = wk;
    // Append to workspaceOrder (creation order: oldest first)
    if (!state.workspaceOrder.includes(name)) {
      state.workspaceOrder.push(name);
    }
    await writeState(state);
    return wk;
  });
}

export default { createWorkspace };
