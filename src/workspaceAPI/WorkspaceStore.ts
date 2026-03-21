import packageJson from '../../package.json';
import { Mutex } from 'async-mutex';
import { StoredState } from './workspaceType';
import { WorkspaceItem } from './WorkspaceItem';

const STORAGE_KEY = 'workspaces_state_v1';

export class WorkspaceStore {
  public version: string;
  public workspaceMap: Record<string, WorkspaceItem>;
  public workspaceOrder: string[];
  public workspaceActive: Record<string, number>;

  private readonly readMutex: Mutex = new Mutex();
  private readonly writeMutex: Mutex = new Mutex();
  private concurrentReadCounter: number = 0;

  constructor() {
    this.version = packageJson.version;
    this.workspaceMap = {};
    this.workspaceOrder = [];
    this.workspaceActive = {};
  }

  // Concurrency control: allow multiple concurrent reads but exclusive writes
  async withReadLock<T>(fn: () => Promise<T>): Promise<T> {
    try {
      this.concurrentReadCounter++;
      return await fn();
    } finally {
      this.concurrentReadCounter--;
      if (this.concurrentReadCounter === 0) {
        this.readMutex.release();
      } else if (!this.readMutex.isLocked()) {
        await this.readMutex.acquire();
      }
    }
  }

  // Concurrency control: exclusive write access, blocking all reads and other writes (cannot write while reads are in progress)
  async withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
    return this.readMutex.runExclusive(async () => {
      return this.writeMutex.runExclusive(fn);
    });
  }

  async LoadFromStorage(): Promise<void> {
    await this.withReadLock(async () => {
      const state = await this.readState();
      this.version = state.version || packageJson.version;
      this.workspaceMap = Object.fromEntries(
        Object.entries(state.workspaces || {}).map(([name, workspace]) => [
          name,
          WorkspaceItem.fromWorkspace(workspace),
        ])
      );
      this.workspaceOrder = state.workspaceOrder || [];
      this.workspaceActive = state.activeWorkspaces || {};
    });
  }

  async SaveToStorage(): Promise<void> {
    await this.withWriteLock(async () => {
      const now = Date.now();
      const workspaces = Object.fromEntries(
        Object.entries(this.workspaceMap).map(([name, workspace]) => {
          workspace.updatedAt = now;
          return [name, workspace.toWorkspace()];
        })
      );

      const state: StoredState = {
        version: this.version || packageJson.version,
        workspaces,
        activeWorkspaces: this.workspaceActive,
        workspaceOrder: this.workspaceOrder,
      };

      await this.writeState(state);
    });
  }

  async readState(): Promise<StoredState> {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    const state = result?.[STORAGE_KEY] as StoredState | undefined;

    if (state) return state;

    return {
      version: packageJson.version,
      workspaces: {},
      activeWorkspaces: {},
      workspaceOrder: [],
    };
  }

  async writeState(state: StoredState): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
  }
}
