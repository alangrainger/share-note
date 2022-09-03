# Obsidian Share

There are times I want to create a public link to one of my notes, without having an entire "digital garden" through Obsidian Publish.

Enter **Obsidian Share**. To share a page, just run a single Templater script. Templater is also optional - it's plain Javascript so you can launch it from anywhere.

This page you're currently reading was published through Obsidian Share.

[See it live in action here](https://share.alan.fyi/572e1ae4a0aeadf5943862d1deaf8fe6.html).

For any feedback or issues [post those in the forum thread](https://forum.obsidian.md/t/obsidian-share-publicly-share-notes-without-needing-a-full-digital-garden-supports-themes-images-callouts-and-more/).

## Features

🔹 Uploads using your current theme.

🔹 Local and remote image support.

🔹 Supports anything that Obsidian Preview mode does, like rendered Dataview queries and any custom CSS you might have enabled.

🔹 Supports callouts with full styling!

🔹 Filenames are anonymised through hashing so people can't discover your other shared notes.

🔹 If your shared note links to another note which is also shared, that link will also function on the shared webpage.

🔹 Frontmatter is stripped on upload to avoid leaking unwanted data.

## Requirements

**NOTE:** While the script is simple, you will need your own webserver to share the files. If you don't already have a web server, or you don't know how to post JSON data to a server, you will definitely run into trouble.

### Templater (optional!)
I used Templater solely because it's an easy way to launch a script. You don't actually need Templater for this to work, it's just plain Javascript.

Download Templater from the Community Plugins.

## Configuration options

- `YAML_FIELD` - The frontmatter field prefix for storing share link and updated time. A value of `share` will create frontmatter fields of `share_link` and `share_updated`.
- `UPLOAD_LOCATION` - The root path for uploaded files. Needs to end with a trailing slash.
- `UPLOAD_ENDPOINT` - Path to the upload endpoint relative to  upload location.
- `SECRET` - Authentication secret for file uploading. See the simple upload script at the bottom for an example.

## Installation with Templater

1. Copy the script contents [from here](https://github.com/alangrainger/obsidian-share/blob/main/obsidian-share.js).
2. Create a new template, with this format:
```
  <%*
  // Paste the script contents here
  %> 
```
3. Update the configuration to match your server.
4. Go to any note and execute the script the same as you would any Templater template.

## Example PHP uploader

On your server, you just need something simple to accept the incoming POST data from the script. The authentication is a SHA256 of a nonce + secret.

Here's an example using PHP:

```php
<?php

$whitelist = ['html', 'css', 'jpg', 'png'];
$secret = 'some_fancy_secret';

$data = json_decode(file_get_contents('php://input'));

if (! hash_equals($data->auth, hash('sha256', $data->nonce . $secret))) {
    http_response_code(404);
    exit();
}

$file = explode('.', $data->filename);
$file[0] = preg_replace("/[^a-z0-9]/", '', $file[0]);
if (count($file) === 2 && in_array($file[1], $whitelist) && ! empty($file[0])) {
    if ($data->encoding === 'base64') {
        $data->content = base64_decode($data->content);
    }
    file_put_contents(__DIR__ . "/$file[0].$file[1]", $data->content);
}
```
