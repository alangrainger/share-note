import { App, PluginSettingTab, Setting, TextComponent } from 'obsidian'
import SharePlugin from './main'

export enum ThemeMode {
  'Same as theme',
  Dark,
  Light
}

export interface ShareSettings {
  server: string;
  uid: string;
  apiKey: string;
  yamlField: string;
  noteWidth: string;
  themeMode: ThemeMode;
  removeYaml: boolean;
  clipboard: boolean;
  shareUnencrypted: boolean;
}

export const DEFAULT_SETTINGS: ShareSettings = {
  server: 'https://api.note.sx',
  uid: '',
  apiKey: '',
  yamlField: 'share',
  noteWidth: '',
  themeMode: ThemeMode['Same as theme'],
  removeYaml: true,
  clipboard: true,
  shareUnencrypted: false
}

export class ShareSettingsTab extends PluginSettingTab {
  plugin: SharePlugin
  apikeyEl: TextComponent

  constructor (app: App, plugin: SharePlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  display (): void {
    const { containerEl } = this

    containerEl.empty()

    // API key
    new Setting(containerEl)
      .setName('API key')
      .setDesc('Click the button to request a new API key')
      .addButton(btn => btn
        .setButtonText('Connect plugin')
        .setCta()
        .onClick(() => {
          window.open(this.plugin.settings.server + '/v1/account/get-key?id=' + this.plugin.settings.uid)
        }))
      .addText(inputEl => {
        this.apikeyEl = inputEl // so we can update it with the API key during the URI callback
        inputEl
          .setPlaceholder('API key')
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value
            await this.plugin.saveSettings()
          })
      })

    // Local YAML field
    new Setting(containerEl)
      .setName('Frontmatter property prefix')
      .setDesc('The frontmatter property for storing the shared link and updated time. A value of `share` will create frontmatter fields of `share_link` and `share_updated`.')
      .addText(text => text
        .setPlaceholder(DEFAULT_SETTINGS.yamlField)
        .setValue(this.plugin.settings.yamlField)
        .onChange(async (value) => {
          this.plugin.settings.yamlField = value || DEFAULT_SETTINGS.yamlField
          await this.plugin.saveSettings()
        }))

    new Setting(containerEl)
      .setName('Upload options')
      .setHeading()

    // Choose light/dark theme mode
    new Setting(containerEl)
      .setName('Light/Dark mode')
      .setDesc('Choose the mode with which your files will be shared')
      .addDropdown(dropdown => {
        dropdown
          .addOption('Same as theme', 'Same as theme')
          .addOption('Dark', 'Dark')
          .addOption('Light', 'Light')
          .setValue(ThemeMode[this.plugin.settings.themeMode])
          .onChange(async value => {
            this.plugin.settings.themeMode = ThemeMode[value as keyof typeof ThemeMode]
            await this.plugin.saveSettings()
          })
      })

    // Note reading width
    new Setting(containerEl)
      .setName('Note reading width')
      .setDesc('The max width for the content of your shared note, accepts any CSS unit. Leave this value empty if you want to use the theme\'s width.')
      .addText(text => text
        .setValue(this.plugin.settings.noteWidth)
        .onChange(async (value) => {
          this.plugin.settings.noteWidth = value
          await this.plugin.saveSettings()
        }))

    // Strip frontmatter
    new Setting(containerEl)
      .setName('Remove published frontmatter/YAML')
      .setDesc('Remove frontmatter/YAML/properties from the shared note')
      .addToggle(toggle => {
        toggle
          .setValue(this.plugin.settings.removeYaml)
          .onChange(async (value) => {
            this.plugin.settings.removeYaml = value
            await this.plugin.saveSettings()
            this.display()
          })
      })

    // Copy to clipboard
    new Setting(containerEl)
      .setName('Copy the link to clipboard after sharing')
      .addToggle(toggle => {
        toggle
          .setValue(this.plugin.settings.clipboard)
          .onChange(async (value) => {
            this.plugin.settings.clipboard = value
            await this.plugin.saveSettings()
            this.display()
          })
      })

    // Share encrypted by default
    new Setting(containerEl)
      .setName('Share as encrypted by default')
      .setDesc('If you turn this off, you can enable encryption for individual notes by adding a `share_encrypted` checkbox into a note and ticking it.')
      .addToggle(toggle => {
        toggle
          .setValue(!this.plugin.settings.shareUnencrypted)
          .onChange(async (value) => {
            this.plugin.settings.shareUnencrypted = !value
            await this.plugin.saveSettings()
            this.display()
          })
      })

    new Setting(containerEl)
      .setName('Debug info')
      .setHeading()

    new Setting(containerEl)
      .setName('User ID')
      .setDesc('If you need it for debugging purposes, this is your user ID')
      .addText(text => text
        .setValue(this.plugin.settings.uid)
        .setDisabled(true))
  }
}
