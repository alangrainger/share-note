---
parent: Notes
title: Encryption
category: notes
permalink: /notes/encryption
---
# {{ page.title }}

The content of your note is encrypted by default. What this means is that you can read the note, and the person you send it to can read the note, but nobody else can read the content - not even the hosting server.

{: .info }
> Encryption is optional, and can be turned on/off for individual notes, or for all notes, whatever you prefer.

## Enable/disable encryption on a per-note basis

If you are sharing notes encrypted by default, you may optionally share an unencrypted version of a note by using the frontmatter checkbox property `share_unencrypted` = ☑

If you are sharing notes unencrypted by default, then you can encrypt an individual note by using the frontmatter property `share_encrypted` = ☑

## How does the encryption work?

When you share an encrypted note, you'll get a share link that looks like this:

```
https://share.note.sx/xldtzcxq#Ty9bCAhVlSvC9f2FOxsUBSBW7bLAUmq0CPTObWNAdXQ
```

This part is the link to the file:

[https://share.note.sx/xldtzcxq](https://share.note.sx/xldtzcxq)

If you click on it, you'll see a message that says "*Encrypted note*", because you haven't provided the decryption key.
The decryption key is the second part of the share link after the `#` symbol:

```
#Ty9bCAhVlSvC9f2FOxsUBSBW7bLAUmq0CPTObWNAdXQ
```

When you combine those two things together, the note is able to be decrypted and you can see the content:

[https://share.note.sx/xldtzcxq#Ty9bCAhVlSvC9f2FOxsUBSBW7bLAUmq0CPTObWNAdXQ](https://share.note.sx/xldtzcxq#Ty9bCAhVlSvC9f2FOxsUBSBW7bLAUmq0CPTObWNAdXQ)

The decryption key **only** exists inside your vault, and is only known to you and whoever you send the link to. Nobody else can read the content.

## 💔 The one downside of encrypted sharing

Please note that if you share your note encrypted, it will prevent it from being able to show a preview when you paste the link into a message or forum; for example the preview which shows up in [my Obsidian forum post here](https://forum.obsidian.md/t/42788):

[<img src="note-preview.png" width="500">](https://forum.obsidian.md/t/42788)
