import { importFromJson } from '../import';
import {
  ImportPayload001Schema,
  ImportPayload002Schema,
} from '../import/schemas';
import { getWorkspaceService } from '../workspaceRuntime';

jest.mock('../workspaceRuntime', () => ({
  getWorkspaceService: jest.fn(),
}));

describe('workspaceAPI/import', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('schema validation', () => {
    it('validates a correct 0.0.1 payload', () => {
      const validPayload = {
        activeWorkspaceName: 'default',
        workspaces: {
          default: {
            name: 'default',
            logo: 'fi fi-rr-window-alt',
            createdAt: 1234567890,
            updatedAt: 1234567890,
            tabs: [],
            groups: [],
          },
        },
      };

      expect(() => ImportPayload001Schema.parse(validPayload)).not.toThrow();
    });

    it('rejects a 0.0.1 payload with missing required fields', () => {
      const invalidPayload = {
        activeWorkspaceName: 'default',
      };

      expect(() => ImportPayload001Schema.parse(invalidPayload)).toThrow();
    });

    it('rejects a 0.0.1 payload with an invalid workspace structure', () => {
      const invalidPayload = {
        activeWorkspaceName: 'default',
        workspaces: {
          default: {
            name: 'default',
          },
        },
      };

      expect(() => ImportPayload001Schema.parse(invalidPayload)).toThrow();
    });

    it('validates a correct 0.0.2 payload', () => {
      const validPayload = {
        version: '0.0.2',
        workspaces: {
          default: {
            name: 'default',
            logo: 'fi fi-rr-window-alt',
            createdAt: 1234567890,
            updatedAt: 1234567890,
            tabs: [
              {
                url: 'https://example.com',
                title: 'Example',
                active: true,
                pinned: false,
                index: 0,
              },
            ],
            groups: [],
          },
        },
        workspaceOrder: ['default'],
      };

      expect(() => ImportPayload002Schema.parse(validPayload)).not.toThrow();
    });

    it('validates a 0.0.2 payload with optional activeWorkspaces', () => {
      const validPayload = {
        version: '0.0.2',
        workspaces: {
          default: {
            name: 'default',
            logo: 'fi fi-rr-window-alt',
            createdAt: 1234567890,
            updatedAt: 1234567890,
            tabs: [],
            groups: [],
          },
        },
        activeWorkspaces: {
          default: 12345,
        },
        workspaceOrder: ['default'],
      };

      expect(() => ImportPayload002Schema.parse(validPayload)).not.toThrow();
    });

    it('rejects a 0.0.2 payload with missing workspaceOrder', () => {
      const invalidPayload = {
        version: '0.0.2',
        workspaces: {
          default: {
            name: 'default',
            logo: 'fi fi-rr-window-alt',
            createdAt: 1234567890,
            updatedAt: 1234567890,
            tabs: [],
            groups: [],
          },
        },
      };

      expect(() => ImportPayload002Schema.parse(invalidPayload)).toThrow();
    });

    it('accepts optional tab fields', () => {
      const payload = {
        version: '0.0.2',
        workspaces: {
          test: {
            name: 'test',
            logo: 'fi fi-rr-window-alt',
            createdAt: 1234567890,
            updatedAt: 1234567890,
            tabs: [
              {},
              {
                url: 'https://example.com',
                title: 'Example',
                pinned: true,
                active: false,
                index: 0,
                favIconUrl: 'https://example.com/favicon.ico',
                discarded: false,
                groupIndex: null,
              },
            ],
            groups: [],
          },
        },
        workspaceOrder: ['test'],
      };

      expect(() => ImportPayload002Schema.parse(payload)).not.toThrow();
    });

    it('accepts optional group fields', () => {
      const payload = {
        version: '0.0.2',
        workspaces: {
          test: {
            name: 'test',
            logo: 'fi fi-rr-window-alt',
            createdAt: 1234567890,
            updatedAt: 1234567890,
            tabs: [],
            groups: [
              {
                title: 'My Group',
                color: 'blue' as const,
                collapsed: false,
              },
            ],
          },
        },
        workspaceOrder: ['test'],
      };

      expect(() => ImportPayload002Schema.parse(payload)).not.toThrow();
    });
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
