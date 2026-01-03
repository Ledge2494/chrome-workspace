import { readState } from './toolbox';
import { Workspace } from './workspaceType';

export async function listWorkspaces(): Promise<Workspace[]> {
  const state = await readState();
  const all = Object.values(state.workspaces);
  // sort by created asc
  all.sort((a, b) => a.createdAt - b.createdAt);
  return all;
}

export default { listWorkspaces };
