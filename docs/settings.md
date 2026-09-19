---
title: Settings
---
# Settings

A reference for every option in the plugin's settings tab, in the order they appear.

## API key

Your key for the Share Note server. It's filled in automatically the first time you share a note (see [Sharing your first note](./sharing-your-first-note#_2-connect-to-the-server)), or press **Connect plugin** to get one now. Press it again whenever you're asked to reconnect.

## Frontmatter property prefix

The prefix for the properties the plugin reads and writes in your notes. The default, `share`, gives `share_link`, `share_updated` and so on. Changing it renames every property in [Frontmatter properties](./notes/frontmatter-properties), including the ones you set yourself such as `share_expires`.

If you change it after sharing notes, the plugin will no longer recognise those notes as shared, because it looks for the link under the new name.

## Sharing

### Your shared note theme

Shows the theme that was uploaded with your first share. All your shared notes use it, whatever theme is active in Obsidian now. To change it, see [Theme](./notes/theme).

### Light/dark mode

Whether shared notes display in light mode, dark mode, or whichever your vault is using when you share (**Same as theme**, the default).

### Copy the link to clipboard after sharing

On by default. The share link is put on your clipboard as soon as the share completes.

## Note display

### Note title source

Where the shared page's title comes from:

- **Note title** (default) - the note's file name.
- **First H1** - the first level-1 heading in the note.
- **Frontmatter property** - the `share_title` property.

If the chosen source is empty, the file name is used.

### Note reading width

The maximum width of the note content on the shared page, in any CSS unit (for example `700px` or `45em`). Leave it empty to use your theme's own width.

### Remove published frontmatter/YAML

On by default. Leaves the properties block off the shared page.

### Remove backlinks footer

On by default. Removes the *Backlinks* section that Obsidian can show at the bottom of a note in reading view.

### Remove custom elements

CSS selectors, one per line, for elements to strip from the note before it's uploaded. Anything that matches is left out of the shared page, for example a `.private` callout or a `#draft-notes` section.

### Share as encrypted by default

On by default. The first-share prompt sets this for you. See [Encryption](./notes/encryption) for what it protects and how to override it for a single note with `share_encrypted` or `share_unencrypted`.

### Include Markdown source in shared notes

Off by default. When on, your shared pages get a **💾 Save note** button that lets a reader with Obsidian save a copy of the note into their own vault. The note's Markdown source is embedded in the page to make that work, which reveals things the rendered view hides. Read [Letting readers import your note](./notes/importing-shared-notes) before turning it on. Override it for a single note with the `share_source` property.

### Default note expiry

Leave it empty for notes that stay until you delete them, or enter a time such as `7 days` to have every note delete itself. See [Self-deleting notes](./notes/self-deleting-notes) for the format and the per-note override.

## Danger / advanced

Hidden until you turn on **Show advanced options**. Changing these can break your shared notes.

### User ID

Your identifier on the server. Read-only.

### Server URL

The API server the plugin talks to. Default `https://api.note.sx`. Only change this if you're [running your own server](./running-your-own-server).
