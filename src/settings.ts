import { App, PluginSettingTab, Setting, TextComponent } from 'obsidian'
import SharePlugin from './main'

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

export enum YamlField {
  link,
  updated,
  encrypted,
  unencrypted,
  title,
  expires
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

    new Setting(containerEl)
      .setName(`⭐ Your shared note theme is "${this.plugin.settings.theme || 'Obsidian default theme'}"`)
      .setDesc('To set a new theme, change the theme in Obsidian to your desired theme and then use the `Force re-upload all data` command. You can change your Obsidian theme after that without affecting the theme for your shared notes.')
      .then(setting => addDocs(setting, 'https://docs.note.sx/notes/theme'))

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

    // Copy to clipboard
    new Setting(containerEl)
      .setName('Copy the link to clipboard after sharing')
      .addToggle(toggle => {
        toggle
          .setValue(this.plugin.settings.clipboard)
          .onChange(async (value) => {
            this.plugin.settings.clipboard = value
            await this.plugin.saveSettings()
          })
      })

    new Setting(containerEl)
      .setName('Note options')
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
          .setValue(TitleSource[this.plugin.settings.titleSource])
          .onChange(async value => {
            this.plugin.settings.titleSource = TitleSource[value as keyof typeof TitleSource]
            if (this.plugin.settings.titleSource === TitleSource['Frontmatter property']) {
              titleSetting.setDesc('Set the title you want to use in a frontmatter property called `' + this.plugin.field(YamlField.title) + '`')
            } else {
              titleSetting.setDesc(defaultTitleDesc)
            }
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
          })
      })

    // Strip backlinks footer
    new Setting(containerEl)
      .setName('Remove backlinks footer')
      .setDesc('Remove backlinks footer from the shared note')
      .addToggle(toggle => {
        toggle
          .setValue(this.plugin.settings.removeBacklinksFooter)
          .onChange(async (value) => {
            this.plugin.settings.removeBacklinksFooter = value
            await this.plugin.saveSettings()
          })
      })

    // Strip elements by selector
    new Setting(containerEl)
      .setName('Remove custom elements')
      .setDesc('Remove elements before uploading by targeting them with CSS selectors. One selector per line.')
      .addTextArea(text => {
        text
          .setPlaceholder('div.class-to-remove')
          .setValue(this.plugin.settings.removeElements)
          .onChange(async (value) => {
            this.plugin.settings.removeElements = value
            await this.plugin.saveSettings()
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
          })
      })
      .then(setting => addDocs(setting, 'https://docs.note.sx/notes/encryption'))

    // Default note expiry
    new Setting(containerEl)
      .setName('Default note expiry')
      .setDesc('If you want, your notes can auto-delete themselves after a period of time. You can set this as a default for all notes here, or you can set it on a per-note basis.')
      .addText(text => text
        .setValue(this.plugin.settings.expiry)
        .onChange(async (value) => {
          this.plugin.settings.expiry = value
          await this.plugin.saveSettings()
        }))
      .then(setting => addDocs(setting, 'https://docs.note.sx/notes/self-deleting-notes'))
  }
}

function addDocs (setting: Setting, url: string) {
  setting.descEl.createEl('br')
  setting.descEl.createEl('a', {
    text: 'View the documentation',
    href: url
  })
}
