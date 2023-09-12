# Upload file

Upload a file to the server. Binary files are encoded in base64 and sent as a string.

- URL: `/v1/file/upload`
- Method: `POST`

## Parameters

| Key      | Required | Data type | Description                                                      |
|----------|----------|-----------|------------------------------------------------------------------|
| filename | Yes      | string    | The name of the file                                             |
| content  | Yes      | string    | Contents of destination file. Base64 encoded for binary objects. |
| encoding | No       | string    | `base64` or null                                                 |

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
