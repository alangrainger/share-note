---
title: Sharing your first note
---
# Sharing your first note

## 1. Install the plugin

Install Share Note from Obsidian's community plugins (**Settings > Community plugins > Browse**) and enable it, or use [this direct link](https://obsidian.md/plugins?id=share-note).

## 2. Connect to the server

The first time you share, a page opens in your browser. Complete the "are you human" check and the page sends an API key back to Obsidian. That's all the server asks for: there is no account to create and no email address to give.

You can also connect ahead of time with the **Connect plugin** button in the plugin settings. If you're ever asked to reconnect, for example after reinstalling the plugin, the same button gets you a new key.

## 3. Choose a share style

Before your first share, the plugin asks which kind of link you want by default:

- **Short link** - the note is uploaded as-is and the link is just the address: `https://share.note.sx/xldtzcxq`
- **Encrypted link** - the note is encrypted inside Obsidian before it leaves your vault, and the link carries the decryption key: `https://share.note.sx/xldtzcxq#Ty9bCAhVlSvC9f2FOxsUBSBW7bLAUmq0CPTObWNAdXQ`

Your answer sets the [Share as encrypted by default](./settings#share-as-encrypted-by-default) setting. You can change it at any time, and override it for a single note. See [Encryption](./notes/encryption) for what encrypted sharing does and doesn't protect.

## 4. Share

Run **Share current note** from the command palette, or open the `⋮` menu in a note and choose **Share note on the web**. You can bind the command to a hotkey.

The first share also uploads your theme, so it takes a little longer than later ones. When it finishes, the link is on your clipboard (unless you turn off [Copy the link to clipboard after sharing](./settings#copy-the-link-to-clipboard-after-sharing)) and two properties are added to the note:

```yaml
share_link: https://share.note.sx/xldtzcxq#Ty9bCAhVlSvC9f2FOxsUBSBW7bLAUmq0CPTObWNAdXQ
share_updated: 2026-09-19T14:02:11+12:00
```

`share_link` is how the plugin knows the note is shared. Keep it: it's what lets you update or delete the share later.

## Updating, copying and deleting

- **Update** - share the note again. The page is replaced and the link stays the same. If the theme or attachments look wrong, use **Force re-upload of all data for this note** instead.
- **Copy the link** - the **Copy shared note link** command, or **Copy shared link** in the `⋮` menu. If the note isn't shared yet, this shares it first.
- **Delete** - the **Delete this shared note** command, or the trash icon next to the link. After confirming, the page is removed from the server and the two properties are removed from your note. Your local note is untouched.

Every shared note also shows three icons next to its `share_link` property for exactly these actions. See [Managing your notes](./notes/managing-your-notes).
