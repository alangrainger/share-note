---
title: Troubleshooting
nav_order: 5
permalink: /troubleshooting
---
# {{ page.title }}

## Force a full re-upload of all note data

If your shared note isn't displaying correctly, before creating an Issue try these steps first:

1. Change to Reading mode.
2. Scroll to the top of the note.
3. Use the command `Force re-upload of all data for this note`.
4. Open the shared note in a "Private Browsing" or "Incognito" window to ensure that it's not a caching issue in your local browser.

And see if that gets the note to share correctly.

## MathJax / LaTeX

If your MathJax / LaTeX elements are not displaying correctly, `Force re-upload` the note which is having the issues to force your custom stylesheet to be rebuilt with the MathJax classes included.

## Test in the Sandbox vault

If the above steps don't solve your problem, the next step is to test in the Sandbox vault to see if another
plugin is affecting the note upload.

1. Open Obsidian's built-in sandbox vault [by following these steps](https://help.obsidian.md/Getting+started/Sandbox+vault).
2. Install the Share Note plugin.
3. Create a note like the one which was failing earlier, and see if it now uploads correctly.
