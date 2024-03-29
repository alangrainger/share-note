---
parent: Running your own server
title: Example server implementation
---
# {{ page.title }}

> ⚠️ **WARNING!** This code should not be used as-is to implement a service for the public. It is fine for private use.

This is a simple reference implementation using PHP.

### `/v1/file/upload`

[Documentation](api/upload.md)

```php
$whitelist = ['html', 'css', 'jpg', 'png', 'ttf', 'otf', 'woff', 'woff2'];
$data = json_decode(file_get_contents('php://input'));
$file = explode('.', $data->filename);
// Sanitize the filename
$file[0] = preg_replace("/[^a-z0-9]/", '', $file[0]);
if (count($file) === 2 && in_array($file[1], $whitelist) && ! empty($file[0])) {
  if ($data->encoding === 'base64') {
    // Decode uploaded images
    $data->content = base64_decode($data->content);
  }
  $filename = $file[0].$file[1];
  file_put_contents('/path/to/files/' . $filename, $data->content);
  echo json_encode([
    'success'  => true,
    'filename' => 'https://example.com/files/' . $filename
  ]);
}
```

### `/v1/file/check-css`

[Documentation](api/check-css.md)

```php
$data = json_decode(file_get_contents('php://input'));
$id = preg_replace("/[^a-z0-9]/", '', $data->id);
if ($id) {
  $filename = $id . '.css'
  if (file_exists('/path/to/files/' . $filename)) {
    echo json_encode([
      'success'  => true,
      'filename' => 'https://example.com/files/' . $filename
    ]);
  }
}
```
