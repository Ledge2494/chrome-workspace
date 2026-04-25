export interface SettingItemDescriptor<T> {
  // The unique name of the setting, used for storage and retrieval
  name: string;
  // The default value of the setting
  defaultValue: T;
  // A human-readable description of the setting
  description: string;
  // The type of the setting (e.g., "string", "number", "boolean")
  type: string;
  // Optional: A list of allowed values for the setting (for enum-like settings)
  allowedValues?: T[];
  // Current value of the setting, which can be updated by the user
  value?: T;
}

export interface SettingsSchema {
  // A mapping of category name to an array of settings in that category
  workspace: {
    enableTabGroups: SettingItemDescriptor<boolean>;
  };
}
