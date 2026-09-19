---
title: FAQ
---
# FAQ

## Do I need an account?

No. The first time you share, a page opens in your browser to check you're human, then sends an API key back to Obsidian. No email address or other personal details are asked for. See [Sharing your first note](./sharing-your-first-note).

## Does the person I send the link to need Obsidian?

No. A shared note is a normal web page and opens in any browser. Obsidian and the plugin are only needed for the optional [**Save note** button](./notes/importing-shared-notes), which lets a reader save a copy into their own vault.

## Can I update a note after sharing it?

Yes. Share it again and the page is replaced. The link stays the same, so anyone who has it sees the new version. If your theme or attachments have changed, use **Force re-upload of all data for this note** instead.

## What happens if I rename or move the note inside Obsidian?

Nothing breaks. The link lives in the note's `share_link` property, so it moves with the note, and sharing again updates the same page. If the page title comes from the note title, it updates the next time you share.

## How do I stop sharing a note?

Use the **Delete this shared note** command or the trash icon next to the link. The page is removed from the server and the `share_link` and `share_updated` properties are removed from your note. To have notes remove themselves, see [Self-deleting notes](./notes/self-deleting-notes).

## Can other people find my shared notes?

Shared notes aren't listed anywhere. Each one has a random address that only the people you give the link to know. With [encryption](./notes/encryption) on, the link also carries the key, and without it the server has nothing readable to show.

## Do links between my notes work?

If a note links to another note you've also shared, the link on the shared page goes to that note's shared page.

## Is there a size limit?

Each file the plugin uploads (the note itself, and each attachment) is limited to 5 MB. Images over 100 KB are compressed before upload: they're scaled to at most 1400 pixels on the long side and reduced to a few hundred kilobytes, so the shared page loads quickly. If you need the full-resolution file, host it elsewhere and link to it from the note.

## Which theme do shared notes use?

The theme, snippets and options you had active when you first shared, for every note, until you tell the plugin otherwise. See [Theme](./notes/theme).

## Will you add support for PDFs?

At the moment this is not planned.

Share Note is for sharing your notes; it's not a file-sharing service. The correct way to share a PDF or any large file is to upload it to a proper file sharing service, and then link the shared file back into your note.
