# Share Note

Free, encrypted public note sharing for Obsidian.

## Features

- Uploads using your current theme.
- Local and remote image support.
- Supports anything that Obsidian Preview mode does, like rendered Dataview queries and any custom CSS you might have enabled.
- Supports callouts with full styling.
- If your shared note links to another note which is also shared, that link will also function on the public page.
- Frontmatter is stripped on upload by default to avoid leaking unwanted data.

## Usage

Use the **Share Note** command from the Command Palette. You can map it to a hotkey to make things faster.

The first time a file is shared, the plugin will automatically upload all your theme styles. 
The next time you share the same file, it will ignore the CSS since it's already been uploaded.

**If you want to force the theme CSS to re-upload, just remove the `share_link` property from your frontmatter.**

## Advanced functions

#### Keeping the same file URL

The URL of the shared file is based on the note path + name. If you've changed the path or name and want to keep the same URL, you can add a  `share_hash` YAML property with the original hash.

For example, if your URL was:

```
https://file.obsidianshare.com/572e1ae4a0aeadf5943862d1deaf8fe6.html#rhA5Um75sfBc+d1ahskptuNnriaHq3mTiEdk3Lfa4t4
```

the part you want to copy is the bit between `obsidianshare.com/` and `.html`

In this case you would set the `share_hash` property to be `572e1ae4a0aeadf5943862d1deaf8fe6` and the URL will stay the same no matter if you rename or move the Obsidian note.
