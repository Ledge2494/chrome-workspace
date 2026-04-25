import { WorkspaceBuilder } from './WorkspaceBuilder';
import { WorkspaceListener } from './WorkspaceListener';
import { WorkspaceService } from './WorkspaceService';
import { WorkspaceStore } from './WorkspaceStore';
import { SettingsHandler } from '@src/settingsAPI/settingsHandler';
import packageJson from '../../package.json';

interface WorkspaceRuntime {
  store: WorkspaceStore;
  builder: WorkspaceBuilder;
  service: WorkspaceService;
  listener: WorkspaceListener;
  settings: SettingsHandler;
}

let runtimePromise: WorkspaceRuntime | null = null;
let backgroundListenersInstalled = false;

async function createRuntime(): Promise<WorkspaceRuntime> {
  const store = new WorkspaceStore();
  const builder = new WorkspaceBuilder();
  const settings = new SettingsHandler();
  const service = new WorkspaceService(store, builder, settings);
  const listener = new WorkspaceListener(service, settings);
  await service.initialize();

  return {
    store,
    builder,
    service,
    listener,
    settings,
  };
}

export async function getWorkspaceRuntime(): Promise<WorkspaceRuntime> {
  if (!runtimePromise) {
    runtimePromise = await createRuntime();
  }

  return runtimePromise;
}

export async function getWorkspaceService(): Promise<WorkspaceService> {
  const runtime = await getWorkspaceRuntime();
  return runtime.service;
}

export async function getWorkspaceStore(): Promise<WorkspaceStore> {
  const runtime = await getWorkspaceRuntime();
  return runtime.store;
}

export async function getWorkspaceListener(): Promise<WorkspaceListener> {
  const runtime = await getWorkspaceRuntime();
  return runtime.listener;
}

export async function getSettingsHandler(): Promise<SettingsHandler> {
  const runtime = await getWorkspaceRuntime();
  return runtime.settings;
}

export async function updateWorkspaceRuntimeState(): Promise<void> {
  const store = await getWorkspaceStore();
  const service = await getWorkspaceService();
  const state = await store.readState();

  if (state.version === packageJson.version) {
    console.debug('State is already at the current version. No update needed.');
    return;
  }

  await service.applyImportedState(state, 'replace');
}

export async function installRuntimeBackgroundListeners(): Promise<void> {
  if (backgroundListenersInstalled) return;
  backgroundListenersInstalled = true;

  const listener = await getWorkspaceListener();
  const service = await getWorkspaceService();

  listener.installBackgroundListeners(async payload => {
    await service.switchWorkspace(payload.workspaceName, payload.windowId);
  });
}
