import { WorkspaceItem } from '../WorkspaceItem';

describe('WorkspaceItem', () => {
  it('validates and generates names', () => {
    expect(WorkspaceItem.validateName('Main')).toBe(true);
    expect(WorkspaceItem.validateName('   ')).toBe(false);

    const generated = WorkspaceItem.generateUniqueName();
    expect(generated).toMatch(/^Workspace \d{4}-\d{4}$/);
    const generated2 = WorkspaceItem.generateUniqueName();
    expect(generated2).toMatch(/^Workspace \d{4}-\d{4}$/);
    expect(generated).not.toBe(generated2);
  });

  it('captures tabs and groups from chrome APIs', async () => {
    const tabsQuery = jest.fn().mockResolvedValue([
      {
        url: 'https://example.com',
        title: 'Example',
        pinned: false,
        active: true,
        index: 0,
        favIconUrl: 'https://example.com/favicon.ico',
        discarded: false,
        groupId: 10,
      },
      {
        url: 'https://example.org',
        title: 'Example Org',
        pinned: true,
        active: false,
        index: 1,
        favIconUrl: '',
        discarded: false,
        groupId: -1,
      },
    ]);

    const groupsQuery = jest.fn().mockResolvedValue([
      {
        id: 10,
        title: 'Read Later',
        color: 'blue',
        collapsed: false,
      },
    ]);

    (globalThis as unknown as { chrome: unknown }).chrome = {
      tabs: {
        query: tabsQuery,
      },
      tabGroups: {
        query: groupsQuery,
      },
    };

    const item = new WorkspaceItem({
      name: 'Main',
      logo: 'fi fi-rr-home',
      createdAt: 1,
      updatedAt: 1,
      tabs: [],
      groups: [],
    });

    const result = await item.captureWindowSnapshot(1);

    expect(result).toBe(true);
    expect(tabsQuery).toHaveBeenCalledWith({ windowId: 1 });
    expect(groupsQuery).toHaveBeenCalledWith({ windowId: 1 });

    expect(item.groups).toEqual([
      {
        title: 'Read Later',
        color: 'blue',
        collapsed: false,
      },
    ]);

    expect(item.tabs[0].groupIndex).toBe(0);
    expect(item.tabs[1].groupIndex).toBeNull();
    expect(item.updatedAt).toBeGreaterThan(1);
  });
});
