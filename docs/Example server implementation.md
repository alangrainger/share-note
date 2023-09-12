## Example server implementation

> ⚠️ **WARNING!** This code should not be used as-is to implement a service for the public. It is fine for private use.

 This is a simple reference implementation using PHP.
 
### `/v1/file/upload`

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
	file_put_contents(__DIR__ . "/$file[0].$file[1]", $data->content);
}
```

### `/v1/file/check-css`

```php
$data = json_decode(file_get_contents('php://input'));
$filename = $data->id . '.css'
if (file_exists('/path/to/files' . $filename)) {
  echo json_encode([
    'success'  => true,
    'filename' => $this->f3->get('file_url_base') . $filename
  ]);
}
```
