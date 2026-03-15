import { cancelScheduledSave } from './listener';
import { restoreWorkspace } from './restore';
import { saveCurrentWindow } from './store';
import {
  readState,
  writeState,
  withWriteLock,
  getActiveWorkspaceName,
} from './toolbox';

// Switch the active workspace for a single window.
// Throws if the target workspace is already open in a different window.
export async function switchWorkspace(
  targetWorkspaceName: string,
  windowId: number
): Promise<void> {
  // --- Step 1: read-only pre-flight checks ---
  const state = await readState();

  if (!state.workspaces[targetWorkspaceName]) {
    throw new Error(`Workspace not found: ${targetWorkspaceName}`);
  }

  const currentName = await getActiveWorkspaceName(windowId);

  // Already the active workspace for this window – nothing to do
  if (currentName === targetWorkspaceName) return;

  const ownerWindowId = state.activeWorkspaces[targetWorkspaceName];
  if (ownerWindowId !== undefined && ownerWindowId !== windowId) {
    throw new Error(
      `Workspace "${targetWorkspaceName}" is already active in another window`
    );
  }

  // --- Step 2: flush the current window's state into its workspace snapshot ---
  // Must happen BEFORE we remap activeWorkspaces so saveCurrentWindow finds
  // the OLD workspace name for this window.
  cancelScheduledSave(windowId);
  await saveCurrentWindow(windowId);

  // --- Step 3: atomically update activeWorkspaces + workspaceOrder ---
  await withWriteLock(async () => {
    const fresh = await readState();

    // Re-check inside the lock: another window may have claimed the target
    const freshOwner = fresh.activeWorkspaces[targetWorkspaceName];
    if (freshOwner !== undefined && freshOwner !== windowId) {
      throw new Error(
        `Workspace "${targetWorkspaceName}" was claimed by another window`
      );
    }

    // Unmap the old workspace for this window
    if (currentName) {
      delete fresh.activeWorkspaces[currentName];
    }
    fresh.activeWorkspaces[targetWorkspaceName] = windowId;

    // Move target to the front of workspaceOrder (most recently opened)
    fresh.workspaceOrder = [
      targetWorkspaceName,
      ...fresh.workspaceOrder.filter(n => n !== targetWorkspaceName),
    ];

    await writeState(fresh);
  });

  // --- Step 4: restore the target workspace's tabs into this window ---
  await restoreWorkspace(windowId, targetWorkspaceName);
}
