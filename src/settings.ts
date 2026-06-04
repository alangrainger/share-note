import { App, Plugin, PluginSettingTab, Setting, TextComponent } from 'obsidian'
import { buildFieldKey, YamlField } from './domain/field-keys'
import { SettingsStore } from './shared/settings-store'

export enum ThemeMode {
  'Same as theme',
  Dark,
  Light
}

export enum TitleSource {
  'Note title',
  'First H1',
  'Frontmatter property'
}

export interface ShareSettings {
  server: string;
  uid: string;
  apiKey: string;
  yamlField: string;
  noteWidth: string;
  theme: string; // The name of the theme stored on the server
  themeMode: ThemeMode;
  titleSource: TitleSource;
  removeYaml: boolean;
  removeBacklinksFooter: boolean;
  removeElements: string;
  expiry: string;
  clipboard: boolean;
  shareUnencrypted: boolean;
  authRedirect: string | null;
  debug: number;
}

export const DEFAULT_SETTINGS: ShareSettings = {
  server: 'https://api.note.sx',
  uid: '',
  apiKey: '',
  yamlField: 'share',
  noteWidth: '',
  theme: '',
  themeMode: ThemeMode['Same as theme'],
  titleSource: TitleSource['Note title'],
  removeYaml: true,
  removeBacklinksFooter: true,
  removeElements: '',
  expiry: '',
  clipboard: true,
  shareUnencrypted: false,
  authRedirect: null,
  debug: 0
}

export class ShareSettingsTab extends PluginSettingTab {
  apikeyEl?: TextComponent
  // Ephemeral - resets when Obsidian restarts. The "Danger / Advanced"
  // section must be re-opened explicitly each session.
  private showAdvanced = false

  constructor (
    app: App,
    plugin: Plugin,
    private readonly settingsStore: SettingsStore
  ) {
    super(app, plugin)
  }

  private get settings () {
    return this.settingsStore.data
  }

  private async saveSettings () {
    await this.settingsStore.save()
  }

  private fieldKey (key: YamlField) {
    return buildFieldKey(this.settings.yamlField, key)
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
          window.open(this.settings.server + '/v1/account/get-key?id=' + this.settings.uid)
        }))
      .addText(inputEl => {
        this.apikeyEl = inputEl // so we can update it with the API key during the URI callback
        inputEl
          .setPlaceholder('API key')
          .setValue(this.settings.apiKey)
          .onChange(async (value) => {
            this.settings.apiKey = value
            await this.saveSettings()
          })
      })

    // Local YAML field
    new Setting(containerEl)
      .setName('Frontmatter property prefix')
      .setDesc('The frontmatter property for storing the shared link and updated time. A value of `share` will create frontmatter fields of `share_link` and `share_updated`.')
      .addText(text => text
        .setPlaceholder(DEFAULT_SETTINGS.yamlField)
        .setValue(this.settings.yamlField)
        .onChange(async (value) => {
          this.settings.yamlField = value || DEFAULT_SETTINGS.yamlField
          await this.saveSettings()
        }))

    new Setting(containerEl)
      .setName('Sharing')
      .setHeading()

    new Setting(containerEl)
      .setName(`⭐ Your shared note theme is "${this.settings.theme || 'Obsidian default theme'}"`)
      .setDesc('To set a new theme, change the theme in Obsidian to your desired theme and then use the `Force re-upload all data` command. You can change your Obsidian theme after that without affecting the theme for your shared notes.')
      .then(setting => addDocs(setting, 'https://docs.note.sx/notes/theme'))

    // Choose light/dark theme mode
    new Setting(containerEl)
      .setName('Light/dark mode')
      .setDesc('Choose the mode with which your files will be shared')
      .addDropdown(dropdown => {
        dropdown
          .addOption('Same as theme', 'Same as theme')
          .addOption('Dark', 'Dark')
          .addOption('Light', 'Light')
          .setValue(ThemeMode[this.settings.themeMode])
          .onChange(async value => {
            this.settings.themeMode = ThemeMode[value as keyof typeof ThemeMode]
            await this.saveSettings()
          })
      })

    // Copy to clipboard
    new Setting(containerEl)
      .setName('Copy the link to clipboard after sharing')
      .addToggle(toggle => {
        toggle
          .setValue(this.settings.clipboard)
          .onChange(async (value) => {
            this.settings.clipboard = value
            await this.saveSettings()
          })
      })

    new Setting(containerEl)
      .setName('Note display')
      .setHeading()

    // Title source
    const defaultTitleDesc = 'Select the location to source the published note title. It will default to the note title if nothing is found for the selected option.'
    const titleSetting = new Setting(containerEl)
      .setName('Note title source')
      .setDesc(defaultTitleDesc)
      .addDropdown(dropdown => {
        for (const enumKey in TitleSource) {
          if (isNaN(Number(enumKey))) {
            dropdown.addOption(enumKey, enumKey)
          }
        }
        dropdown
          .setValue(TitleSource[this.settings.titleSource])
          .onChange(async value => {
            this.settings.titleSource = TitleSource[value as keyof typeof TitleSource]
            if (this.settings.titleSource === TitleSource['Frontmatter property']) {
              titleSetting.setDesc('Set the title you want to use in a frontmatter property called `' + this.fieldKey(YamlField.title) + '`')
            } else {
              titleSetting.setDesc(defaultTitleDesc)
            }
            await this.saveSettings()
          })
      })

    // Note reading width
    new Setting(containerEl)
      .setName('Note reading width')
      .setDesc('The max width for the content of your shared note, accepts any CSS unit. Leave this value empty if you want to use the theme\'s width.')
      .addText(text => text
        .setValue(this.settings.noteWidth)
        .onChange(async (value) => {
          this.settings.noteWidth = value
          await this.saveSettings()
        }))

    // Strip frontmatter
    new Setting(containerEl)
      .setName('Remove published frontmatter/YAML')
      .setDesc('Remove frontmatter/YAML/properties from the shared note')
      .addToggle(toggle => {
        toggle
          .setValue(this.settings.removeYaml)
          .onChange(async (value) => {
            this.settings.removeYaml = value
            await this.saveSettings()
          })
      })

    // Strip backlinks footer
    new Setting(containerEl)
      .setName('Remove backlinks footer')
      .setDesc('Remove backlinks footer from the shared note')
      .addToggle(toggle => {
        toggle
          .setValue(this.settings.removeBacklinksFooter)
          .onChange(async (value) => {
            this.settings.removeBacklinksFooter = value
            await this.saveSettings()
          })
      })

    // Strip elements by selector
    new Setting(containerEl)
      .setName('Remove custom elements')
      .setDesc('Remove elements before sharing by targeting them with CSS selectors. One selector per line.')
      .addTextArea(text => {
        text
          .setPlaceholder('.class-to-remove')
          .setValue(this.settings.removeElements)
          .onChange(async (value) => {
            this.settings.removeElements = value
            await this.saveSettings()
          })
      })

    // Share encrypted by default
    new Setting(containerEl)
      .setName('Share as encrypted by default')
      .setDesc('If you turn this off, you can enable encryption for individual notes by adding a `share_encrypted` checkbox into a note and ticking it.')
      .addToggle(toggle => {
        toggle
          .setValue(!this.settings.shareUnencrypted)
          .onChange(async (value) => {
            this.settings.shareUnencrypted = !value
            await this.saveSettings()
          })
      })
      .then(setting => addDocs(setting, 'https://docs.note.sx/notes/encryption'))

    // Default note expiry
    new Setting(containerEl)
      .setName('Default note expiry')
      .setDesc('If you want, your notes can auto-delete themselves after a period of time. You can set this as a default for all notes here, or you can set it on a per-note basis.')
      .addText(text => text
        .setValue(this.settings.expiry)
        .onChange(async (value) => {
          this.settings.expiry = value
          await this.saveSettings()
        }))
      .then(setting => addDocs(setting, 'https://docs.note.sx/notes/self-deleting-notes'))

    // Danger / Advanced
    new Setting(containerEl)
      .setName('Danger / advanced')
      .setHeading()

    new Setting(containerEl)
      .setName('Show advanced options')
      .setDesc('Reveal advanced fields. Changing these can break your shared notes.')
      .addToggle(toggle => {
        toggle
          .setValue(this.showAdvanced)
          .onChange((value) => {
            this.showAdvanced = value
            // eslint-disable-next-line @typescript-eslint/no-deprecated
            this.display()
          })
      })

    if (this.showAdvanced) {
      // UID (read-only)
      new Setting(containerEl)
        .setName('User ID')
        .setDesc('Your user ID for the server. Read-only.')
        .addText(text => {
          text
            .setValue(this.settings.uid)
            .setDisabled(true)
        })

      // Server URL
      new Setting(containerEl)
        .setName('Server URL')
        .setDesc(`The API server used to create shared notes. Default: ${DEFAULT_SETTINGS.server}`)
        .addText(text => {
          text
            .setPlaceholder(DEFAULT_SETTINGS.server)
            .setValue(this.settings.server)
            .onChange(async (value) => {
              this.settings.server = value || DEFAULT_SETTINGS.server
              await this.saveSettings()
            })
        })
    }
  }
}

function addDocs (setting: Setting, url: string) {
  setting.descEl.createEl('br')
  setting.descEl.createEl('a', {
    text: 'View the documentation',
    href: url
  })
}
