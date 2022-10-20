# Obsidian Share

There are times I want to create a public link to one of my notes, without having an entire "digital garden" through Obsidian Publish.

Enter **Obsidian Share**. To share a page, just run a single Templater script. Templater is also optional - it's plain Javascript so you can launch it from anywhere.

[See it live in action here](https://file.obsidianshare.com/572e1ae4a0aeadf5943862d1deaf8fe6.html), along with installation instructions and usage.

For any feedback or issues [post those in the forum thread](https://forum.obsidian.md/t/42788/).

You can also host your own private version, [see details here](https://file.obsidianshare.com/5d9dadb08ee4ec00323c694930722702.html).

## Features

🔹 Uploads using your current theme.

🔹 Local and remote image support.

🔹 Supports anything that Obsidian Preview mode does, like rendered Dataview queries and any custom CSS you might have enabled.

🔹 Supports callouts with full styling:

🔹 Filenames are anonymised through hashing so people can't discover your other shared notes.

🔹 If your shared note links to another note which is also shared, that link will also function on the shared webpage. 

🔹 Frontmatter is stripped on upload to avoid leaking unwanted data.

## Requirements

While the script is simple, you will need your own webserver to share the files. If you don't already have one, it's not as scary as it sounds. You can find hosting for as cheap as [$4 per year](https://hostdive.com/shared).

You need to add an endpoint on your server where the script can upload the files. If you don't know what you're doing, most webservers run PHP and you can find instructions and an example PHP upload script at the bottom of this document.

### Templater (optional)
I use Templater solely because it's an easy way to launch a script. You don't actually need Templater for this to work, it's just plain Javascript.

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
3. Create some sort of upload endpoint on your server. The data is JSON POST, and the authentication is SHA256 of a nonce + secret. See below for an example in PHP.
4. Update the configuration to match your server.
5. Go to any note and execute the script the same as you would any Templater template.

## Usage

The first time a file is shared, the script will automatically upload all the theme styles along with it into a separate `style.css` file. This will allow all your shared files to point to the same cached CSS file on your webserver to speed up browsing.

The next time you share the same file, it will ignore the CSS. **If you want to force the theme CSS to re-upload, just remove the `share_link` property from your frontmatter.**

## Web server setup

On your server, you just need something simple to accept the incoming POST data from the script. 

Most personal web hosting runs PHP, so here are the basic steps to set up your PHP-based server to host the files:

1.  Create a new folder on your web server.
2.  Make a file called `upload.php` and copy the below PHP script into that file.
3.  Change the `SECRET` in both the PHP file and the Templater script to something complex that only you know. Random characters are fine.
4.  Upload the `upload.php` file to the new folder on your web server.
5.  Update the Templater script config to match steps 1 and 2:
	1. `UPLOAD_LOCATION` would be the URL of the folder you created in step 1. It will be the web location so will start with `https://...`
	2. `UPLOAD_ENDPOINT` will be the name of the file from step 2: `upload.php`.

### Example PHP upload script

```php
<?php

$whitelist = ['html', 'css', 'jpg', 'png', 'ttf', 'otf', 'woff', 'woff2'];
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
        // Decode uploaded images
        $data->content = base64_decode($data->content);
    }
    file_put_contents(__DIR__ . "/$file[0].$file[1]", $data->content);
}
```
