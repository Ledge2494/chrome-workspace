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
  // format version (e.g. "0.0.2")
  version: string;
  // mapping workspace name -> workspace
  workspaces: Record<string, Workspace>;
  // mapping workspace name -> window ID for currently active workspaces
  activeWorkspaces: Record<string, number>;
  // ordered list of workspace names
  workspaceOrder: string[];
}

export type PartialStoredState = Partial<StoredState>;
