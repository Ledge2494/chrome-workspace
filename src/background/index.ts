import {
  installRuntimeBackgroundListeners,
  getWorkspaceListener,
  getWorkspaceService,
  updateWorkspaceRuntimeState,
} from '@src/workspaceAPI/workspaceRuntime';

// Hook into extension install to initialize workspaces for open windows
chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    console.debug('Extension installed, initializing workspaces');
    getWorkspaceService()
      .then(service => service.initializeWorkspacesForOpenWindows())
      .catch(err => {
        console.error('Error during workspace initialization:', err);
      });
  }
});

// Run Update process to convert old workspace formats to the current format on background load
(async () => {
  await updateWorkspaceRuntimeState();
  console.debug('State update process completed');

  const listener = await getWorkspaceListener();
  // Setup auto-save listeners
  listener.installAutoSaveListeners();
  console.debug('Auto-save listeners installed');

  await installRuntimeBackgroundListeners();
  console.debug('Background listeners installed');

  // Check for session restart and restore workspaces if needed
  try {
    const isRestart = await listener.detectSessionRestart();
    if (isRestart) {
      console.log('Session restart detected, triggering workspace restoration');
      await listener.handleSessionStart();
    } else {
      console.debug('No session restart detected');
    }
  } catch (err) {
    console.error('Error during session restart check:', err);
  }

  console.log('background loaded');
})();
