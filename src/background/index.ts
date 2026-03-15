import {
  installAutoSaveListeners,
  installBackgroundListeners,
} from '@src/workspaceAPI/listener';
import { updateState } from '@src/workspaceAPI/update';
import {
  isSessionRestart,
  restoreAllWorkspacesAfterRestart,
} from '@src/workspaceAPI/restore';

// Run Update process to convert old workspace formats to the current format on background load
(async () => {
  await updateState();
  console.debug('State update process completed');

  // Setup auto-save listeners
  await installAutoSaveListeners();
  console.debug('Auto-save listeners installed');

  await installBackgroundListeners();
  console.debug('Background listeners installed');

  // Check for session restart and restore workspaces if needed
  try {
    const isRestart = await isSessionRestart();
    if (isRestart) {
      console.log('Session restart detected, triggering workspace restoration');
      await restoreAllWorkspacesAfterRestart();
    } else {
      console.debug('No session restart detected');
    }
  } catch (err) {
    console.error('Error during session restart check:', err);
  }

  console.log('background loaded');
})();
