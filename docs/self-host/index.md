---
title: Running your own server
has_children: true
nav_order: 90
permalink: /self-hosting
---
# Running your own server

When the system shares a note it goes through these steps, with the corresponding API calls:

1. Upload all note attachments:
    1. [`/v1/file/check-files`](/self-hosting/api/file/check-files) - check which files do not exist and need to be uploaded
    2. [`/v1/file/upload`](/self-hosting/api/file/upload) - upload any missing files
2. Based on the result from the previous `check-files`, upload the CSS and CSS attachments *if needed*:
    1. [`/v1/file/check-files`](/self-hosting/api/file/check-files) - check which CSS assets do not exist and need to be uploaded
    2. [`/v1/file/upload`](/self-hosting/api/file/upload) - upload any missing CSS assets as well as the `.css` file
3. Upload the note HTML content:
    1. [`/v1/file/create-note`]()
