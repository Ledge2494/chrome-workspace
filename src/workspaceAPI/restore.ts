import { readState, writeState, withWriteLock } from './toolbox';
import {
  suspendAutoSave,
  resumeAutoSave,
  setRestoringAfterRestart,
  clearRestoringAfterRestart,
} from './listener';
import { StoredTab } from './workspaceType';

// Check if a session restart has occurred by comparing stored window IDs with actual windows.
// Returns true if any stored window IDs no longer exist in the current browser.
export async function isSessionRestart(): Promise<boolean> {
  const state = await readState();
  const storedWindowIds = Object.values(state.activeWorkspaces);

  if (storedWindowIds.length === 0) {
    // No active workspaces stored, not a restart scenario
    return false;
  }

  // Get all currently open windows
  const currentWindows = await new Promise<chrome.windows.Window[]>(resolve =>
    chrome.windows.getAll(w => resolve(w))
  );

  const currentWindowIds = new Set(
    currentWindows
      .filter(w => w.type === 'normal' && typeof w.id === 'number')
      .map(w => w.id as number)
  );

  // If any stored window ID doesn't exist in current windows, it's a restart
  return storedWindowIds.some(id => !currentWindowIds.has(id));
}

// Restore all workspaces after a browser restart.
// Adjusts the number of windows to match the number of previously active workspaces,
// then restores their content in order.
export async function restoreAllWorkspacesAfterRestart(): Promise<void> {
  console.log('Detected session restart, beginning workspace restoration...');

  setRestoringAfterRestart(true);
  try {
    // Suspend auto-save during the entire restoration process
    suspendAutoSave();

    // Save the workspace names that were active before clearing
    let activeWorkspaceNames: string[] = [];
    await withWriteLock(async () => {
      const state = await readState();
      activeWorkspaceNames = Object.keys(state.activeWorkspaces);
      state.activeWorkspaces = {};
      await writeState(state);
    });

    // Get all current normal windows
    const allWindows = await chrome.windows.getAll();
    const normalWindows = allWindows.filter(w => w.type === 'normal');
    const normalWindowIds = normalWindows
      .filter(w => typeof w.id === 'number')
      .map(w => w.id as number);

    const neededWindowCount = activeWorkspaceNames.length;
    const currentWindowCount = normalWindowIds.length;

    // Close excess windows if we have more than needed
    if (currentWindowCount > neededWindowCount) {
      const windowsToClose = normalWindowIds.slice(neededWindowCount);
      for (const windowId of windowsToClose) {
        try {
          await new Promise<void>(resolve => {
            chrome.windows.remove(windowId, () => resolve());
          });
          console.debug(`Closed excess window ${windowId}`);
        } catch (e) {
          console.warn('Failed to close window:', e);
        }
      }
    }

    // Create new windows if we need more
    const windowsToUse: number[] = normalWindowIds.slice(0, neededWindowCount);
    while (windowsToUse.length < neededWindowCount) {
      try {
        const newWindow = await chrome.windows.create();
        if (newWindow && typeof newWindow.id === 'number') {
          windowsToUse.push(newWindow.id);
          console.debug(`Created new window ${newWindow.id}`);
        }
      } catch (e) {
        console.error('Failed to create window:', e);
      }
    }

    // Read fresh state after window adjustments
    const state = await readState();

    // Restore each workspace into its corresponding window
    for (let i = 0; i < activeWorkspaceNames.length; i++) {
      const workspaceName = activeWorkspaceNames[i];
      const windowId = windowsToUse[i];

      const ws = state.workspaces[workspaceName];
      if (!ws) {
        console.warn(`Workspace not found: ${workspaceName}`);
        continue;
      }

      // Assign workspace to the window
      await withWriteLock(async () => {
        const latestState = await readState();
        latestState.activeWorkspaces[workspaceName] = windowId;
        await writeState(latestState);
      });

      // Restore the workspace's tabs and groups into the window
      try {
        await restoreWorkspace(windowId, workspaceName);
        console.log(
          `Restored workspace "${workspaceName}" to window ${windowId}`
        );
      } catch (e) {
        console.error(`Failed to restore workspace "${workspaceName}":`, e);
      }
    }

    console.log('Workspace restoration completed');
  } catch (e) {
    console.error('Error during workspace restoration:', e);
  } finally {
    resumeAutoSave();
    clearRestoringAfterRestart();
  }
}

// Restore a workspace into the given window. We create the saved tabs first
// so the window stays alive, then remove the original tabs that existed
// before the restore. Auto-save is suspended during the whole operation.
export async function restoreWorkspace(
  windowId: number,
  workspaceName: string
): Promise<void> {
  const state = await readState();
  const ws = state.workspaces[workspaceName];
  if (!ws) throw new Error(`workspace not found: ${workspaceName}`);

  suspendAutoSave();
  try {
    // snapshot current tabs so we can remove them after creating the restored ones
    const currentTabs = await chrome.tabs.query({ windowId });
    const currentIds = currentTabs
      .map(t => t.id)
      .filter((id): id is number => typeof id === 'number');

    // create tabs in order (these will keep the window alive while we cleanup old tabs)
    const createdTabIds: number[] = [];
    for (let i = 0; i < ws.tabs.length; i++) {
      const t = ws.tabs[i];
      const created = await chrome.tabs.create({
        windowId,
        url: t.url || 'chrome://newtab',
        active: t.active,
        pinned: t.pinned,
        index: i,
      });
      if (created && typeof created.id === 'number') {
        createdTabIds.push(created.id);
      }
    }

    // recreate groups using groupIndex stored on tabs
    const groupIndexToTabIds = new Map<number, number[]>();
    ws.tabs.forEach((t: StoredTab, idx: number) => {
      if (typeof t.groupIndex === 'number') {
        const ids = groupIndexToTabIds.get(t.groupIndex) || [];
        const createdTabId = createdTabIds[idx];
        if (typeof createdTabId === 'number') ids.push(createdTabId);
        groupIndexToTabIds.set(t.groupIndex, ids);
      }
    });

    for (const [groupIndex, tabIds] of groupIndexToTabIds) {
      if (!tabIds.length) continue;
      try {
        const groupId = await chrome.tabs.group({ tabIds });
        const storedGroup = ws.groups[groupIndex];
        if (storedGroup) {
          chrome.tabGroups.update(groupId, {
            title: storedGroup.title || '',
            color: storedGroup.color || undefined,
            collapsed: !!storedGroup.collapsed,
          });
        }
      } catch (e) {
        // ignore grouping failures
      }
    }

    // after groups and new tabs are created, remove the old tabs that existed before the restore
    const leftover = currentIds.filter(id => !createdTabIds.includes(id));
    if (leftover.length > 0) {
      try {
        chrome.tabs.remove(leftover);
      } catch (e) {
        // ignore
      }
    }
    // eslint-disable-next-line no-useless-catch
  } catch (e) {
    throw e;
  } finally {
    // resume listeners after finishing restore
    resumeAutoSave();
  }
}

export default { restoreWorkspace };
