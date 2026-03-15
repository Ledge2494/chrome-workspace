import { saveCurrentWindow } from './store';
import throttle from 'lodash/throttle';
import { switchWorkspace } from './switch';
import { restoreWorkspace } from './restore';
import {
  readState,
  writeState,
  withWriteLock,
  clearActiveWorkspaceForWindow,
  buildBlankWorkspace,
} from './toolbox';

// per-window throttled save functions
const throttles = new Map<number, ReturnType<typeof throttle>>();

// when suspended, scheduleSave becomes a no-op; used around restore operations
let suspended = false;

// when true, window creation is being driven by bulk restoration after session restart
// (prevents handleNewWindow from reassigning workspaces)
let restoringAfterRestart = false;

export function setRestoringAfterRestart(value: boolean) {
  restoringAfterRestart = value;
}

export function clearRestoringAfterRestart() {
  restoringAfterRestart = false;
}

function scheduleSave(windowId: number) {
  if (suspended) return;

  let t = throttles.get(windowId);
  if (!t) {
    // create a throttled wrapper that will call saveCurrentWindow for this window
    const fn = () => {
      // guard again in case suspended changed between scheduling and execution
      if (suspended) return;
      saveCurrentWindow(windowId).catch(console.error);
    };

    // throttle so saves happen at most once per 100ms; use trailing call so we get
    // a final save after rapid events
    t = throttle(fn, 100, { leading: false, trailing: true });
    throttles.set(windowId, t);
  }

  // call the throttled function (it will schedule/execute according to throttle rules)
  t();
}

// cancel a pending scheduled save for a window
export function cancelScheduledSave(windowId: number) {
  const t = throttles.get(windowId);
  if (t) {
    // cancel any pending trailing invocation
    t.cancel();
    throttles.delete(windowId);
  }
}

export function suspendAutoSave() {
  suspended = true;
  // cancel any pending throttled saves so they don't run while suspended
  for (const [winId, t] of throttles) {
    try {
      t.cancel();
    } catch (e) {
      // ignore cancel errors
    }
    throttles.delete(winId);
  }
}

export function resumeAutoSave() {
  suspended = false;
}

// Assign a workspace to a newly opened window, then restore it.
// Picks the first unassigned workspace from workspaceOrder, or creates one.
// (Skipped during session restart restoration, as the workspace is already assigned)
async function handleNewWindow(windowId: number): Promise<void> {
  // During bulk restoration after session restart, workspace assignment is handled by
  // restoreAllWorkspacesAfterRestart(), so we skip processing here
  if (restoringAfterRestart) {
    console.debug(
      `Skipping handleNewWindow for ${windowId} (restoring after restart)`
    );
    return;
  }

  let assignedWorkspaceName: string | null = null;

  await withWriteLock(async () => {
    const state = await readState();

    // Find the first workspace in workspaceOrder not currently active anywhere
    const available = state.workspaceOrder.find(
      name => !(name in state.activeWorkspaces)
    );

    if (available) {
      assignedWorkspaceName = available;
      state.activeWorkspaces[available] = windowId;
    } else {
      // All workspaces are taken – create a fresh one for this window
      const wk = buildBlankWorkspace(`Workspace ${Date.now()}`);
      state.workspaces[wk.name] = wk;
      state.workspaceOrder.push(wk.name);
      state.activeWorkspaces[wk.name] = windowId;
      assignedWorkspaceName = wk.name;
    }

    await writeState(state);
  });

  if (!assignedWorkspaceName) return;

  // Cancel any stray save that may have queued before the assignment completed
  cancelScheduledSave(windowId);

  // Restore the assigned workspace's tabs into the new window
  await restoreWorkspace(windowId, assignedWorkspaceName);
}

// wire listeners (idempotent)
let listenersInstalled = false;
export function installAutoSaveListeners() {
  if (listenersInstalled) return;
  listenersInstalled = true;

  // Assign a workspace to each new normal window and restore it
  chrome.windows.onCreated.addListener(w => {
    if (typeof w.id !== 'number') return;
    if (w.type !== 'normal') return;
    handleNewWindow(w.id).catch(console.error);
  });

  // When a window closes, free its workspace so it can be reused
  chrome.windows.onRemoved.addListener(windowId => {
    clearActiveWorkspaceForWindow(windowId).catch(console.error);
  });

  chrome.tabs.onCreated.addListener(tab => {
    scheduleSave(tab.windowId);
  });
  chrome.tabs.onRemoved.addListener((tabId, info) => {
    scheduleSave(info.windowId);
  });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    scheduleSave(tab.windowId);
  });
  chrome.tabs.onMoved.addListener((tabId, moveInfo) => {
    scheduleSave(moveInfo.windowId);
  });
  chrome.tabs.onAttached.addListener((tabId, attachInfo) => {
    scheduleSave(attachInfo.newWindowId);
  });
  chrome.tabs.onDetached.addListener((tabId, detachInfo) => {
    scheduleSave(detachInfo.oldWindowId);
  });

  chrome.tabGroups.onCreated.addListener(g => {
    scheduleSave(g.windowId);
  });
  chrome.tabGroups.onUpdated.addListener(g => {
    scheduleSave(g.windowId);
  });
  chrome.tabGroups.onRemoved.addListener(g => {
    scheduleSave(g.windowId);
  });
}

export const enum BackgroundMessageEnum {
  SWITCH,
}

export type BackgroundMessage = {
  type: BackgroundMessageEnum.SWITCH;
  // windowId: the window the popup belongs to (where the switch should happen)
  payload: { workspaceName: string; windowId: number };
};

export type BackgroundResponse = { onGoing: boolean } | { error?: string };

let backgroundListenersInstalled = false;
export function installBackgroundListeners() {
  if (backgroundListenersInstalled) return;
  backgroundListenersInstalled = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    switch (message.type) {
      case BackgroundMessageEnum.SWITCH:
        switchWorkspace(message.payload.workspaceName, message.payload.windowId)
          .catch(console.error)
          .then(() => {
            sendResponse({ onGoing: false });
          });
        return true; // indicate async response
      default:
        return; // unhandled message
    }
  });
}

export default { installAutoSaveListeners, cancelScheduledSave };
