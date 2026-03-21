import { importFromJson } from '../import';
import { getWorkspaceService } from '../workspaceRuntime';

jest.mock('../workspaceRuntime', () => ({
  getWorkspaceService: jest.fn(),
}));

describe('workspaceAPI/import', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns converted payload without writing when writeToState=false', async () => {
    const service = {
      applyImportedState: jest.fn(),
    };

    (getWorkspaceService as unknown as jest.Mock).mockResolvedValue(service);

    const json = JSON.stringify({
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
      },
      workspaceOrder: ['Main'],
      activeWorkspaces: {},
    });

    const result = await importFromJson(json, { writeToState: false });

    expect((result as { version?: string }).version).toBe('0.0.2');
    expect(service.applyImportedState).not.toHaveBeenCalled();
  });

  it('writes imported workspaces through WorkspaceService by default', async () => {
    const service = {
      applyImportedState: jest.fn().mockResolvedValue(2),
    };

    (getWorkspaceService as unknown as jest.Mock).mockResolvedValue(service);

    const json = JSON.stringify({
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
        Work: {
          name: 'Work',
          logo: 'fi fi-rr-briefcase',
          createdAt: 1,
          updatedAt: 1,
          tabs: [],
          groups: [],
        },
      },
      workspaceOrder: ['Main', 'Work'],
      activeWorkspaces: {},
    });

    const result = await importFromJson(json);

    expect(service.applyImportedState).toHaveBeenCalledWith(
      expect.objectContaining({
        version: '0.0.2',
        workspaces: expect.any(Object),
      }),
      'merge'
    );
    expect(Array.isArray(result)).toBe(true);
    expect((result as unknown[]).length).toBe(2);
  });

  it('throws for unsupported versions', async () => {
    const json = JSON.stringify({ version: '9.9.9', workspaces: {} });

    await expect(importFromJson(json, { writeToState: false })).rejects.toThrow(
      'Unsupported import version: 9.9.9'
    );
  });
});
