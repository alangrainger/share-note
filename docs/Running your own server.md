# Running your own server

The system itself is very simple - to run your own server you'll just need something which can accept a POST request and save a file.

## API schema

These are the API calls you'll need to support:

- [Upload a file](api/upload.md): `POST /v1/file/upload`
- [Check existing CSS](api/check-css.md): `POST /v1/file/check-css`

You can change the server URL in the plugin's `data.json` file.

## User authentication

For a private implementation you do not need to support the user authentication or API key endpoints. Simply leave those fields blank in your plugin settings. 

## Reference implementation

Here is an example reference implementation using PHP:

[Example server implementation](Example%20server%20implementation.md)
