import { Workspace } from '../workspaceType';
import { ImportPayload002 } from './0.0.2';

export interface ImportPayload001 {
  activeWorkspaceName: string;
  workspaces: Record<string, Workspace>;
}

/**
 * Converter for version 0.0.1 -> 0.0.2
 * Converts the format from 0.0.1 to 0.0.2 (no state writes)
 */
async function importFromJson001(
  payload: ImportPayload001
): Promise<ImportPayload002> {
  const incomingWorkspaces = (payload.workspaces || payload) as Record<
    string,
    Workspace
  >;

  const workspaceOrder = Object.keys(incomingWorkspaces);

  return {
    version: '0.0.2',
    workspaces: incomingWorkspaces,
    workspaceOrder,
  };
}

export { importFromJson001 };
