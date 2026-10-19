---
title: Running your own server
---
# Running your own server

> [!NOTE]
> The intended use for Share Note is for quick and non-permanent sharing of notes. If you're wanting to host your notes as a long-term website, [I recommend using Quartz](https://github.com/jackyzha0/quartz).

The server is open source and runs as a Docker container: https://github.com/note-sx/server. Its README covers the compose file and the `.env` options, including the upload size limit, whether new users can register, and optional Cloudflare Turnstile and cache purging.

```bash
docker pull ghcr.io/note-sx/server:latest
```

## Pointing the plugin at your server

In the plugin settings, turn on **Show advanced options** and set **Server URL** to your server's address. The next time you share, the plugin sends you to your server's connect page for a new API key, or press **Connect plugin** to do it straight away.

Notes you shared through `share.note.sx` before switching stay where they are. Sharing one of them again through your own server creates a new link there.


## Custom slugs

Install a backend with custom-slug support before enabling the client feature.
Set `ALLOW_CUSTOM_SLUGS=true` in the server environment and restart it, then
turn on **Enable custom slugs** in the plugin and add a `share_slug` text
property to a new note. See [Custom slug settings](./settings#enable-custom-slugs)
for naming, expiry, reuse, and publication identifier behavior.

Turning server creation support off still permits updates and deletion of
existing slug publications. Older servers do not advertise support, and the
plugin reports an upgrade/configuration error instead of silently using a
random URL for a requested slug.
