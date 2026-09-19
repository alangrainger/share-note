---
title: Letting readers import your note
---
# Letting readers import your note

When you turn this on, your shared notes get a **💾 Save note** button in the status bar at the bottom of the page. A reader who has Obsidian and the Share Note plugin can click it to save a copy of the note, as Markdown, straight into their own vault.

> [!NOTE]
> This is off by default. Turn it on in the [plugin settings](../settings#include-markdown-source-in-shared-notes), or per note with the frontmatter property below.

## How it works

1. When you share a note, the plugin embeds the note's original Markdown inside the shared page.
2. The reader clicks **💾 Save note**. Their browser opens Obsidian.
3. The plugin fetches the page, pulls the Markdown out, and creates the note in the reader's default new-note folder using the shared title. If a note with that name already exists, a number is added to the name. The new note opens straight away.

Nothing is downloaded from anywhere else, and there is no separate file on the server. If you delete the shared note, the button stops working along with the rest of the page.

## What the reader receives

- **Your frontmatter**, except the `share_*` properties. The reader does not inherit your share link.
- **Images and attachments** as links to the copies already hosted with your shared note, so the saved note renders without any extra uploads. If the reader wants local copies, Obsidian's built-in command *Download attachments for current file* will fetch them into their attachment folder and update the links.
- **Links to your other shared notes** as web links to those shares.
- **All other links and embeds** exactly as you wrote them. A `[[Wikilink]]` to a note you have not shared stays a wikilink, because the reader may have that note themselves.

## Privacy: what this reveals

The shared page normally contains only the *rendered* view of your note. The Markdown source contains more than that. Anything you rely on being hidden in the rendered view is visible in the source:

- Frontmatter properties, even if you remove the frontmatter from the shared page
- Comments written as `%% like this %%`
- Elements you remove with the *Remove custom elements* setting
- Dataview and other queries, rather than their results

> [!WARNING]
> If you use any of these to keep things out of a shared note, leave this setting off, or turn it off for that note.

[Encrypted notes](./encryption) stay encrypted. The Markdown is encrypted together with the note content, so the server never sees it, and the button only works for someone who has the full link including the key.

## Settings

**Include Markdown source in shared notes** in the plugin settings turns this on for every note you share.

To override it for a single note, add a checkbox frontmatter property:

```yaml
share_source: ✅
```

Ticked includes the source for that note even if the setting is off. Unticked (`share_source: false`) leaves it out even if the setting is on. If you use a custom frontmatter prefix, use it here too, for example `myprefix_source`.

## Things to know

- Notes shared before you turned this on do not have the button. Share them again and it will appear.
- Very large notes make the page heavier for every reader, because the source travels with it. The plugin warns you when the source is over 500 KB.
- Excalidraw drawings are kept as you wrote them and are not converted to image links.
- The button only works with the Share Note plugin installed. On a device without Obsidian, it does nothing.
