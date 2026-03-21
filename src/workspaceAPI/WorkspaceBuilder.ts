import { StoredTab } from './workspaceType';
import { WorkspaceItem } from './WorkspaceItem';

export class WorkspaceBuilder {
  private workspace: WorkspaceItem | null = null;

  reset(): void {
    this.workspace = null;
  }

  buildBlankWorkspace(name?: string, logo?: string): WorkspaceBuilder {
    const now = Date.now();
    const defaultTab: StoredTab = {
      url: 'chrome://newtab/',
      title: 'New Tab',
      active: true,
      index: 0,
      pinned: false,
    };

    this.workspace = new WorkspaceItem({
      name: name || WorkspaceItem.generateUniqueName(),
      logo: logo || WorkspaceItem.generateDefaultLogo(),
      createdAt: now,
      updatedAt: now,
      tabs: [defaultTab],
      groups: [],
    });

    return this;
  }

  async buildTabsSnapshot(windowId: number): Promise<WorkspaceBuilder> {
    if (!this.workspace) {
      this.buildBlankWorkspace(`Workspace ${windowId}`);
    }
    await this.workspace!.captureWindowSnapshot(windowId);
    return this;
  }

  validateBuild(): boolean {
    return !!(
      this.workspace &&
      WorkspaceItem.validateName(this.workspace.name) &&
      Array.isArray(this.workspace.tabs) &&
      Array.isArray(this.workspace.groups)
    );
  }

  getWorkspace(): WorkspaceItem {
    if (!this.workspace || !this.validateBuild()) {
      throw new Error('Workspace build is invalid');
    }

    return this.workspace;
  }
}
