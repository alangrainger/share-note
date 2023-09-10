import { App, PluginSettingTab, Setting } from 'obsidian'
import SharePlugin from './main'
import { hash } from './crypto'
import StatusMessage from './StatusMessage'

export interface ShareSettings {
  uid: string;
  email: string;
  apiKey: string;
  yamlField: string;
  noteWidth: string;
  showFooter: boolean;
  removeYaml: boolean;
  clipboard: boolean;
}

export const DEFAULT_SETTINGS: ShareSettings = {
  uid: '',
  email: '',
  apiKey: '',
  yamlField: 'share',
  noteWidth: '700px',
  showFooter: true,
  removeYaml: true,
  clipboard: true
}

export class ShareSettingsTab extends PluginSettingTab {
  plugin: SharePlugin

  constructor (app: App, plugin: SharePlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  display (): void {
    const { containerEl } = this

    containerEl.empty()

    // Email address
    new Setting(containerEl)
      .setName('Email address')
      .setDesc('This is not stored on the Share server, it is solely used to send you an API key.')
      .addText(text => text
        .setValue(this.plugin.settings.email)
        .onChange(async (value) => {
          this.plugin.settings.email = value
          // Store a hashed value of the email. This is what we use to communicate with the server.
          this.plugin.settings.uid = await hash(value)
          await this.plugin.saveSettings()
        }))
      .addButton(btn => btn
        .setButtonText('Request API key')
        .setCta()
        .onClick(async () => {
          if (this.plugin.settings.email) {
            new StatusMessage('An API key has been sent to ' + this.plugin.settings.email)
            await this.plugin.api.post('/v1/account/key', {
              email: this.plugin.settings.email
            })
          }
        }))

    // API key
    new Setting(containerEl)
      .setName('API key')
      .setDesc('Enter the key which was sent to you via email.')
      .addText(text => text
        .setValue(this.plugin.settings.apiKey)
        .onChange(async (value) => {
          this.plugin.settings.apiKey = value
          await this.plugin.saveSettings()
        }))

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

    // Show/hide the footer
    new Setting(containerEl)
      .setName('Show the footer')
      .addToggle(toggle => {
        toggle
          .setValue(this.plugin.settings.showFooter)
          .onChange(async (value) => {
            this.plugin.settings.showFooter = value
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
  }
}
