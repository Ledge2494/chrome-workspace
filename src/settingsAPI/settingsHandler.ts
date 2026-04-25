import { SettingsSchema } from './settingsType';
import { defaultSettings } from './settingsDefault';

export class SettingsHandler {
  private schema: SettingsSchema = defaultSettings;

  constructor() {
    this.loadSettings();
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
