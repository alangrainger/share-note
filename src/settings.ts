import { App, Plugin, PluginSettingTab, Setting, SettingDefinitionItem, TextComponent } from 'obsidian'
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
  includeSource: boolean;
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
  includeSource: false,
  authRedirect: null,
  debug: 0
}

/**
 * Settings whose stored value is a numeric enum but whose dropdown works in
 * label strings. getControlValue/setControlValue translate in both directions.
 */
const ENUM_SETTINGS = {
  themeMode: ThemeMode,
  titleSource: TitleSource
} as const

/** Settings that revert to their default when the user clears the field. */
const EMPTY_FALLBACK: Partial<ShareSettings> = {
  yamlField: DEFAULT_SETTINGS.yamlField,
  server: DEFAULT_SETTINGS.server
}

type SettingKey = keyof ShareSettings

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

  // The declarative controls bind by key. Obsidian would read and write
  // `plugin.settings`; this plugin keeps its settings in SettingsStore, so
  // both accessors are overridden to go through the store instead.
  getControlValue (key: string): unknown {
    const value = this.settings[key as SettingKey]
    const enumType = ENUM_SETTINGS[key as keyof typeof ENUM_SETTINGS]
    return enumType ? enumType[value as number] : value
  }

  async setControlValue (key: string, value: unknown): Promise<void> {
    const enumType = ENUM_SETTINGS[key as keyof typeof ENUM_SETTINGS]
    const fallback = EMPTY_FALLBACK[key as SettingKey]
    let stored = value
    if (enumType) {
      stored = enumType[value as keyof typeof enumType]
    } else if (value === '' && fallback !== undefined) {
      stored = fallback
    }
    Object.assign(this.settings, { [key]: stored })
    await this.saveSettings()
  }

  getSettingDefinitions (): SettingDefinitionItem<SettingKey>[] {
    return [
      {
        name: 'API key',
        desc: 'Click the button to request a new API key',
        render: (setting) => this.renderApiKey(setting)
      },
      {
        name: 'Frontmatter property prefix',
        desc: 'The frontmatter property for storing the shared link and updated time. A value of `share` will create frontmatter fields of `share_link` and `share_updated`.',
        control: { type: 'text', key: 'yamlField', placeholder: DEFAULT_SETTINGS.yamlField }
      },
      {
        type: 'group',
        heading: 'Sharing',
        items: [
          {
            name: `⭐ Your shared note theme is "${this.settings.theme || 'Obsidian default theme'}"`,
            desc: withDocs('To set a new theme, change the theme in Obsidian to your desired theme and then use the `Force re-upload all data` command. You can change your Obsidian theme after that without affecting the theme for your shared notes.', 'https://docs.note.sx/notes/theme')
          },
          {
            name: 'Light/dark mode',
            desc: 'Choose the mode with which your files will be shared',
            control: { type: 'dropdown', key: 'themeMode', options: enumOptions(ThemeMode) }
          },
          {
            name: 'Copy the link to clipboard after sharing',
            control: { type: 'toggle', key: 'clipboard' }
          }
        ]
      },
      {
        type: 'group',
        heading: 'Note display',
        items: [
          {
            name: 'Note title source',
            desc: 'Select the location to source the published note title. It will default to the note title if nothing is found for the selected option. For "Frontmatter property", set the title in a property called `' + this.fieldKey(YamlField.title) + '`.',
            control: { type: 'dropdown', key: 'titleSource', options: enumOptions(TitleSource) }
          },
          {
            name: 'Note reading width',
            desc: 'The max width for the content of your shared note, accepts any CSS unit. Leave this value empty if you want to use the theme\'s width.',
            control: { type: 'text', key: 'noteWidth' }
          },
          {
            name: 'Remove published frontmatter/YAML',
            desc: 'Remove frontmatter/YAML/properties from the shared note',
            control: { type: 'toggle', key: 'removeYaml' }
          },
          {
            name: 'Remove backlinks footer',
            desc: 'Remove backlinks footer from the shared note',
            control: { type: 'toggle', key: 'removeBacklinksFooter' }
          },
          {
            name: 'Remove custom elements',
            desc: 'Remove elements before sharing by targeting them with CSS selectors. One selector per line.',
            control: { type: 'textarea', key: 'removeElements', placeholder: '.class-to-remove' }
          },
          {
            name: 'Share as encrypted by default',
            desc: withDocs('If you turn this off, you can enable encryption for individual notes by adding a `share_encrypted` checkbox into a note and ticking it.', 'https://docs.note.sx/notes/encryption'),
            // Stored inverted (shareUnencrypted), so this can't be a plain
            // toggle binding.
            render: (setting) => {
              setting.addToggle(toggle => toggle
                .setValue(!this.settings.shareUnencrypted)
                .onChange(async (value) => {
                  this.settings.shareUnencrypted = !value
                  await this.saveSettings()
                }))
            }
          },
          {
            name: 'Include Markdown source in shared notes',
            desc: withDocs('Adds a "Save note" button to your shared notes so the reader can save a copy into their own vault. The raw Markdown is embedded in the page, which exposes anything the rendered view hides: frontmatter, %% comments %%, elements removed by your custom selectors, and Dataview queries. Encrypted notes keep the source encrypted. Override per note with the `' + this.fieldKey(YamlField.source) + '` property.', 'https://docs.note.sx/notes/importing-shared-notes'),
            control: { type: 'toggle', key: 'includeSource' }
          },
          {
            name: 'Default note expiry',
            desc: withDocs('If you want, your notes can auto-delete themselves after a period of time. You can set this as a default for all notes here, or you can set it on a per-note basis.', 'https://docs.note.sx/notes/self-deleting-notes'),
            control: { type: 'text', key: 'expiry' }
          }
        ]
      },
      {
        type: 'group',
        heading: 'Danger / advanced',
        items: [
          {
            name: 'Show advanced options',
            desc: 'Reveal advanced fields. Changing these can break your shared notes.',
            render: (setting) => {
              setting.addToggle(toggle => toggle
                .setValue(this.showAdvanced)
                .onChange((value) => {
                  this.showAdvanced = value
                  this.refreshDomState()
                }))
            }
          },
          {
            name: 'User ID',
            desc: 'Your user ID for the server. Read-only.',
            visible: () => this.showAdvanced,
            control: { type: 'text', key: 'uid', disabled: true }
          },
          {
            name: 'Server URL',
            desc: `The API server used to create shared notes. Default: ${DEFAULT_SETTINGS.server}`,
            visible: () => this.showAdvanced,
            control: { type: 'text', key: 'server', placeholder: DEFAULT_SETTINGS.server }
          }
        ]
      }
    ]
  }

  private renderApiKey (setting: Setting): void {
    setting
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
  }
}

/** Dropdown options for a string-keyed numeric enum, labelled by key. */
function enumOptions (enumType: Record<string, string | number>): Record<string, string> {
  const options: Record<string, string> = {}
  for (const label of Object.keys(enumType)) {
    if (isNaN(Number(label))) options[label] = label
  }
  return options
}

/** A description with a "View the documentation" link on its own line. */
function withDocs (text: string, url: string): DocumentFragment {
  return createFragment(frag => {
    frag.appendText(text)
    frag.createEl('br')
    frag.createEl('a', { text: 'View the documentation', href: url })
  })
}
