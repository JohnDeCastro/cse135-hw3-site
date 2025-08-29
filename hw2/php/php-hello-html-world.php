<?php
date_default_timezone_set('America/Los_Angeles');
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$now = date('Y-m-d H:i:s');
header('Content-Type: text/html; charset=utf-8');
?>
<!doctype html>
<meta charset="utf-8">
<title>PHP Hello</title>
<h1>Hello, PHP — John De Castro!</h1>
<p>Now: <?= htmlspecialchars($now) ?></p>
<p>Your IP: <?= htmlspecialchars($ip) ?></p>
