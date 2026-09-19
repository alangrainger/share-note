---
title: Self-deleting / expiring notes
---
# Self-deleting / expiring notes

> [!TIP]
> To delete a note manually, click the <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg> icon next to the shared link.

## Setting notes to automatically expire

In the [settings page](../settings#default-note-expiry), you can specify a default expiry time if you want your notes to automatically disappear / delete after the time has expired.

The unit can be specified as months, days, hours, or minutes, with a minimum of 1 minute.

For example:
- `3 hours` or
- `15 minutes` or
- `1 month`

This will apply to all your notes.

If you only want certain notes to expire, then you can:

## Set the expiry for an individual note

You can set an expiry just for a specific note by adding a `share_expires` frontmatter text property, and adding an expiry time as above.

```yaml
share_expires: 7 days
```
