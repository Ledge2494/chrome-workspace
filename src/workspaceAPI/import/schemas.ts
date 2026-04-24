import { z } from 'zod';

// Schema for tab group color enum (Chrome API)
const ColorEnum = z.enum([
  'grey',
  'blue',
  'red',
  'yellow',
  'green',
  'pink',
  'purple',
  'cyan',
  'orange',
]);

// Schema for StoredGroup
export const StoredGroupSchema = z.object({
  title: z.string().nullable().optional(),
  color: ColorEnum.nullable().optional(),
  collapsed: z.boolean().optional(),
});

// Schema for StoredTab
export const StoredTabSchema = z.object({
  url: z.string().optional(),
  title: z.string().optional(),
  pinned: z.boolean().optional(),
  active: z.boolean().optional(),
  index: z.number().optional(),
  favIconUrl: z.string().optional(),
  discarded: z.boolean().optional(),
  groupIndex: z.number().nullable().optional(),
});

// Schema for Workspace
export const WorkspaceSchema = z.object({
  logo: z.string(),
  name: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  tabs: z.array(StoredTabSchema),
  groups: z.array(StoredGroupSchema),
});

export const UnknownParsedSchema = z
  .object({
    version: z
      .string()
      .regex(
        /^[0-9]+\.[0-9]+\.[0-9]+$/,
        'Version must be in format X.Y.Z where X, Y, and Z are numbers'
      )
      .optional(),
  })
  .loose();

// Schema for ImportPayload001 (legacy format)
export const ImportPayload001Schema = z.object({
  activeWorkspaceName: z.string(),
  workspaces: z.record(z.string(), WorkspaceSchema),
});

// Schema for ImportPayload002 (current format)
export const ImportPayload002Schema = z.object({
  version: z.string(),
  workspaces: z.record(z.string(), WorkspaceSchema),
  activeWorkspaces: z.record(z.string(), z.number()).optional(),
  workspaceOrder: z.array(z.string()),
});

// Type exports for TypeScript
export type ImportPayload001 = z.infer<typeof ImportPayload001Schema>;
export type ImportPayload002 = z.infer<typeof ImportPayload002Schema>;
