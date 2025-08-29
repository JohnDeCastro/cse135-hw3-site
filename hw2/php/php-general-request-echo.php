<?php
header('Content-Type: text/plain; charset=utf-8');
echo "Method: " . ($_SERVER['REQUEST_METHOD'] ?? '') . "\n";
echo "Raw body:\n";
$body = file_get_contents('php://input');
echo $body . "\n";
