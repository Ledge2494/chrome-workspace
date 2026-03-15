import { Workspace, StoredState } from '../workspaceType';

export interface ImportPayload002 {
  // format version (e.g. "0.0.2")
  version: string;
  // mapping workspace name -> workspace
  workspaces: Record<string, Workspace>;

  // No active workspace in the file for this version
  // mapping workspace name -> window ID for currently active workspaces
  // activeWorkspaces: Record<string, number>;

  // ordered list of workspace names
  workspaceOrder: string[];
}

/**
 * Importer for version 0.0.2 (current)
 */
async function importFromJson002(
  payload: ImportPayload002
): Promise<StoredState> {
  const incomingWorkspaces = (payload.workspaces || payload) as Record<
    string,
    Workspace
  >;

  const imported: string[] = [];
  const state: StoredState = {
    workspaces: {},
    workspaceOrder: [],
    version: payload.version || '0.0.2',
    // No active workspace info in this version, so start with empty
    activeWorkspaces: {},
  };

  for (const name of Object.keys(incomingWorkspaces)) {
    const wk = incomingWorkspaces[name];
    let targetName = name;
    // avoid name collision
    if (state.workspaces[targetName]) {
      targetName = `${targetName}_${Date.now()}`;
    }
    wk.name = targetName;
    state.workspaces[targetName] = wk;

    // Add to workspaceOrder if not present
    if (!state.workspaceOrder) {
      state.workspaceOrder = [];
    }
    if (!state.workspaceOrder.includes(targetName)) {
      state.workspaceOrder.push(targetName);
    }

    imported.push(targetName);
  }

  return state;
}

export { importFromJson002 };
