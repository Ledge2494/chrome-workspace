import { SettingItemDescriptor, SettingsSchema } from './settingsType';
import { defaultSettings } from './settingsDefault';

export class SettingsHandler {
  private schema: SettingsSchema;

  constructor() {
    this.schema = this.defaultSettings();
    this.loadSettings();
  }

  private defaultSettings(): SettingsSchema {
    const exploitableSettings: SettingsSchema = defaultSettings;
    Object.values(defaultSettings).forEach(category => {
      Object.values(category as Record<string, SettingItemDescriptor<unknown>>)
        .filter(setting => setting.value === undefined)
        .forEach(setting => {
          setting.value = setting.defaultValue;
        });
    });
    return exploitableSettings;
  }

  private loadSettings() {
    // Load settings from storage (e.g., localStorage or browser.storage)
    // placeholder for actual implementation
  }

  private saveSettings() {
    // Implement saving settings to storage (e.g., localStorage or browser.storage)
    // placeholder for actual implementation
  }

  public getSetting(): Readonly<SettingsSchema> {
    return this.schema;
  }
}
