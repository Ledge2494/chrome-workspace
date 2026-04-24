import { ImportPayload002Schema } from './schemas';
import { StoredState, Workspace } from '../workspaceType';

/**
 * Importer for version 0.0.2 (current)
 * @throws {z.ZodError} if the payload structure is invalid
 */
async function importFromJson002(payload: unknown): Promise<StoredState> {
  const validatedPayload = ImportPayload002Schema.parse(payload);

  // Deduplicate workspaces by name, keeping the most recently updated one
  const workspaceMap: Record<string, Workspace> = {};

  for (const [name, workspace] of Object.entries(validatedPayload.workspaces)) {
    if (
      !workspaceMap[name] ||
      workspace.updatedAt > workspaceMap[name].updatedAt
    ) {
      workspaceMap[name] = workspace;
    }
  }

  // Reconstruct the workspaces object with deduplicated entries
  const deduplicatedWorkspaces: Record<string, Workspace> = {};
  for (const [name, workspace] of Object.entries(workspaceMap)) {
    deduplicatedWorkspaces[name] = workspace;
  }

  // Filter activeWorkspaces to only include workspaces that exist
  const workspaceNames = Object.keys(deduplicatedWorkspaces);
  const filteredActiveWorkspaces: Record<string, number> = {};

  for (const [name, windowId] of Object.entries(
    validatedPayload.activeWorkspaces || {}
  )) {
    if (workspaceNames.includes(name)) {
      filteredActiveWorkspaces[name] = windowId;
    }
  }

  // Deduplication, filtering and completeness check for workspaceOrder
  const workspaceOrderSet = new Set(validatedPayload.workspaceOrder);
  const finalWorkspaceOrder: string[] = [];

  for (const name of validatedPayload.workspaceOrder) {
    if (workspaceNames.includes(name) && !finalWorkspaceOrder.includes(name)) {
      finalWorkspaceOrder.push(name);
    }
  }

  // Add any workspaces that are missing from workspaceOrder at the end
  for (const name of workspaceNames) {
    if (!workspaceOrderSet.has(name)) {
      finalWorkspaceOrder.push(name);
    }
  }

  // At this point, the payload is valid and can be returned as StoredState

  return {
    workspaces: deduplicatedWorkspaces,
    workspaceOrder: finalWorkspaceOrder,
    version: '0.0.2',
    activeWorkspaces: filteredActiveWorkspaces,
  };
}

export { importFromJson002 };
