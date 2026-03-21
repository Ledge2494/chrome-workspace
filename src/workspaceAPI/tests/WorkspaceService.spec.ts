import { WorkspaceBuilder } from '../WorkspaceBuilder';
import { WorkspaceService } from '../WorkspaceService';
import { WorkspaceStore } from '../WorkspaceStore';

function createMockStore(): WorkspaceStore {
  return {
    version: '0.0.2',
    workspaceMap: {},
    workspaceOrder: [],
    workspaceActive: {},
    LoadFromStorage: jest.fn(async () => {}),
    SaveToStorage: jest.fn(async () => {}),
    withWriteLock: jest.fn(async fn => fn()),
    withReadLock: jest.fn(async fn => fn()),
    readState: jest.fn(),
    writeState: jest.fn(),
  } as unknown as WorkspaceStore;
}

describe('WorkspaceService', () => {
  it('creates, lists and deletes workspaces', async () => {
    const store = createMockStore();
    const service = new WorkspaceService(store, new WorkspaceBuilder());

    await service.createWorkspace('Main', 'fi fi-rr-home');
    await service.createWorkspace('Work', 'fi fi-rr-briefcase');

    const list = await service.listWorkspaces({ orderType: 'createdAt-asc' });
    expect(list).toHaveLength(2);
    expect(list.map(w => w.name)).toEqual(['Main', 'Work']);

    expect(await service.deleteWorkspace('Main')).toBe(true);
    expect(await service.deleteWorkspace('Main')).toBe(false);
    expect(store.SaveToStorage).toHaveBeenCalled();
  });

  it('does not delete active workspace', async () => {
    const store = createMockStore();
    const service = new WorkspaceService(store, new WorkspaceBuilder());

    await service.createWorkspace('Main', 'fi fi-rr-home');
    await service.setActiveWorkspace('Main', 10);

    const deleted = await service.deleteWorkspace('Main');
    expect(deleted).toBe(false);
  });

  it('switches workspace in a window with save/restore hooks', async () => {
    const store = createMockStore();
    const service = new WorkspaceService(store, new WorkspaceBuilder());

    await service.createWorkspace('A', 'fi fi-rr-home');
    await service.createWorkspace('B', 'fi fi-rr-home');
    await service.setActiveWorkspace('A', 7);

    const saveSpy = jest
      .spyOn(service, 'saveCurrentWindow')
      .mockResolvedValue((await service.retrieveWorkspace('A'))!);
    const restoreSpy = jest
      .spyOn(service, 'restoreWorkspace')
      .mockResolvedValue(undefined);

    const switched = await service.switchWorkspace('B', 7);

    expect(switched).toBe(true);
    expect(saveSpy).toHaveBeenCalledWith(7);
    expect(restoreSpy).toHaveBeenCalledWith(7, 'B');
    expect(await service.getWindowIdForWorkspace('B')).toBe(7);
    expect(await service.getWindowIdForWorkspace('A')).toBeUndefined();
  });

  it('imports and exports workspaces as json', async () => {
    const store = createMockStore();
    const service = new WorkspaceService(store, new WorkspaceBuilder());

    await service.createWorkspace('Main', 'fi fi-rr-home');

    const importedCount = await service.applyImportedState(
      {
        version: '0.0.2',
        workspaces: {
          Main: {
            name: 'Main',
            logo: 'fi fi-rr-home',
            createdAt: 1,
            updatedAt: 1,
            tabs: [],
            groups: [],
          },
          Extra: {
            name: 'Extra',
            logo: 'fi fi-rr-home',
            createdAt: 1,
            updatedAt: 1,
            tabs: [],
            groups: [],
          },
        },
        activeWorkspaces: {},
        workspaceOrder: ['Main', 'Extra'],
      },
      'merge'
    );

    expect(importedCount).toBe(2);

    const exported = await service.exportAllWorkspacesToJson();
    const parsed = JSON.parse(exported);

    expect(parsed.version).toBe('0.0.2');
    const names = Object.keys(parsed.workspaces);
    expect(names).toHaveLength(2);
    expect(names).toEqual(expect.arrayContaining(['Main', 'Extra']));
  });

  it('merges tabs and groups when importing an existing workspace name', async () => {
    const store = createMockStore();
    const service = new WorkspaceService(store, new WorkspaceBuilder());

    await service.createWorkspace('Main', 'fi fi-rr-home');
    const existing = await service.retrieveWorkspace('Main');
    if (!existing) throw new Error('expected workspace to exist');

    existing.groups = [
      {
        title: 'Existing',
        color: 'grey',
        collapsed: false,
      },
    ];
    existing.tabs = [
      {
        url: 'https://existing.example',
        title: 'Existing',
        active: true,
        pinned: false,
        groupIndex: 0,
      },
    ];

    await service.applyImportedState(
      {
        version: '0.0.2',
        workspaces: {
          Main: {
            name: 'Main',
            logo: 'fi fi-rr-home',
            createdAt: 1,
            updatedAt: 1,
            tabs: [
              {
                url: 'https://imported.example',
                title: 'Imported',
                active: false,
                pinned: false,
                groupIndex: 0,
              },
            ],
            groups: [
              {
                title: 'Imported Group',
                color: 'blue',
                collapsed: true,
              },
            ],
          },
        },
        activeWorkspaces: {},
        workspaceOrder: ['Main'],
      },
      'merge'
    );

    const merged = await service.retrieveWorkspace('Main');
    if (!merged) throw new Error('expected workspace to exist');

    expect(merged.groups).toHaveLength(2);
    expect(merged.tabs).toHaveLength(2);
    expect(merged.tabs[0].groupIndex).toBe(0);
    expect(merged.tabs[1].groupIndex).toBe(1);
  });

  describe('listWorkspaces options', () => {
    it('lists all workspaces with default options', async () => {
      const store = createMockStore();
      const service = new WorkspaceService(store, new WorkspaceBuilder());

      await service.createWorkspace('A', 'fi fi-rr-home');
      await service.createWorkspace('B', 'fi fi-rr-briefcase');
      await service.createWorkspace('C', 'fi fi-rr-settings');

      const list = await service.listWorkspaces();
      expect(list).toHaveLength(3);
      expect(list.map(w => w.name)).toEqual(['A', 'B', 'C']);
    });

    it('lists workspaces sorted by createdAt ascending', async () => {
      const store = createMockStore();
      const service = new WorkspaceService(store, new WorkspaceBuilder());

      await service.createWorkspace('First', 'fi fi-rr-home');
      await service.createWorkspace('Second', 'fi fi-rr-briefcase');
      await service.createWorkspace('Third', 'fi fi-rr-settings');

      const list = await service.listWorkspaces({ orderType: 'createdAt-asc' });
      expect(list.map(w => w.name)).toEqual(['First', 'Second', 'Third']);
    });

    it('lists workspaces sorted by updatedAt descending', async () => {
      const store = createMockStore();
      const service = new WorkspaceService(store, new WorkspaceBuilder());

      await service.createWorkspace('A', 'fi fi-rr-home');
      await service.createWorkspace('B', 'fi fi-rr-briefcase');
      await service.createWorkspace('C', 'fi fi-rr-settings');

      const workspaceA = await service.retrieveWorkspace('A');
      const workspaceB = await service.retrieveWorkspace('B');
      const workspaceC = await service.retrieveWorkspace('C');

      if (!workspaceA || !workspaceB || !workspaceC)
        throw new Error('expected workspaces to exist');

      // Simulate updating workspaces with distinct timestamps
      const now = Date.now();
      workspaceA.updatedAt = now + 100;
      workspaceB.updatedAt = now;
      workspaceC.updatedAt = now + 50;

      const list = await service.listWorkspaces({
        orderType: 'updatedAt-desc',
      });
      expect(list.map(w => w.name)).toEqual(['A', 'C', 'B']);
    });

    it('lists workspaces in custom workspaceOrder', async () => {
      const store = createMockStore();
      const service = new WorkspaceService(store, new WorkspaceBuilder());

      await service.createWorkspace('A', 'fi fi-rr-home');
      await service.createWorkspace('B', 'fi fi-rr-briefcase');
      await service.createWorkspace('C', 'fi fi-rr-settings');

      // The order should be creation order by default
      let list = await service.listWorkspaces({ orderType: 'workspaceOrder' });
      expect(list.map(w => w.name)).toEqual(['A', 'B', 'C']);

      // Simulate workspace order change with switch
      await service.setActiveWorkspace('C', 10);
      await service.setActiveWorkspace('A', 10);

      list = await service.listWorkspaces({ orderType: 'workspaceOrder' });
      expect(list.map(w => w.name)).toEqual(['A', 'B', 'C']);
    });

    it('lists only active workspaces', async () => {
      const store = createMockStore();
      const service = new WorkspaceService(store, new WorkspaceBuilder());

      await service.createWorkspace('A', 'fi fi-rr-home');
      await service.createWorkspace('B', 'fi fi-rr-briefcase');
      await service.createWorkspace('C', 'fi fi-rr-settings');

      await service.setActiveWorkspace('A', 10);
      await service.setActiveWorkspace('C', 20);

      const list = await service.listWorkspaces({ activeOnly: true });
      expect(list).toHaveLength(2);
      expect(list.map(w => w.name)).toEqual(expect.arrayContaining(['A', 'C']));
    });

    it('lists only available (inactive) workspaces', async () => {
      const store = createMockStore();
      const service = new WorkspaceService(store, new WorkspaceBuilder());

      await service.createWorkspace('A', 'fi fi-rr-home');
      await service.createWorkspace('B', 'fi fi-rr-briefcase');
      await service.createWorkspace('C', 'fi fi-rr-settings');

      await service.setActiveWorkspace('A', 10);

      const list = await service.listWorkspaces({ availableOnly: true });
      expect(list).toHaveLength(2);
      expect(list.map(w => w.name)).toEqual(expect.arrayContaining(['B', 'C']));
    });

    it('returns empty list when no active workspaces exist', async () => {
      const store = createMockStore();
      const service = new WorkspaceService(store, new WorkspaceBuilder());

      await service.createWorkspace('A', 'fi fi-rr-home');
      await service.createWorkspace('B', 'fi fi-rr-briefcase');

      const list = await service.listWorkspaces({ activeOnly: true });
      expect(list).toHaveLength(0);
    });

    it('returns all workspaces when no available workspaces exist', async () => {
      const store = createMockStore();
      const service = new WorkspaceService(store, new WorkspaceBuilder());

      await service.createWorkspace('A', 'fi fi-rr-home');
      await service.createWorkspace('B', 'fi fi-rr-briefcase');

      await service.setActiveWorkspace('A', 10);
      await service.setActiveWorkspace('B', 20);

      const list = await service.listWorkspaces({ availableOnly: true });
      expect(list).toHaveLength(0);
    });

    it('respects orderType with activeOnly filter', async () => {
      const store = createMockStore();
      const service = new WorkspaceService(store, new WorkspaceBuilder());

      await service.createWorkspace('A', 'fi fi-rr-home');
      await service.createWorkspace('B', 'fi fi-rr-briefcase');
      await service.createWorkspace('C', 'fi fi-rr-settings');

      await service.setActiveWorkspace('A', 10);
      await service.setActiveWorkspace('C', 20);

      const list = await service.listWorkspaces({
        activeOnly: true,
        orderType: 'createdAt-asc',
      });

      expect(list).toHaveLength(2);
      expect(list.map(w => w.name)).toEqual(['A', 'C']);
    });

    it('respects orderType with availableOnly filter', async () => {
      const store = createMockStore();
      const service = new WorkspaceService(store, new WorkspaceBuilder());

      await service.createWorkspace('A', 'fi fi-rr-home');
      await service.createWorkspace('B', 'fi fi-rr-briefcase');
      await service.createWorkspace('C', 'fi fi-rr-settings');

      await service.setActiveWorkspace('B', 10);

      const list = await service.listWorkspaces({
        availableOnly: true,
        orderType: 'createdAt-asc',
      });

      expect(list).toHaveLength(2);
      expect(list.map(w => w.name)).toEqual(['A', 'C']);
    });
  });
});
