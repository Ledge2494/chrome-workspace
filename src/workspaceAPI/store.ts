import { Workspace } from './workspaceType';
import {
  readState,
  writeState,
  captureWindow,
  withWriteLock,
  getActiveWorkspaceName,
} from './toolbox';

// Save current window session into the active workspace for that window
export async function saveCurrentWindow(windowId: number): Promise<Workspace> {
  return withWriteLock(async () => {
    const state = await readState();

    // Find which workspace is currently active for this specific window
    const activeName = await getActiveWorkspaceName(windowId);

    let workspaceName = 'Default';
    let logo = 'fi fi-rr-home';
    let createdAt: number | null = null;

    if (activeName) {
      const existing = state.workspaces[activeName];
      if (existing) {
        workspaceName = existing.name;
        logo = existing.logo;
        createdAt = existing.createdAt;
      }
    }

    // Capture the window's current tabs + groups
    const snapshot = await captureWindow(windowId, workspaceName, logo);

    if (createdAt) {
      snapshot.createdAt = createdAt;
    }

    state.workspaces[snapshot.name] = snapshot;
    await writeState(state);

    return snapshot;
  });
}

export default {
  saveCurrentWindow,
};
