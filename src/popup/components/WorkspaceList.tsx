import { useCallback, useEffect } from 'preact/compat';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { WorkspaceButton } from '../../components/workspaceButton/WorkspaceButton';
import { Workspace } from '@src/workspaceAPI/workspaceType';
import { getWorkspaceService } from '@src/workspaceAPI/workspaceRuntime';
import { BackgroundMessageEnum } from '@src/workspaceAPI/WorkspaceListener';
import useContextMenu from '@src/components/contextMenu/useContextMenu';

interface WorkspaceListProps {
  onWorkspaceSwitch?: (workspaceName: string) => void;
  onAddWorkspace?: () => void;
  onContextMenuHeightChange?: (height: number) => void;
}

export const WorkspaceList = ({
  onWorkspaceSwitch,
  onAddWorkspace,
  onContextMenuHeightChange,
}: WorkspaceListProps) => {
  const queryClient = useQueryClient();

  const {
    isPending: isWorkspaceListPending,
    isError: isWorkspaceListError,
    data: workspaceList,
  } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const service = await getWorkspaceService();
      const workspaces = await service.listWorkspaces({
        orderType: 'createdAt-asc',
      });
      return workspaces.map(workspace => workspace.toWorkspace());
    },
  });

  const {
    isPending: isActiveWorkspacePending,
    isError: isActiveWorkspaceError,
    data: activeWorkspace,
  } = useQuery({
    queryKey: ['activeWorkspaceName'],
    queryFn: async () => {
      const service = await getWorkspaceService();
      return (await service.getCurrentActiveWorkspaceName()) || '';
    },
  });

  const { data: allActiveWorkspaces = {} } = useQuery({
    queryKey: ['allActiveWorkspaces'],
    queryFn: async () => {
      const service = await getWorkspaceService();
      return service.getActiveWorkspaces();
    },
  });

  const workspaceMutationDelete = useMutation({
    mutationFn: async (name: string) => {
      const service = await getWorkspaceService();
      const result = await service.deleteWorkspace(name);
      if (!result) return false;
      return name;
    },
    onSuccess: (effective: string | false) => {
      if (!effective) return;
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });

  const {
    ContextMenu,
    handleContextMenu,
    setItems,
    height: contextMenuHeight,
  } = useContextMenu();

  // Notify parent of context menu height changes
  useEffect(() => {
    onContextMenuHeightChange?.(contextMenuHeight);
  }, [contextMenuHeight, onContextMenuHeightChange]);

  const handleSwitchWorkspace = useCallback(
    (workspaceName: string) => {
      chrome.windows.getCurrent(w => {
        if (typeof w.id !== 'number') return;
        chrome.runtime.sendMessage({
          type: BackgroundMessageEnum.SWITCH,
          payload: { workspaceName, windowId: w.id },
        });
      });
      queryClient.invalidateQueries({ queryKey: ['activeWorkspaceName'] });
      console.log('Open workspace:', workspaceName);
      onWorkspaceSwitch?.(workspaceName);
    },
    [queryClient, onWorkspaceSwitch]
  );

  const workspaceMenuItems = useCallback(
    (workspace: Workspace) => {
      setItems([
        {
          name: 'Open',
          onClick: () => {
            handleSwitchWorkspace(workspace.name);
          },
        },
        {
          name: 'Delete',
          onClick: () => {
            workspaceMutationDelete.mutate(workspace.name);
            console.log('Delete workspace:', workspace.name);
          },
        },
      ]);
    },
    [handleSwitchWorkspace, setItems, workspaceMutationDelete]
  );

  if (isWorkspaceListPending || isWorkspaceListError) {
    return <section id='workspaces-list' />;
  }

  return (
    <section
      id='workspaces-list'
      style={{
        display: 'flex',
        flexDirection: 'row',
      }}
    >
      <div>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          Select
        </span>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: '4px',
            fontSize: '18px',
            flexWrap: 'wrap',
          }}
        >
          {workspaceList.map(wk => (
            <div
              key={wk.name}
              onContextMenu={e => {
                if (activeWorkspace === undefined) return;
                const isActiveInOtherWindow =
                  wk.name in allActiveWorkspaces && wk.name !== activeWorkspace;
                if (isActiveInOtherWindow) return;
                workspaceMenuItems(wk);
                handleContextMenu(e);
              }}
            >
              <WorkspaceButton
                className={
                  wk.name === activeWorkspace
                    ? 'workspace-button-active'
                    : wk.name in allActiveWorkspaces
                    ? 'workspace-button-blocked'
                    : activeWorkspace === undefined
                    ? 'workspace-button-disable'
                    : ''
                }
                logo={wk.logo}
                onClick={() => {
                  const isActiveInOtherWindow =
                    wk.name in allActiveWorkspaces &&
                    wk.name !== activeWorkspace;
                  if (activeWorkspace !== undefined && !isActiveInOtherWindow) {
                    handleSwitchWorkspace(wk.name);
                  }
                }}
              />
            </div>
          ))}
        </div>
      </div>
      <div>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          Create
        </span>
        <div
          style={{
            fontSize: '18px',
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'center',
          }}
        >
          <WorkspaceButton logo='fi fi-rr-add' onClick={onAddWorkspace} />
        </div>
      </div>
      <ContextMenu />
    </section>
  );
};
