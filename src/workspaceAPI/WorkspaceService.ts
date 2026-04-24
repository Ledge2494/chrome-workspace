import packageJson from '../../package.json';
import { StoredState, StoredTab } from './workspaceType';
import { WorkspaceBuilder } from './WorkspaceBuilder';
import { WorkspaceItem } from './WorkspaceItem';
import { WorkspaceStore } from './WorkspaceStore';

type ListOrderType = 'createdAt-asc' | 'updatedAt-desc' | 'workspaceOrder';

type ListOptions = {
  orderType?: ListOrderType;
} & (
  | { activeOnly?: false; availableOnly?: false }
  | { activeOnly: true; availableOnly?: never }
  | { activeOnly?: never; availableOnly: true }
);

export class WorkspaceService {
  private initialized = false;
  public id = Math.random().toString(16).slice(2, 10);

  private readonly store: WorkspaceStore;
  private readonly builder: WorkspaceBuilder;

  private workspaceMap: Record<string, WorkspaceItem> = {};
  private workspaceOrder: string[] = [];
  private workspaceActiveMap: Record<string, number> = {};
  private workspaceActiveReverseMap: Record<number, string> = {};
  private version = packageJson.version;

  constructor(store: WorkspaceStore, builder: WorkspaceBuilder) {
    this.store = store;
    this.builder = builder;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.store.LoadFromStorage();
    this.workspaceMap = { ...this.store.workspaceMap };
    this.workspaceOrder = [...this.store.workspaceOrder];
    this.workspaceActiveMap = { ...this.store.workspaceActive };
    this.version = this.store.version || packageJson.version;

    this.rebuildActiveReverseMap();

    const missing = Object.keys(this.workspaceMap).filter(
      name => !this.workspaceOrder.includes(name)
    );
    if (missing.length > 0) {
      this.workspaceOrder.push(...missing);
      await this.persist();
    }

    this.initialized = false;
  }

  async createWorkspace(name: string, logo?: string): Promise<WorkspaceItem> {
    await this.initialize();

    if (!WorkspaceItem.validateName(name)) {
      throw new Error('Workspace name is invalid');
    }
    if (this.workspaceMap[name]) {
      throw new Error(`Workspace already exists: ${name}`);
    }

    this.builder.reset();
    const workspace = this.builder
      .buildBlankWorkspace(name, logo || WorkspaceItem.generateDefaultLogo())
      .getWorkspace();

    this.workspaceMap[workspace.name] = workspace;
    if (!this.workspaceOrder.includes(workspace.name)) {
      this.workspaceOrder.push(workspace.name);
    }

    await this.persist();

    console.log('Self Instance', this);

    return workspace;
  }

  async retrieveWorkspace(
    name: string,
    opt?: { createIfMissing?: boolean; logo?: string }
  ): Promise<WorkspaceItem | null> {
    await this.initialize();

    const workspace = this.workspaceMap[name];
    if (workspace) return workspace;

    if (opt?.createIfMissing) {
      return this.createWorkspace(name, opt.logo);
    }

    return null;
  }

  async listWorkspaces(options: ListOptions = {}): Promise<WorkspaceItem[]> {
    await this.initialize();

    const {
      orderType = 'createdAt-asc',
      activeOnly = false,
      availableOnly = false,
    } = options;

    let workspaces = Object.entries(this.workspaceMap);

    if (activeOnly) {
      workspaces = workspaces.filter(
        ([name]) => name in this.workspaceActiveMap
      );
    }

    if (availableOnly) {
      workspaces = workspaces.filter(
        ([name]) => !(name in this.workspaceActiveMap)
      );
    }

    switch (orderType) {
      case 'workspaceOrder':
        workspaces.sort((a, b) => {
          const indexA = this.workspaceOrder.indexOf(a[0]);
          const indexB = this.workspaceOrder.indexOf(b[0]);
          return indexA - indexB;
        });
        break;
      case 'updatedAt-desc':
        workspaces.sort((a, b) => b[1].updatedAt - a[1].updatedAt);
        break;
      case 'createdAt-asc':
      default:
        workspaces.sort((a, b) => a[1].createdAt - b[1].createdAt);
        break;
    }

    return workspaces.map(([_, workspace]) => workspace);
  }

  async deleteWorkspace(name: string): Promise<boolean> {
    await this.initialize();

    if (!this.workspaceMap[name]) return false;
    if (name in this.workspaceActiveMap) return false;

    delete this.workspaceMap[name];
    this.workspaceOrder = this.workspaceOrder.filter(item => item !== name);

    await this.persist();
    return true;
  }

  async switchWorkspace(
    targetName: string,
    windowId: number
  ): Promise<boolean> {
    await this.initialize();

    console.log('Self Instance', this);
    console.log(`Workspace list`, Object.keys(this.workspaceMap));

    if (!this.workspaceMap[targetName]) {
      throw new Error(`Workspace not found: ${targetName}`);
    }

    const currentName = this.workspaceActiveReverseMap[windowId];
    if (currentName === targetName) return true;

    const ownerWindowId = this.workspaceActiveMap[targetName];
    if (ownerWindowId !== undefined && ownerWindowId !== windowId) {
      throw new Error(
        `Workspace "${targetName}" is already active in another window`
      );
    }

    await this.saveCurrentWindow(windowId);

    if (currentName) {
      delete this.workspaceActiveMap[currentName];
      this.workspaceMap[currentName].setActive(null);
    }

    this.workspaceActiveMap[targetName] = windowId;
    this.workspaceMap[targetName].setActive(windowId);

    this.workspaceOrder = [
      targetName,
      ...this.workspaceOrder.filter(name => name !== targetName),
    ];

    this.rebuildActiveReverseMap();
    await this.persist();
    await this.restoreWorkspace(windowId, targetName);

    return true;
  }

  async saveCurrentWindow(windowId: number): Promise<WorkspaceItem | null> {
    await this.initialize();

    const activeName = this.workspaceActiveReverseMap[windowId];

    if (!activeName || !this.workspaceMap[activeName]) {
      return null;
    }

    const workspace = this.workspaceMap[activeName];
    await workspace.captureWindowSnapshot(windowId);

    if (workspace.tabs.length === 0) {
      workspace.tabs.push(this.defaultTab());
    }

    await this.persist();
    return workspace;
  }

  async restoreWorkspace(
    windowId: number,
    workspaceName: string,
    options?: { skipGroups?: boolean }
  ): Promise<void> {
    await this.initialize();

    const workspace = this.workspaceMap[workspaceName];
    if (!workspace) {
      throw new Error(`workspace not found: ${workspaceName}`);
    }

    const currentTabs = await chrome.tabs.query({ windowId });
    const currentIds = currentTabs
      .map(tab => tab.id)
      .filter((id): id is number => typeof id === 'number');

    const createdTabIds: number[] = [];
    for (let i = 0; i < workspace.tabs.length; i += 1) {
      const tab = workspace.tabs[i];
      if (options?.skipGroups && !tab.groupIndex) continue;
      const created = await chrome.tabs.create({
        windowId,
        url: tab.url || 'chrome://newtab',
        active: tab.active,
        pinned: tab.pinned,
        index: i,
      });

      if (typeof created.id === 'number') {
        createdTabIds.push(created.id);
      }
    }

    if (!options?.skipGroups) {
      const groupIndexToTabIds = new Map<number, number[]>();
      workspace.tabs.forEach((tab, index) => {
        if (typeof tab.groupIndex !== 'number') return;
        const ids = groupIndexToTabIds.get(tab.groupIndex) || [];
        const createdTabId = createdTabIds[index];
        if (typeof createdTabId === 'number') {
          ids.push(createdTabId);
        }
        groupIndexToTabIds.set(tab.groupIndex, ids);
      });

      for (const [groupIndex, tabIds] of groupIndexToTabIds) {
        if (!tabIds.length) continue;
        try {
          const groupId = await chrome.tabs.group({ tabIds });
          const group = workspace.groups[groupIndex];
          if (group) {
            await chrome.tabGroups.update(groupId, {
              title: group.title || '',
              color: group.color || undefined,
              collapsed: !!group.collapsed,
            });
          }
        } catch {
          // Ignore grouping failures for partial compatibility across browsers.
        }
      }
    }

    const leftover = currentIds.filter(id => !createdTabIds.includes(id));
    if (leftover.length > 0) {
      try {
        await chrome.tabs.remove(leftover);
      } catch {
        // ignore
      }
    }
  }

  async applyImportedState(
    imported: StoredState,
    mode: 'merge' | 'replace' = 'merge'
  ): Promise<number> {
    await this.initialize();

    if (mode === 'replace') {
      this.workspaceMap = {};
      this.workspaceOrder = [];
      this.workspaceActiveMap = {};
    }

    const existingNames = new Set(Object.keys(this.workspaceMap));
    let importedCount = 0;

    for (const [name, workspace] of Object.entries(imported.workspaces || {})) {
      const existingWorkspace = this.workspaceMap[name];
      if (mode === 'merge' && existingWorkspace) {
        existingWorkspace.merge(workspace);
        importedCount += 1;
        continue;
      }

      const item = WorkspaceItem.fromWorkspace({
        ...workspace,
        name,
      });

      this.workspaceMap[name] = item;
      existingNames.add(name);
      importedCount += 1;

      if (!this.workspaceOrder.includes(name)) {
        this.workspaceOrder.push(name);
      }
    }

    await this.persist();

    return importedCount;
  }

  async exportAllWorkspacesToJson(): Promise<string> {
    await this.initialize();

    return JSON.stringify(this.toStoredState(), null, 2);
  }

  async exportWorkspacesToJson(names: string[]): Promise<string> {
    await this.initialize();

    const workspaces = Object.fromEntries(
      names
        .filter(name => !!this.workspaceMap[name])
        .map(name => [name, this.workspaceMap[name].toWorkspace()])
    );

    return JSON.stringify(
      {
        version: this.version,
        workspaces,
        activeWorkspaces: {},
        workspaceOrder: names.filter(name => !!workspaces[name]),
      },
      null,
      2
    );
  }

  async exportSingleWorkspaceToJson(name: string): Promise<string> {
    const workspace = await this.retrieveWorkspace(name);
    if (!workspace) {
      throw new Error(`Workspace not found: ${name}`);
    }
    return this.exportWorkspacesToJson([name]);
  }

  async getActiveWorkspaceName(windowId: number): Promise<string | undefined> {
    await this.initialize();
    return this.workspaceActiveReverseMap[windowId];
  }

  async getCurrentActiveWorkspaceName(): Promise<string | undefined> {
    const currentWindow = await chrome.windows.getCurrent();
    if (typeof currentWindow.id !== 'number') return undefined;
    return this.getActiveWorkspaceName(currentWindow.id);
  }

  async setActiveWorkspace(name: string, windowId: number): Promise<void> {
    await this.initialize();

    const previous = this.workspaceActiveReverseMap[windowId];
    if (previous) {
      delete this.workspaceActiveMap[previous];
      this.workspaceMap[previous]?.setActive(null);
    }

    this.workspaceActiveMap[name] = windowId;
    this.workspaceMap[name]?.setActive(windowId);
    this.rebuildActiveReverseMap();
    await this.persist();
  }

  async clearActiveWorkspaceForWindow(windowId: number): Promise<void> {
    await this.initialize();

    const workspaceName = this.workspaceActiveReverseMap[windowId];
    if (workspaceName) {
      delete this.workspaceActiveMap[workspaceName];
      this.workspaceMap[workspaceName]?.setActive(null);
      this.rebuildActiveReverseMap();
      await this.persist();
    }
  }

  async isWorkspaceActive(name: string): Promise<boolean> {
    await this.initialize();
    return name in this.workspaceActiveMap;
  }

  async getWindowIdForWorkspace(name: string): Promise<number | undefined> {
    await this.initialize();
    return this.workspaceActiveMap[name];
  }

  async getActiveWorkspaces(): Promise<Record<string, number>> {
    await this.initialize();
    return { ...this.workspaceActiveMap };
  }

  async assignWorkspaceToNewWindow(windowId: number): Promise<string> {
    await this.initialize();

    const available = await this.listWorkspaces({
      availableOnly: true,
      orderType: 'workspaceOrder',
    }).then(workspaces => workspaces[0]?.name);

    if (available) {
      this.workspaceActiveMap[available] = windowId;
      this.workspaceMap[available]?.setActive(windowId);
      this.rebuildActiveReverseMap();
      await this.persist();
      return available;
    }

    const workspaceName = `Workspace ${windowId}`;

    const workspace = await this.createWorkspace(workspaceName);
    await this.setActiveWorkspace(workspace.name, windowId);

    return workspace.name;
  }

  async isSessionRestart(): Promise<boolean> {
    await this.initialize();

    const hasWorkspaces = await this.listWorkspaces();
    const storedWindowIds = Object.values(this.workspaceActiveMap);
    if (hasWorkspaces.length === 0 && storedWindowIds.length === 0) {
      return false;
    }

    const currentWindows = await chrome.windows.getAll();
    const currentWindowIds = new Set(
      currentWindows
        .filter(
          window => window.type === 'normal' && typeof window.id === 'number'
        )
        .map(window => window.id!)
    );

    return storedWindowIds.some(id => !currentWindowIds.has(id));
  }

  async initializeWorkspacesForOpenWindows(): Promise<void> {
    await this.initialize();

    if (Object.keys(this.workspaceMap).length > 0) {
      return;
    }

    const allWindows = await chrome.windows.getAll();
    const normalWindows = allWindows.filter(window => window.type === 'normal');

    for (const window of normalWindows) {
      if (typeof window.id !== 'number') continue;

      const workspaceName = `Workspace ${window.id}`;

      const workspace = await this.createWorkspace(workspaceName);
      await this.setActiveWorkspace(workspace.name, window.id);
    }
  }

  async restoreAllWorkspacesAfterRestart(): Promise<void> {
    await this.initialize();

    const activeWorkspaceNames = Object.keys(this.workspaceActiveMap);
    this.workspaceActiveMap = {};
    this.rebuildActiveReverseMap();

    const allWindows = await chrome.windows.getAll();
    const normalWindowIds = allWindows
      .filter(
        window => window.type === 'normal' && typeof window.id === 'number'
      )
      .map(window => window.id as number);

    const neededWindowCount = activeWorkspaceNames.length;
    const windowsToUse = [...normalWindowIds];

    while (windowsToUse.length > neededWindowCount) {
      const id = windowsToUse.pop();
      if (typeof id !== 'number') continue;
      try {
        await chrome.windows.remove(id);
      } catch {
        // ignore
      }
    }

    while (windowsToUse.length < neededWindowCount) {
      const window = await chrome.windows.create();
      if (typeof window.id === 'number') {
        windowsToUse.push(window.id);
      }
    }

    for (let i = 0; i < activeWorkspaceNames.length; i += 1) {
      const workspaceName = activeWorkspaceNames[i];
      const windowId = windowsToUse[i];

      if (!this.workspaceMap[workspaceName]) continue;

      await this.setActiveWorkspace(workspaceName, windowId);
      await this.restoreWorkspace(windowId, workspaceName, {
        skipGroups: true,
      });
    }

    this.rebuildActiveReverseMap();
    await this.persist();
  }

  toStoredState(): StoredState {
    return {
      version: this.version,
      workspaces: Object.fromEntries(
        Object.entries(this.workspaceMap).map(([name, workspace]) => [
          name,
          workspace.toWorkspace(),
        ])
      ),
      activeWorkspaces: { ...this.workspaceActiveMap },
      workspaceOrder: [...this.workspaceOrder],
    };
  }

  private defaultTab(): StoredTab {
    return {
      url: 'chrome://newtab/',
      title: 'New Tab',
      active: true,
      index: 0,
      pinned: false,
    };
  }

  private async persist(): Promise<void> {
    this.store.version = this.version;
    this.store.workspaceMap = { ...this.workspaceMap };
    this.store.workspaceOrder = [...this.workspaceOrder];
    this.store.workspaceActive = { ...this.workspaceActiveMap };
    console.log('Persisting state', this.store);
    await this.store.SaveToStorage();
  }

  private rebuildActiveReverseMap(): void {
    this.workspaceActiveReverseMap = Object.fromEntries(
      Object.entries(this.workspaceActiveMap).map(([name, windowId]) => [
        windowId,
        name,
      ])
    );
  }
}
