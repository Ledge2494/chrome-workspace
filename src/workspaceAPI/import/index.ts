import { importFromJson001 } from './0.0.1';
import { importFromJson002 } from './0.0.2';
import { UnknownParsedSchema } from './schemas';
import { StoredState, Workspace } from '../workspaceType';
import { getWorkspaceService } from '../workspaceRuntime';
import { z } from 'zod';

interface ImportOptions {
  writeToState?: boolean; // Whether to write the imported state back to storage
  mode?: 'merge' | 'replace';
}

/**
 * Version converter functions that convert from version X to version X+1
 * Map of starting version -> converter function
 */
const importers = {
  '0.0.1': importFromJson001,
  '0.0.2': importFromJson002,
} as const;

/**
 * Import workspaces from JSON
 * Automatically detects the version and runs converters sequentially from file version to current
 * @throws {Error} if the JSON structure is invalid or unsupported version
 */
export async function importFromJson(
  json: string,
  opts?: ImportOptions
): Promise<StoredState | Workspace[] | null> {
  const parsed = JSON.parse(json) as unknown;
  if (!parsed) return null;
  let payload = UnknownParsedSchema.parse(parsed);
  const sourceVersion = payload?.version || '0.0.1';

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
      try {
        payload = await converter(payload);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const issues = error.issues || [];
          const errorMessages = issues
            .map(e => {
              const path = Array.isArray(e.path)
                ? e.path.join('.')
                : e.path || '';
              return `${path}: ${e.message}`;
            })
            .filter((msg: string) => msg.trim())
            .join(', ');
          const message = errorMessages || 'Invalid JSON structure';
          throw new Error(
            `Invalid JSON structure at version ${currentVer}: ${message}`
          );
        }
        throw error;
      }
    }
  }

  // From this point on, payload is of type StoredState

  if (!payload) return null;
  if (opts?.writeToState !== false) {
    const service = await getWorkspaceService();
    await service.applyImportedState(
      payload as unknown as StoredState,
      opts?.mode || 'merge'
    );
    return Object.values((payload as unknown as StoredState).workspaces);
  }

  // Return the final import with the converted payload
  return payload as unknown as StoredState;
}

export default { importFromJson };
