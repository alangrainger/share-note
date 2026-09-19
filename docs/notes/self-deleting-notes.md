---
title: Self-deleting / expiring notes
---
# Self-deleting / expiring notes

> [!TIP]
> To delete a note manually, click the <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg> icon next to the shared link, or use the **Delete this shared note** command.

## Setting notes to automatically expire

In the [settings](../settings#default-note-expiry), you can specify a default expiry time if you want your notes to automatically disappear after the time has passed.

The value is a number, a space, and a unit: `minute`, `hour`, `day` or `month`, singular or plural. For example:

- `15 minutes`
- `3 hours`
- `1 day`
- `1 month`

The minimum is 1 minute and a month counts as 30 days. Anything in another form, such as `7d`, `1 week` or `1.5 hours`, isn't understood and is ignored.

The default applies to every note you share from then on. Notes you shared before setting it aren't affected until you share them again.

## Set the expiry for an individual note

To expire only certain notes, add a `share_expires` text property to each one, with a time in the same form:

```yaml
share_expires: 7 days
```

This overrides the default for that note. The clock starts each time you share the note, so sharing it again extends its life.
