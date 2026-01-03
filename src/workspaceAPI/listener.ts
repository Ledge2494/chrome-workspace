import { saveCurrentWindow } from './store';
import throttle from 'lodash/throttle';
import { switchWorkspace } from './switch';

// per-window throttled save functions
const throttles = new Map<number, ReturnType<typeof throttle>>();

// when suspended, scheduleSave becomes a no-op; used around restore operations
let suspended = false;

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

// wire listeners (idempotent)
let listenersInstalled = false;
export function installAutoSaveListeners() {
  if (listenersInstalled) return;
  listenersInstalled = true;

  chrome.windows.onCreated.addListener(w => {
    if (typeof w.id === 'number') scheduleSave(w.id);
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
  payload: { workspaceName: string };
};

export type BackgroundResponse = { onGoing: boolean } | { error?: string };

let backgroundListenersInstalled = false;
export function installBackgroundListeners() {
  if (backgroundListenersInstalled) return;
  backgroundListenersInstalled = true;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case BackgroundMessageEnum.SWITCH:
        // on workspace switch, save the current window immediately
        switchWorkspace(message.payload.workspaceName)
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
