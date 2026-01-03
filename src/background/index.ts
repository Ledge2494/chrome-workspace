import { createDefaultWorkspace } from '@src/workspaceAPI/create';
import {
  installAutoSaveListeners,
  installBackgroundListeners,
} from '@src/workspaceAPI/listener';

// Setup auto-save listeners
installAutoSaveListeners();
console.debug('Auto-save listeners installed');

installBackgroundListeners();
console.debug('Background listeners installed');

// Create a default workspace on background load
createDefaultWorkspace();
console.debug('Default workspace creation attempted');

console.log('background loaded');
