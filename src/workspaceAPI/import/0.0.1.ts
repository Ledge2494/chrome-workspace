import { ImportPayload001Schema, ImportPayload002 } from './schemas';

/**
 * Converter for version 0.0.1 -> 0.0.2
 * Converts the format from 0.0.1 to 0.0.2 (no state writes)
 * @throws {z.ZodError} if the payload structure is invalid
 */
async function importFromJson001(payload: unknown): Promise<ImportPayload002> {
  // Validate and parse the incoming payload
  const validatedPayload = ImportPayload001Schema.parse(payload);

  const incomingWorkspaces = validatedPayload.workspaces;
  const workspaceOrder = Object.keys(incomingWorkspaces);

  return {
    version: '0.0.2',
    workspaces: incomingWorkspaces,
    workspaceOrder,
  };
}

export { importFromJson001 };
