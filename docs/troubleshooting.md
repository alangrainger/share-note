---
title: Troubleshooting
---
# Troubleshooting

> [!TIP]
> If sharing is failing for everyone, it'll show on the [status page](https://status.note.sx/).

## Force a full re-upload of all note data

If your shared note isn't displaying correctly, before creating an issue try these steps first:

1. Change to Reading mode.
2. Scroll to the top of the note.
3. Use the command **Force re-upload of all data for this note**.
4. Open the shared note in a "Private Browsing" or "Incognito" window to ensure that it's not a caching issue in your local browser.

And see if that gets the note to share correctly.

## Test in the Sandbox vault

If the above steps don't solve your problem, the next step is to test in the Sandbox vault to see if another
plugin is affecting the note upload.

1. Open Obsidian's built-in sandbox vault [by following these steps](https://help.obsidian.md/Getting+started/Sandbox+vault).
2. Install the Share Note plugin.
3. Create a note like the one which was failing earlier, and see if it now uploads correctly.

## Error messages

**Invalid API key**
The plugin normally sends you to your browser to get a new key automatically. If it doesn't, press **Connect plugin** in the plugin settings.

**Unable to update this link, please delete any existing share links and try again**
The note's `share_link` points to a page that isn't yours, for example a note copied from someone else's vault, or one shared from a different installation of the plugin. Remove the `share_link` and `share_updated` properties from the note and share it again to get a fresh link.

**Uploaded file size is too large**
Each file the plugin uploads is limited to 5 MB. Images are compressed automatically before upload, so this usually means a very large attachment, or a theme whose CSS embeds large fonts. Resize the file, or host it elsewhere and link to it from the note.

**Plugin out of date**
Update Share Note from **Settings > Community plugins**.

## Still stuck?

[Open an issue on GitHub](https://github.com/alangrainger/share-note/issues) with the steps you've tried and, if you can, a copy of the note that fails.
