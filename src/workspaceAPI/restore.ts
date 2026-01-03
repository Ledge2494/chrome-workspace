import { readState } from './toolbox';
import { suspendAutoSave, resumeAutoSave } from './listener';
import { StoredTab } from './workspaceType';

// Restore a workspace into the given window. We create the saved tabs first
// so the window stays alive, then remove the original tabs that existed
// before the restore. Auto-save is suspended during the whole operation.
export async function restoreWorkspace(
  windowId: number,
  workspaceName: string
): Promise<void> {
  const state = await readState();
  const ws = state.workspaces[workspaceName];
  if (!ws) throw new Error(`workspace not found: ${workspaceName}`);

  suspendAutoSave();
  try {
    // snapshot current tabs so we can remove them after creating the restored ones
    const currentTabs = await chrome.tabs.query({ windowId });
    const currentIds = currentTabs
      .map(t => t.id)
      .filter((id): id is number => typeof id === 'number');

    // create tabs in order (these will keep the window alive while we cleanup old tabs)
    const createdTabIds: number[] = [];
    for (let i = 0; i < ws.tabs.length; i++) {
      const t = ws.tabs[i];
      const created = await chrome.tabs.create({
        windowId,
        url: t.url || 'chrome://newtab',
        active: t.active,
        pinned: t.pinned,
        index: i,
      });
      if (created && typeof created.id === 'number') {
        createdTabIds.push(created.id);
      }
    }

    // recreate groups using groupIndex stored on tabs
    const groupIndexToTabIds = new Map<number, number[]>();
    ws.tabs.forEach((t: StoredTab, idx: number) => {
      if (typeof t.groupIndex === 'number') {
        const ids = groupIndexToTabIds.get(t.groupIndex) || [];
        const createdTabId = createdTabIds[idx];
        if (typeof createdTabId === 'number') ids.push(createdTabId);
        groupIndexToTabIds.set(t.groupIndex, ids);
      }
    });

    for (const [groupIndex, tabIds] of groupIndexToTabIds) {
      if (!tabIds.length) continue;
      try {
        const groupId = await chrome.tabs.group({ tabIds });
        const storedGroup = ws.groups[groupIndex];
        if (storedGroup) {
          chrome.tabGroups.update(groupId, {
            title: storedGroup.title || '',
            color: storedGroup.color || undefined,
            collapsed: !!storedGroup.collapsed,
          });
        }
      } catch (e) {
        // ignore grouping failures
      }
    }

    // after groups and new tabs are created, remove the old tabs that existed before the restore
    const leftover = currentIds.filter(id => !createdTabIds.includes(id));
    if (leftover.length > 0) {
      try {
        chrome.tabs.remove(leftover);
      } catch (e) {
        // ignore
      }
    }
    // eslint-disable-next-line no-useless-catch
  } catch (e) {
    throw e;
  } finally {
    // resume listeners after finishing restore
    resumeAutoSave();
  }
}

export default { restoreWorkspace };
