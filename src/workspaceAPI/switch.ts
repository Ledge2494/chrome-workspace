import { cancelScheduledSave } from './listener';
import { restoreWorkspace } from './restore';
import { saveCurrentWindow } from './store';
import { readState, setActiveWorkspaceName } from './toolbox';

async function switchWorkspaceSingleWindow(
  targetWorkspaceName: string,
  windowId: number
): Promise<void> {
  // cancel any pending saves in this window to avoid stray writes after switch
  cancelScheduledSave(windowId);

  // save current window into the current active workspace snapshot
  await saveCurrentWindow(windowId);
  // set active workspace name globally
  await setActiveWorkspaceName(targetWorkspaceName);
  // then restore the target workspace into this window
  await restoreWorkspace(windowId, targetWorkspaceName);
}

// Switch workspace: store current session into its active workspace and restore the target one
export async function switchWorkspace(
  targetWorkspaceName: string
): Promise<void> {
  const state = await readState();
  // already active workspace
  if (state.activeWorkspaceName === targetWorkspaceName) return;

  const windows = await new Promise<chrome.windows.Window[]>(resolve =>
    chrome.windows.getAll({}, ws => resolve(ws))
  );

  Promise.all(
    windows.map(async w => {
      if (typeof w.id !== 'number') return;
      try {
        return await switchWorkspaceSingleWindow(targetWorkspaceName, w.id);
      } catch (message) {
        return console.error(message);
      }
    })
  );
}
