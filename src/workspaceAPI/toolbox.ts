import {
  Workspace,
  StoredTab,
  StoredGroup,
  StoredState,
} from './workspaceType';
import packageJson from '../../package.json';
import { Mutex } from 'async-mutex';

const STORAGE_KEY = 'workspaces_state_v1';
const writeMutex = new Mutex();

export async function readState(): Promise<StoredState> {
  return new Promise(resolve => {
    chrome.storage.local.get([STORAGE_KEY], (res: Record<string, unknown>) => {
      const state: StoredState =
        res && res[STORAGE_KEY]
          ? (res[STORAGE_KEY] as StoredState)
          : ({
              version: packageJson.version,
              workspaces: {},
              activeWorkspaces: {},
              activeWorkspacesReverse: {},
              workspaceOrder: [],
            } as StoredState);
      resolve(state);
    });
  });
}

export async function writeState(state: StoredState): Promise<void> {
  console.debug('Writing state to storage', state);
  return chrome.storage.local.set({ [STORAGE_KEY]: state });
}

// Run an exclusive read-modify-write operation, serialising concurrent callers
export async function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  return writeMutex.runExclusive(fn);
}

// --- Per-window active workspace helpers ---

// Get the workspace name active in a given window (undefined if none)
export async function getActiveWorkspaceName(
  windowId: number
): Promise<string | undefined> {
  const state = await readState();
  return Object.keys(state.activeWorkspaces).find(
    name => state.activeWorkspaces[name] === windowId
  );
}

// Get the workspace name active in the current window (popup-friendly)
export async function getCurrentActiveWorkspaceName(): Promise<
  string | undefined
> {
  const currentWindow = await new Promise<chrome.windows.Window>(resolve =>
    chrome.windows.getCurrent(w => resolve(w))
  );
  if (typeof currentWindow.id !== 'number') return undefined;
  return getActiveWorkspaceName(currentWindow.id);
}

// Mark a workspace as the active one for a specific window
export async function setActiveWorkspace(
  name: string,
  windowId: number
): Promise<void> {
  return withWriteLock(async () => {
    const state = await readState();
    // Remove any prior mapping for this window first
    for (const [n, winId] of Object.entries(state.activeWorkspaces)) {
      if (winId === windowId) {
        delete state.activeWorkspaces[n];
        break;
      }
    }
    state.activeWorkspaces[name] = windowId;
    await writeState(state);
  });
}

// Remove the active-workspace mapping for a window (e.g. on window close)
export async function clearActiveWorkspaceForWindow(
  windowId: number
): Promise<void> {
  return withWriteLock(async () => {
    const state = await readState();
    for (const [name, winId] of Object.entries(state.activeWorkspaces)) {
      if (winId === windowId) {
        delete state.activeWorkspaces[name];
        break;
      }
    }
    await writeState(state);
  });
}

// Return true when the workspace is currently open in any window
export async function isWorkspaceActive(name: string): Promise<boolean> {
  const state = await readState();
  return name in state.activeWorkspaces;
}

// Return the window ID that currently has this workspace active, or undefined
export async function getWindowIdForWorkspace(
  name: string
): Promise<number | undefined> {
  const state = await readState();
  return state.activeWorkspaces[name];
}

// Return all active workspaces mapping (workspace name -> window ID)
export async function getActiveWorkspaces(): Promise<Record<string, number>> {
  const state = await readState();
  return state.activeWorkspaces;
}

// --- Window capture ---

// Capture current window tabs + groups into a Workspace object
export async function captureWindow(
  windowId: number,
  name: string,
  logo: string
): Promise<Workspace> {
  // query tabs
  const tabs = await new Promise<chrome.tabs.Tab[]>(resolve =>
    chrome.tabs.query({ windowId }, t => resolve(t))
  );
  // query groups
  const groups = await new Promise<chrome.tabGroups.TabGroup[]>(resolve =>
    chrome.tabGroups.query({ windowId }, g => resolve(g))
  );

  // build groups array and map chrome group id -> group index
  const groupMap = new Map<number, number>();
  const storedGroups: StoredGroup[] = [];
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    groupMap.set(g.id as number, i);
    storedGroups.push({
      title: g.title || null,
      color: g.color || null,
      collapsed: !!g.collapsed,
    });
  }

  const storedTabs: StoredTab[] = tabs.map(t => ({
    url: t.url,
    title: t.title || '',
    pinned: !!t.pinned,
    active: !!t.active,
    index: t.index,
    favIconUrl: t.favIconUrl,
    discarded: !!t.discarded,
    groupIndex:
      typeof t.groupId === 'number' && groupMap.has(t.groupId as number)
        ? groupMap.get(t.groupId as number)!
        : null,
  }));

  const wk: Workspace = {
    logo: logo || 'fi fi-rr-home',
    name: name || `Default`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tabs: storedTabs,
    groups: storedGroups,
  };

  return wk;
}

// Create a blank workspace entry without assigning it to any window
export function buildBlankWorkspace(name: string): Workspace {
  const defaultTab: StoredTab = {
    url: 'chrome://newtab/',
    title: 'New Tab',
    active: true,
    index: 0,
    pinned: false,
  };
  return {
    name,
    logo: 'fi fi-rr-home',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tabs: [defaultTab],
    groups: [],
  };
}
