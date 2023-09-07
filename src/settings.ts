import { App, Notice, PluginSettingTab, requestUrl, Setting } from 'obsidian'
import SharePlugin from './main'
import { hash } from './crypto'

export interface ShareSettings {
  uid: string;
  email: string;
  apiKey: string;
  yamlField: string;
  noteWidth: string;
  showFooter: boolean;
  removeYaml: boolean;
}

export const DEFAULT_SETTINGS: ShareSettings = {
  uid: '',
  email: '',
  apiKey: '',
  yamlField: 'share',
  noteWidth: '700px',
  showFooter: true,
  removeYaml: true
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
            new Notice('An API key has been sent to ' + this.plugin.settings.email, 3000)
            await this.plugin.api.post('/signup', {
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

    // Strip frontmatter
    new Setting(containerEl)
      .setName('Remove frontmatter/YAML')
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
  }
}
