import { readState, writeState } from './toolbox';
import { Workspace } from './workspaceType';

export async function importFromJson(
  json: string,
  opts?: { replace?: boolean }
): Promise<{ imported: string[] }> {
  const parsed = JSON.parse(json);
  if (!parsed) return { imported: [] };

  const state = await readState();
  const incomingWorkspaces: Record<string, Workspace> =
    parsed.workspaces || parsed;

  const imported: string[] = [];

  if (opts && opts.replace) {
    // wipe and replace
    state.workspaces = {};
  }

  for (const name of Object.keys(incomingWorkspaces)) {
    const wk = incomingWorkspaces[name];
    let targetName = name;
    // avoid name collision
    if (state.workspaces[targetName]) {
      targetName = `${targetName}_${Date.now()}`;
    }
    wk.name = targetName;
    state.workspaces[targetName] = wk;
    imported.push(targetName);
  }

  await writeState(state);
  return { imported };
}

export default { importFromJson };
