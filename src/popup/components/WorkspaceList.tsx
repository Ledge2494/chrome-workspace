import { useCallback, useEffect } from 'preact/compat';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { WorkspaceButton } from '../../components/workspaceButton/WorkspaceButton';
import { listWorkspaces } from '@src/workspaceAPI/list';
import { deleteWorkspace } from '@src/workspaceAPI/delete';
import { Workspace } from '@src/workspaceAPI/workspaceType';
import { getActiveWorkspaceName } from '@src/workspaceAPI/toolbox';
import { BackgroundMessageEnum } from '@src/workspaceAPI/listener';
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
    queryFn: listWorkspaces,
  });

  const {
    isPending: isActiveWorkspacePending,
    isError: isActiveWorkspaceError,
    data: activeWorkspace,
  } = useQuery({
    queryKey: ['activeWorkspaceName'],
    queryFn: getActiveWorkspaceName,
  });

  const workspaceMutationDelete = useMutation({
    mutationFn: async (name: string) => {
      const result = await deleteWorkspace(name);
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
      chrome.runtime.sendMessage({
        type: BackgroundMessageEnum.SWITCH,
        payload: { workspaceName },
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

  if (
    isWorkspaceListPending ||
    isWorkspaceListError ||
    isActiveWorkspacePending ||
    isActiveWorkspaceError
  ) {
    return null;
  }

  return (
    <section
      id='workspaces-list'
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: '4px',
        fontSize: '18px',
      }}
    >
      {workspaceList.map(wk => (
        <div
          key={wk.name}
          onContextMenu={e => {
            workspaceMenuItems(wk);
            handleContextMenu(e);
          }}
        >
          <WorkspaceButton
            className={
              wk.name === activeWorkspace ? 'workspace-button-active' : ''
            }
            logo={wk.logo}
            onClick={() => handleSwitchWorkspace(wk.name)}
          />
        </div>
      ))}
      <WorkspaceButton
        logo='fi fi-rr-add'
        style={{ marginLeft: '12px' }}
        onClick={onAddWorkspace}
      />
      <ContextMenu />
    </section>
  );
};
