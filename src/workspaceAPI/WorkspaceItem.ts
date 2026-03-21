import { StoredGroup, StoredTab, Workspace } from './workspaceType';

export class WorkspaceItem {
  public name: string;
  public logo: string;
  public createdAt: number;
  public updatedAt: number;
  public tabs: StoredTab[];
  public groups: StoredGroup[];
  public activeWindowId: number | null;

  constructor(data: Workspace & { activeWindowId?: number | null }) {
    this.name = data.name;
    this.logo = data.logo;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.tabs = data.tabs;
    this.groups = data.groups;
    this.activeWindowId = data.activeWindowId ?? null;
  }

  static fromWorkspace(workspace: Workspace): WorkspaceItem {
    return new WorkspaceItem({ ...workspace });
  }

  static validateName(name: string): boolean {
    return typeof name === 'string' && name.trim().length > 0;
  }

  static generateUniqueName(): string {
    const now = Date.now();
    const candidate = `Workspace ${now.toString().slice(-4)}-${Math.random()
      .toString(6)
      .slice(2, 6)}`;
    return candidate;
  }

  static generateDefaultLogo(): string {
    return 'fi fi-rr-home';
  }

  async captureWindowSnapshot(windowId: number): Promise<boolean> {
    const tabs = await chrome.tabs.query({ windowId });
    const groups = await chrome.tabGroups.query({ windowId });

    const groupMap = new Map<number, number>();
    const storedGroups: StoredGroup[] = [];

    groups.forEach((group, index) => {
      groupMap.set(group.id as number, index);
      storedGroups.push({
        title: group.title || null,
        color: group.color || null,
        collapsed: !!group.collapsed,
      });
    });

    const storedTabs: StoredTab[] = tabs.map(tab => ({
      url: tab.url,
      title: tab.title || '',
      pinned: !!tab.pinned,
      active: !!tab.active,
      index: tab.index,
      favIconUrl: tab.favIconUrl,
      discarded: !!tab.discarded,
      groupIndex:
        typeof tab.groupId === 'number' && groupMap.has(tab.groupId)
          ? groupMap.get(tab.groupId) ?? null
          : null,
    }));

    this.tabs = storedTabs;
    this.groups = storedGroups;
    this.updatedAt = Date.now();

    return true;
  }

  isActive(): boolean {
    return this.activeWindowId !== null;
  }

  setActive(windowId: number | null): boolean {
    this.activeWindowId = windowId;
    return true;
  }

  merge(workspace: Workspace): void {
    const groupOffset = this.groups.length;

    const mergedGroups = workspace.groups.map(group => ({ ...group }));
    const mergedTabs = workspace.tabs.map(tab => ({
      ...tab,
      groupIndex:
        typeof tab.groupIndex === 'number'
          ? tab.groupIndex + groupOffset
          : tab.groupIndex,
    }));

    this.groups = [...this.groups, ...mergedGroups];
    this.tabs = [...this.tabs, ...mergedTabs];
    this.updatedAt = Date.now();
  }

  toWorkspace(): Workspace {
    return {
      name: this.name,
      logo: this.logo,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      tabs: this.tabs,
      groups: this.groups,
    };
  }
}
