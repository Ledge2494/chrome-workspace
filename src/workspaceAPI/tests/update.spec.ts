describe('workspaceAPI/update (runtime)', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('skips migration when stored version is current', async () => {
    const get = jest.fn(async () => ({
      workspaces_state_v1: {
        version: '0.0.2',
        workspaces: {},
        activeWorkspaces: {},
        workspaceOrder: [],
      },
    }));
    const set = jest.fn(async () => undefined);

    (globalThis as unknown as { chrome: unknown }).chrome = {
      storage: {
        local: {
          get,
          set,
        },
      },
    };

    const runtime = await import('../workspaceRuntime');
    const service = await runtime.getWorkspaceService();
    const importSpy = jest.spyOn(service, 'applyImportedState');

    await runtime.updateWorkspaceRuntimeState();

    expect(importSpy).not.toHaveBeenCalled();
  });

  it('migrates state with replace mode when version is old', async () => {
    const get = jest.fn(async () => ({
      workspaces_state_v1: {
        version: '0.0.1',
        workspaces: {
          Legacy: {
            name: 'Legacy',
            logo: 'fi fi-rr-home',
            createdAt: 1,
            updatedAt: 1,
            tabs: [],
            groups: [],
          },
        },
        activeWorkspaces: {},
        workspaceOrder: ['Legacy'],
      },
    }));
    const set = jest.fn(async () => undefined);

    (globalThis as unknown as { chrome: unknown }).chrome = {
      storage: {
        local: {
          get,
          set,
        },
      },
    };

    const runtime = await import('../workspaceRuntime');
    const service = await runtime.getWorkspaceService();
    const importSpy = jest.spyOn(service, 'applyImportedState');

    await runtime.updateWorkspaceRuntimeState();

    expect(importSpy).toHaveBeenCalledTimes(1);
    expect(importSpy.mock.calls[0][1]).toBe('replace');
  });
});
