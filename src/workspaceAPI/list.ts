import { readState } from './toolbox';
import { Workspace } from './workspaceType';

export async function listWorkspaces(): Promise<Workspace[]> {
  const state = await readState();
  const all = Object.values(state.workspaces);
  // Sort by workspaceOrder when available (most recently opened first),
  // falling back to creation time for any workspace not in the order list
  all.sort((a, b) => a.createdAt - b.createdAt);
  return all;
}

export default { listWorkspaces };
