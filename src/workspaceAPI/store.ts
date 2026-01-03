import { Workspace } from './workspaceType';
import { readState, writeState, captureWindow } from './toolbox';

// Save current window session into the active workspace for that window, or create one
export async function saveCurrentWindow(windowId: number): Promise<Workspace> {
  // Read current state
  const state = await readState();
  const activeName = state.activeWorkspaceName;

  // Default workspace config
  let workspaceName = 'Default';
  let logo = 'fi fi-rr-home';
  let createdAt: number | null = null;

  // If an active workspace exists, use its name and logo
  if (activeName) {
    const existing = state.workspaces[activeName];
    workspaceName = existing.name;
    logo = existing.logo;
    createdAt = existing.createdAt;
  } else {
    // No active workspace; set active to default
    state.activeWorkspaceName = workspaceName;
  }

  // Capture current window tabs + groups
  const snapshot = await captureWindow(windowId, workspaceName, logo);

  // Save snapshot into state
  if (createdAt) {
    snapshot.createdAt = createdAt;
  }
  state.workspaces[snapshot.name] = snapshot;
  await writeState(state);

  // Return the updated snapshot
  return snapshot;
}

export default {
  saveCurrentWindow,
};
