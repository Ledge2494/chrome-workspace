import { Menu, MenuItem } from '@szhsin/react-menu';
import { useQuery } from '@tanstack/react-query';
import { exportSingleWorkspace } from '@src/workspaceAPI/export';
import { getActiveWorkspaceName } from '@src/workspaceAPI/toolbox';
import '../style.css';

export const WorkspaceExtra = () => {
  const { data: activeWorkspace } = useQuery({
    queryKey: ['activeWorkspaceName'],
    queryFn: getActiveWorkspaceName,
  });

  const handleImportClick = async () => {
    // Open the import page in a new window
    chrome.tabs.create({
      url: '/src/import-page/index.html',
    });
  };

  const handleExport = async () => {
    if (!activeWorkspace) {
      console.error('No active workspace to export');
      return;
    }

    try {
      const jsonContent = await exportSingleWorkspace(activeWorkspace);

      // Create blob and download
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `workspace-${activeWorkspace}-${Date.now()}.json`;
      link.click();

      URL.revokeObjectURL(url);
      console.log('Workspace exported successfully:', activeWorkspace);
    } catch (error) {
      console.error('Failed to export workspace:', error);
    }
  };

  return (
    <section id='workspace-extra' style={{ display: 'flex' }}>
      <Menu
        menuButton={
          <button
            style={{
              marginLeft: 'auto',
            }}
          >
            <i className='fi fi-rr-angle-small-down' />
          </button>
        }
        menuClassName='extra-options-menu'
      >
        <MenuItem
          className='extra-options-menu-item'
          onClick={handleImportClick}
        >
          Import new ...
        </MenuItem>
        <MenuItem className='extra-options-menu-item' onClick={handleExport}>
          Export current ...
        </MenuItem>
      </Menu>
    </section>
  );
};
