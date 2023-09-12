# Running your own server

The system itself is very simple - to run your own server you'll just need something which can accept a POST request, and save a file.

These are the API calls you'll need to support:

- [Upload a file](api/upload.md): `POST /v1/file/upload`
- [Check existing CSS](api/check-css.md): `POST /v1/file/check-css`
