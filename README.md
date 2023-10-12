# Share Note

<a href="https://ko-fi.com/alan_" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy me a coffee" style="width:190px"></a>

[📝💬 Obsidian forum link for this plugin](https://forum.obsidian.md/t/42788)

Instantly share an [Obsidian](https://obsidian.md) note, with optional encryption. Notes are shared with your full theme and should look identical to how they do in your vault.

---

## Full theme support

Uploads using your current theme, along with all your options and custom CSS snippets.

Supports all Obsidian content types:

### Images!

<img width="320" src="docs/wow5.png">

### Dataview queries!

Here's an example inline Dataview query. It will be correctly rendered when sharing:

```
The answer is `= 7 + 8`!
```

The answer is 15!

### Callouts!

<img width="600" src="docs/callouts.png">

### Links between notes!

If your shared note links to another note which is also shared, that link will also function on the shared webpage.

### Code blocks!

```javascript
function doYouEven(haveToAsk) {
  return 'Of course we can do it!'
}
```

### Checkboxes! Tags!

**Project Manhattan:** #in-progress #behind-schedule

- [x] Start project
- [x] Procrastinate
- [ ] Finish project

### Internal links

Share a table of contents and jump around your document.

---

## Usage

Use the `Share Note` command from the Command Palette. You can map it to a hotkey to make things faster.

The first time a file is shared, the plugin will automatically upload all your theme styles. The next time you share a file, it will use the previously uploaded theme files.

If you want to force the theme CSS to update, use the command `Force re-upload of all data for this note`.

---

## Encryption

- Your notes are encrypted on your device with a key that only you have.
- Each note is encrypted with its own random key. A key from one of your notes cannot be used to decrypt another of your notes.
- The key is never sent to the server, it only exists as part of the share link created inside your device.

You may optionally share an unencrypted version of a note by using the frontmatter checkbox property `share_unencrypted` = true. This note you are currently reading is shared unencrypted.

[Example encrypted note](https://share.note.sx/4earajc8#PtC3oQDjDQK9VP7fljmQkLBA/rIMb2tbFsGoG44VdFY)
