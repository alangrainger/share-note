import { App, Modal, Setting, TextComponent } from 'obsidian'
import { resolveCustomSlug } from './domain/custom-slug'

/** A slug, undefined for a generated link, or null to cancel sharing. */
export type CustomSlugChoice = string | undefined | null

export default class CustomSlugModal extends Modal {
  private choice: CustomSlugChoice = null

  constructor (app: App, private readonly onResult: (choice: CustomSlugChoice) => void) {
    super(app)
  }

  onOpen () {
    this.setTitle('Choose your share link')
    const { contentEl } = this
    let input!: TextComponent
    new Setting(contentEl)
      .setName('Custom slug')
      .setDesc('Use 2-64 uppercase or lowercase letters, numbers, underscores, or hyphens, starting with a letter or number.')
      .addText(text => {
        input = text.setPlaceholder('Custom slug')
        text.inputEl.setAttribute('aria-label', 'Custom slug')
        text.inputEl.maxLength = 64
        text.inputEl.addEventListener('keydown', event => {
          if (event.key === 'Enter') {
            event.preventDefault()
            submit()
          }
        })
      })
    const errorEl = contentEl.createEl('p', { attr: { role: 'alert' } })
    const submit = () => {
      try {
        const slug = resolveCustomSlug(input.getValue(), true)
        if (!slug) {
          errorEl.setText('Enter a custom slug or choose the default generated link.')
          input.inputEl.focus()
          return
        }
        this.choice = slug
        this.close()
      } catch (error) {
        errorEl.setText(error instanceof Error ? error.message : 'Invalid custom slug.')
        input.inputEl.focus()
      }
    }
    new Setting(contentEl)
      .addButton(button => button
        .setButtonText('Enter custom slug')
        .setCta()
        .onClick(submit))
      .addButton(button => button
        .setButtonText('Use the default generated link')
        .onClick(() => {
          this.choice = undefined
          this.close()
        }))
    input.inputEl.focus()
  }

  onClose () {
    this.contentEl.empty()
    this.onResult(this.choice)
  }
}
