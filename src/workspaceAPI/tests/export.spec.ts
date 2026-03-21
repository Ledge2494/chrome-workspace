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
    readState: jest.fn(),
    writeState: jest.fn(),
  } as unknown as WorkspaceStore;
}

describe('workspaceAPI/export (WorkspaceService)', () => {
  it('exports a single workspace as JSON', async () => {
    const store = createMockStore();
    const service = new WorkspaceService(store, new WorkspaceBuilder());

    await service.createWorkspace('Main', 'fi fi-rr-home');
    await service.createWorkspace('Work', 'fi fi-rr-briefcase');

    const result = await service.exportSingleWorkspaceToJson('Main');
    const parsed = JSON.parse(result);

    expect(Object.keys(parsed.workspaces)).toEqual(['Main']);
    expect(parsed.workspaceOrder).toEqual(['Main']);
  });

  it('exports selected workspaces as JSON', async () => {
    const store = createMockStore();
    const service = new WorkspaceService(store, new WorkspaceBuilder());

    await service.createWorkspace('Main', 'fi fi-rr-home');
    await service.createWorkspace('Work', 'fi fi-rr-briefcase');

    const result = await service.exportWorkspacesToJson(['Main', 'Work']);
    const parsed = JSON.parse(result);

    expect(Object.keys(parsed.workspaces)).toEqual(['Main', 'Work']);
    expect(parsed.workspaceOrder).toEqual(['Main', 'Work']);
  });

  it('exports all workspaces including state metadata', async () => {
    const store = createMockStore();
    const service = new WorkspaceService(store, new WorkspaceBuilder());

    await service.createWorkspace('Main', 'fi fi-rr-home');

    const result = await service.exportAllWorkspacesToJson();
    const parsed = JSON.parse(result);

    expect(parsed.version).toBe('0.0.2');
    expect(Object.keys(parsed.workspaces)).toContain('Main');
    expect(parsed).toHaveProperty('activeWorkspaces');
  });
});
