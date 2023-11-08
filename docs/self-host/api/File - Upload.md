---
title: /v1/file/upload
grand_parent: Running your own server
parent: API
permalink: /self-hosting/api/file/upload
---
# Upload file

Upload a file to the server.

- URL: `/v1/file/upload`
- Method: `POST`

## Parameters

| Key      | Required | Data type | Description                                                      |
|----------|----------|-----------|------------------------------------------------------------------|
| filetype | Yes      | string    | File extension - 'html', 'css', 'jpg', etc                       |
| hash     | Yes      | string    | SHA1 hash of file contents                                       |
| content  | Yes      | ArrayBuffer \| string    | Will be string for CSS files and ArrayBuffer for all other files |
| byteLength | Yes | number | Length of the uploaded content in bytes |
| expiration | No | number | Unix timestamp (milliseconds) | 

## Response

- Code: `200`
- Content type: `application/json`

Returns an object in this format:

```json
{
  "success": true,
  "filename": "https://example.com/uploaded_file.html"
}
```

`filename` contains the full URL of the uploaded file.
