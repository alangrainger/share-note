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
