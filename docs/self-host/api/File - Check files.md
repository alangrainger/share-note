---
title: /v1/file/check-files
grand_parent: Running your own server
parent: API
permalink: /self-hosting/api/file/check-files
---
# {{ page.title }}

Receive a list of files to check which need to be updated.

- URL: `/v1/file/check-files`
- Method: `POST`

## JSON request body

 An array of files in the below format:

```json
{
  "files": [
    {
      "hash": "",
      "filetype": "",
      "byteLength": ""
    }
  ]
}
```

| Key        | Required | Data type | Description                                                      |
|------------|----------|-----------|------------------------------------------------------------------|
| filetype   | Yes      | string    | File extension - 'html', 'css', 'jpg', etc                       |
| hash       | Yes      | string    | SHA1 hash of file contents                                       |
| byteLength | Yes      | number    | Length of the uploaded content in bytes                          |
| url        | No       | string    | This will be populated by the server if the file is found        |

## Response

- Code: `200`
- Content type: `application/json`

Returns a [`CheckFilesResult`](#checkfilesresult) object.

The server should check each file against the files stored on the server, and if the file is found it should populate a `url` property for that array element.

If a CSS file exists on the server for this user, it will be returned in the `css` parameter.

## Types

### `CheckFilesResult`

```typescript
interface CheckFilesResult {
  success: boolean
  files: FileResult[]
  css?: {
    url: string
    hash: string
  }
}
```

### `FileResult`

```typescript
interface FileResult {
  filetype: string
  hash: string
  byteLength: number
  url?: string
}
```
