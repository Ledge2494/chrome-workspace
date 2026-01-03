import {
  Workspace,
  StoredTab,
  StoredGroup,
  StoredState,
} from './workspaceType';

const STORAGE_KEY = 'workspaces_state_v1';

export async function readState(): Promise<StoredState> {
  return new Promise(resolve => {
    chrome.storage.local.get([STORAGE_KEY], (res: Record<string, unknown>) => {
      const state: StoredState =
        res && res[STORAGE_KEY]
          ? (res[STORAGE_KEY] as StoredState)
          : ({ workspaces: {}, activeWorkspaceName: undefined } as StoredState);
      resolve(state);
    });
  });
}

export async function writeState(state: StoredState): Promise<void> {
  return new Promise(resolve => {
    chrome.storage.local.set({ [STORAGE_KEY]: state }, () => resolve());
  });
}

export async function getActiveWorkspaceName(): Promise<string | undefined> {
  const state = await readState();
  return state.activeWorkspaceName;
}

export async function setActiveWorkspaceName(name: string): Promise<void> {
  const state = await readState();
  state.activeWorkspaceName = name;
  await writeState(state);
}

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
