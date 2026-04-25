import { SettingsSchema } from './settingsType';

export const defaultSettings: SettingsSchema = {
  workspace: {
    enableTabGroups: {
      name: 'enableTabGroups',
      defaultValue: false,
      description: 'Enable or disable tab groups in the workspace',
      type: 'boolean',
    },
  },
};
