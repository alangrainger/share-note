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
