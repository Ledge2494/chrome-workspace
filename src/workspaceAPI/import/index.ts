import { importFromJson001 } from './0.0.1';
import { importFromJson002 } from './0.0.2';
import packageJson from '../../../package.json';
import { StoredState, Workspace } from '../workspaceType';
import { getWorkspaceService } from '../workspaceRuntime';

interface ImportPayload {
  version?: string;
  [key: string]: unknown;
}

interface ImportOptions {
  // Define any options needed for the import process
  writeToState?: boolean; // Whether to write the imported state back to storage
  mode?: 'merge' | 'replace';
}

type versionedImportPayloads =
  | Awaited<ReturnType<typeof importFromJson001>>
  | Awaited<ReturnType<typeof importFromJson002>>
  | StoredState;

/**
 * Version converter functions that convert from version X to version X+1
 * Map of starting version -> converter function
 */
const importers = {
  '0.0.1': importFromJson001,
  '0.0.2': importFromJson002,
} as const;

const currentImporterVersion = importFromJson002;

/**
 * Import workspaces from JSON
 * Automatically detects the version and runs converters sequentially from file version to current
 */
export async function importFromJson(
  json: string,
  opts?: ImportOptions
): Promise<StoredState | Workspace[] | null> {
  const parsed = JSON.parse(json) as ImportPayload;
  if (!parsed) return null;

  const sourceVersion = parsed?.version || '0.0.1';

  let payload: versionedImportPayloads | ImportPayload = parsed;
  // Get the sequence of versions to convert through
  if (sourceVersion === packageJson.version) {
    // No conversion needed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload = await currentImporterVersion(payload as any); // set this to any to avoid type issues with the versioned payloads
  } else {
    // Get version sequence
    const versionSequence = Object.keys(importers);
    const sourceIndex = versionSequence.indexOf(sourceVersion);
    if (sourceIndex === -1) {
      throw new Error(`Unsupported import version: ${sourceVersion}`);
    }

    // Run converters sequentially from source version to current version
    for (let i = sourceIndex; i < versionSequence.length - 1; i++) {
      const currentVer = versionSequence[i] as keyof typeof importers;
      const converter = importers[currentVer];
      if (converter) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payload = await converter(payload as any); // set this to any to avoid type issues with the versioned payloads
      }
    }
  }

  // From this point on, payload is of type StoredState

  if (!payload) return null;
  if (opts?.writeToState !== false) {
    const service = await getWorkspaceService();
    await service.applyImportedState(
      payload as StoredState,
      opts?.mode || 'merge'
    );
    return Object.values((payload as StoredState).workspaces);
  }

  // Return the final import with the converted payload
  return payload as StoredState;
}

export default { importFromJson };
