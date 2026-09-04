import { App, Modal, Setting } from 'obsidian'
import { ShareStyle } from './domain/share-style'

/** Receives the user's pick, or null when the modal was closed without one. */
export type ShareStyleResultCallback = (style: ShareStyle | null) => void

interface ShareStyleOption {
  style: ShareStyle
  name: string
  desc: string
  example: string
  button: string
  /** Render the button in the accent colour to mark it as the common choice. */
  cta?: boolean
}

/* Modelled on a real share link: an 8-character filename and, for encrypted
notes, the 22-character key that the plugin appends as the URL fragment. */
const EXAMPLE_LINK = 'https://share.note.sx/4earajc8'
const EXAMPLE_KEY = 'PtC3oQDjDQK9VP7fljmQkL'

const OPTIONS: ShareStyleOption[] = [
  {
    style: 'short',
    name: 'Short link',
    desc: 'The link is short and easy to share.',
    example: EXAMPLE_LINK,
    button: 'Use short links'
  },
  {
    style: 'encrypted',
    name: 'Encrypted link',
    desc: 'Your note is encrypted before it leaves Obsidian, and only people with the link can read it. The link is long because it carries the decryption key.',
    example: `${EXAMPLE_LINK}#${EXAMPLE_KEY}`,
    button: 'Use encrypted links'
  }
]

/**
 * Prompt shown before the user's first share, asking which kind of share
 * link to use by default. The plugin decides when to show it (see
 * shouldPromptShareStyle) and cancels the share on a null result; this class
 * only collects the answer. The callback fires exactly once, when the modal
 * closes: with the pick, or with null if the user closed it without pressing
 * a button.
 */
export default class ShareStyleModal extends Modal {
  private choice: ShareStyle | null = null

  constructor (
    app: App,
    private readonly onResult: ShareStyleResultCallback
  ) {
    super(app)
  }

  onOpen () {
    const { contentEl } = this
    this.modalEl.addClass('share-note-style-modal')
    this.setTitle('Choose your default share style')
    contentEl.createEl('p', {
      text: 'There are two ways to share a note. Pick a default to continue. You can change it at any time in the plugin settings, or override it for a single note.'
    })

    for (const option of OPTIONS) {
      this.renderOption(option)
    }

    contentEl.createEl('p', { cls: 'share-note-style-modal-footer' }, p => {
      p.createEl('a', { text: 'Learn more about encryption', href: 'https://docs.note.sx/notes/encryption' })
    })
  }

  onClose () {
    this.contentEl.empty()
    this.onResult(this.choice)
  }

  private renderOption (option: ShareStyleOption) {
    new Setting(this.contentEl)
      .setName(option.name)
      .setDesc(createFragment(frag => {
        frag.appendText(option.desc)
        frag.createDiv({ cls: 'share-note-style-example' }, div => {
          div.appendText('Example: ')
          div.createEl('code', { text: option.example })
        })
      }))
      .addButton(btn => {
        btn
          .setButtonText(option.button)
          .onClick(() => {
            this.choice = option.style
            this.close()
          })
        if (option.cta) btn.setCta()
      })
  }
}
