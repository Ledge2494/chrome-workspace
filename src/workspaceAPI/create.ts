import { listWorkspaces } from './list';
import { saveCurrentWindow } from './store';
import { readState, writeState } from './toolbox';
import { StoredTab, Workspace } from './workspaceType';

export async function createWorkspace(
  name: string,
  logo: string
): Promise<Workspace> {
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
  // if there's no active workspace, set this as active
  if (!state.activeWorkspaceName) state.activeWorkspaceName = name;
  await writeState(state);
  return wk;
}

export async function createDefaultWorkspace() {
  // Logic to create a default workspace
  const workspaceList = await listWorkspaces();

  if (workspaceList.length > 0) {
    return;
  }

  const windows = chrome.windows;
  if (!windows) {
    return;
  }

  const currentWindow = await windows.getCurrent();
  if (!currentWindow?.id) {
    return;
  }

  await saveCurrentWindow(currentWindow.id);
}

export default { createWorkspace };
