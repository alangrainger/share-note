![](https://img.shields.io/github/license/alangrainger/obsidian-share) ![](https://img.shields.io/github/v/release/alangrainger/obsidian-share?style=flat-square) ![](https://img.shields.io/github/downloads/alangrainger/obsidian-share/total)

# Share Note

Free, encrypted public note sharing for Obsidian. Notes are encrypted on your device before being sent to the server, and the decryption key is never sent to the server - it only exists inside the note in your vault.

## Features

- Uploads using your current theme.
- Local and remote image support.
- Supports anything that Obsidian Preview mode does, like rendered Dataview queries and any custom CSS you might have enabled.
- Supports callouts with full styling.
- If your shared note links to another note which is also shared, that link will also function on the public page.
- Frontmatter is stripped on upload by default to avoid leaking unwanted data.

## Encryption

- Your notes are encrypted on your device with a key that only you have.
- Each note is encrypted with its own random key. A key from one of your notes cannot be used to decrypt another of your notes.
- The key is never sent to the server, it only exists as part of the share link created inside your device.

## Installation

The plugin is awaiting review for the Community store. In the meantime you can install it using BRAT, [see the instructions here](docs/BRAT.md).

I have a server set up to host the shared notes. This is a free service for Obsidian users, as I already had the server and the costs to me are negligible.

Connect your plugin by clicking the "Connect plugin" button on the Settings page.

## Usage

Use the `Share Note` command from the Command Palette. You can map it to a hotkey to make things faster.

The first time a file is shared, the plugin will automatically upload all your theme styles. The next time you share a file, it will use the previously uploaded theme files. 

If you want to force the theme CSS to update, use the command `Force re-upload of all data for this note`.

## Running your own server

[See the docs here](docs/Running%20your%20own%20server.md).

## Attributions

Encryption code is based with thanks on code from https://github.com/mcndt/obsidian-quickshare
