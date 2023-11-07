---
parent: Notes
title: Self-deleting / expiring notes
category: notes
permalink: /notes/self-deleting-notes
---
# {{ page.title }}

You can specify an expiry time if you want your note to automatically disappear / delete after the time has expired.

The unit can be specified as months, days, hours, or minutes, with a minimum of 1 minute.

For example: 
- `3 hours` or
- `15 minutes` or
- `1 month`

### Setting the expiry for an individual note

You can set an expiry just for a specific note by adding a `share_expires` frontmatter text property, and adding an expiry time as above.
