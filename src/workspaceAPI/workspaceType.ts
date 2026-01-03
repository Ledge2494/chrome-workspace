export interface StoredGroup {
  // group metadata (no global id)
  title?: string | null;
  color?: chrome.tabGroups.ColorEnum | null;
  collapsed?: boolean;
}

export interface StoredTab {
  url?: string;
  title?: string;
  pinned?: boolean;
  active?: boolean;
  index?: number;
  favIconUrl?: string;
  discarded?: boolean;
  // maps to StoredGroup index in the workspace.groups array, or null when not in a group
  groupIndex?: number | null;
}

export interface Workspace {
  logo: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  tabs: StoredTab[];
  groups: StoredGroup[];
}

export interface StoredState {
  // mapping workspace name -> workspace
  workspaces: Record<string, Workspace>;
  // current active workspace name (global for all windows)
  activeWorkspaceName?: string;
}

export type PartialStoredState = Partial<StoredState>;
