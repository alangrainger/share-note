---
parent: Running your own server
title: Check for existing CSS
---
# {{ page.title }}

Rather than upload large CSS files each time, this will check for existing CSS so that it can be skipped.

- URL: `/v1/file/check-css`
- Method: `POST`

## Parameters

| Key | Required | Data type | Description         |
|-----|----------|-----------|---------------------|
| id  | Yes      | string    | Any user identifier |

The `id` is any identifier you want to use to differentiate between CSS uploads from different users.

In the case of the Share Note plugin, we use a SHA256 of random data.

## Response

- Code: `200`
- Content type: `application/json`

Returns an object in this format:

```json
{
  "success": true,
  "filename": "https://example.com/user.css"
}
```

`filename` contains the full web URL of the CSS file.
