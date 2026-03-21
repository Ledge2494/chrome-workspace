import debounce from 'lodash/debounce';
import { WorkspaceService } from './WorkspaceService';

export const enum BackgroundMessageEnum {
  SWITCH,
}

export type BackgroundMessage = {
  type: BackgroundMessageEnum.SWITCH;
  // windowId: the window the popup belongs to (where the switch should happen)
  payload: { workspaceName: string; windowId: number };
};

export type BackgroundResponse = { onGoing: boolean } | { error?: string };

export class WorkspaceListener {
  private readonly service: WorkspaceService;

  private readonly saveMap = new Map<number, ReturnType<typeof debounce>>();
  private autoSaveInstalled = false;
  private backgroundInstalled = false;
  private sessionInstalled = false;
  private suspended = false;
  private restoringAfterRestart = false;

  constructor(service: WorkspaceService) {
    this.service = service;
  }

  installAutoSaveListeners(): void {
    if (this.autoSaveInstalled) return;
    this.autoSaveInstalled = true;

    chrome.windows.onCreated.addListener(window => {
      if (typeof window.id !== 'number') return;
      if (window.type !== 'normal') return;
      this.handleNewWindow(window.id).catch(console.error);
    });

    chrome.windows.onRemoved.addListener(windowId => {
      this.handleEndWindow(windowId).catch(console.error);
    });

    chrome.tabs.onCreated.addListener(tab => {
      this.scheduleSave(tab.windowId);
    });

    chrome.tabs.onRemoved.addListener((_tabId, info) => {
      this.scheduleSave(info.windowId);
    });

    chrome.tabs.onUpdated.addListener((_tabId, _changeInfo, tab) => {
      this.scheduleSave(tab.windowId);
    });

    chrome.tabs.onMoved.addListener((_tabId, moveInfo) => {
      this.scheduleSave(moveInfo.windowId);
    });

    chrome.tabs.onAttached.addListener((_tabId, attachInfo) => {
      this.scheduleSave(attachInfo.newWindowId);
    });

    chrome.tabs.onDetached.addListener((_tabId, detachInfo) => {
      this.scheduleSave(detachInfo.oldWindowId);
    });

    chrome.tabGroups.onCreated.addListener(group => {
      this.scheduleSave(group.windowId);
    });

    chrome.tabGroups.onUpdated.addListener(group => {
      this.scheduleSave(group.windowId);
    });

    chrome.tabGroups.onRemoved.addListener(group => {
      this.scheduleSave(group.windowId);
    });

    chrome.tabGroups.onMoved.addListener(group => {
      this.scheduleSave(group.windowId);
    });
  }

  installBackgroundListeners(
    handler: (payload: {
      workspaceName: string;
      windowId: number;
    }) => Promise<void>
  ): void {
    if (this.backgroundInstalled) return;
    this.backgroundInstalled = true;

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type !== 0) return;

      handler(message.payload)
        .catch(console.error)
        .then(() => sendResponse({ onGoing: false }));

      return true;
    });
  }

  installSessionListeners(handler: () => Promise<void>): void {
    if (this.sessionInstalled) return;
    this.sessionInstalled = true;

    handler().catch(console.error);
  }

  suspendAutoSave(): void {
    this.suspended = true;
    for (const [, debounceFn] of this.saveMap) {
      debounceFn.cancel();
    }
    this.saveMap.clear();
  }

  resumeAutoSave(): void {
    this.suspended = false;
  }

  cancelScheduledSave(windowId: number): void {
    const pending = this.saveMap.get(windowId);
    if (!pending) return;

    pending.cancel();
    this.saveMap.delete(windowId);
  }

  setRestoringAfterRestart(value: boolean): void {
    this.restoringAfterRestart = value;
  }

  clearRestoringAfterRestart(): void {
    this.restoringAfterRestart = false;
  }

  async detectSessionRestart(): Promise<boolean> {
    return this.service.isSessionRestart();
  }

  async handleSessionStart(): Promise<void> {
    this.setRestoringAfterRestart(true);
    this.suspendAutoSave();
    try {
      await this.service.restoreAllWorkspacesAfterRestart();
    } finally {
      this.resumeAutoSave();
      this.clearRestoringAfterRestart();
    }
  }

  private scheduleSave(windowId: number): void {
    if (this.suspended) return;

    let save = this.saveMap.get(windowId);
    if (!save) {
      save = debounce(() => {
        if (this.suspended) return;
        this.service.saveCurrentWindow(windowId).catch(console.error);
      }, 500);
      this.saveMap.set(windowId, save);
    }

    save();
  }

  private async handleNewWindow(windowId: number): Promise<void> {
    if (this.restoringAfterRestart) {
      return;
    }

    const workspaceName =
      await this.service.assignWorkspaceToNewWindow(windowId);
    this.cancelScheduledSave(windowId);
    await this.service.restoreWorkspace(windowId, workspaceName);
  }

  private async handleEndWindow(windowId: number): Promise<void> {
    await this.service.clearActiveWorkspaceForWindow(windowId);
  }
}
