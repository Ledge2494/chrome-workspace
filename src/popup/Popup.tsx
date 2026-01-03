import '@flaticon/flaticon-uicons/css/regular/rounded.css';
import './style.css';
import { useState } from 'preact/compat';
import { WorkspaceList } from './components/WorkspaceList';
import { WorkspaceCreate } from './components/WorkspaceCreate';
import { WorkspaceExtra } from './components/WorkspaceExtra';

import '@src/theme/dark/chrome.css';

const Popup = () => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [contextMenuHeight, setContextMenuHeight] = useState(0);

  const toggleCreateWorkspaceForm = () => {
    setShowCreateForm(prev => !prev);
  };

  return (
    <main
      style={{
        minWidth: '212px',
        maxWidth: '800px',
        minHeight: `${contextMenuHeight}px`,
        maxHeight: '600px',
      }}
    >
      <WorkspaceList
        onAddWorkspace={toggleCreateWorkspaceForm}
        onContextMenuHeightChange={setContextMenuHeight}
      />
      <WorkspaceExtra />
      <WorkspaceCreate
        isVisible={showCreateForm}
        onClose={toggleCreateWorkspaceForm}
      />
    </main>
  );
};

export default Popup;
