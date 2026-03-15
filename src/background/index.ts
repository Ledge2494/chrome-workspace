import { createDefaultWorkspace } from '@src/workspaceAPI/create';
import {
  installAutoSaveListeners,
  installBackgroundListeners,
} from '@src/workspaceAPI/listener';
import { updateState } from '@src/workspaceAPI/update';

// Run Update process to convert old workspace formats to the current format on background load
(async () => {
  await updateState();
  console.debug('State update process completed');

  // Setup auto-save listeners
  await installAutoSaveListeners();
  console.debug('Auto-save listeners installed');

  await installBackgroundListeners();
  console.debug('Background listeners installed');

  // Create a default workspace on background load
  await createDefaultWorkspace();
  console.debug('Default workspace creation attempted');
  console.log('background loaded');
})();
