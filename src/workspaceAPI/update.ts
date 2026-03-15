import { readState, writeState } from './toolbox';
import { importFromJson } from './import';
import { StoredState } from './workspaceType';
import packageJson from '../../package.json';

/**
 * Update the stored state by running it through the importer process.
 * This ensures the state is migrated to the current version.
 */
export async function updateState(): Promise<void> {
  // Read the current state
  const state = await readState();

  if (state.version === packageJson.version) {
    console.debug('State is already at the current version. No update needed.');
    return;
  }

  // Convert the state to JSON for the importer process
  const stateJson = JSON.stringify(state);

  // Run through the importer process to migrate to current version
  const updatedState = await importFromJson(stateJson, { writeToState: false });

  if (!updatedState) {
    console.error(
      'Failed to update state: importer returned null or undefined'
    );
    return;
  }

  // updatedState is guaranteed to be of type StoredState at this point

  // Write the updated state back to storage
  await writeState(updatedState as StoredState);
}

export default { updateState };
