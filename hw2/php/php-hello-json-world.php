<?php
date_default_timezone_set('America/Los_Angeles');
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$now = date('c');
header('Content-Type: application/json');
echo json_encode([
  "message" => "Hello, PHP — John De Castro!",
  "now" => $now,
  "ip" => $ip
]);
