<?php
header('Content-Type: text/plain; charset=utf-8');
echo "POST params:\n";
foreach ($_POST as $k=>$v) {
  echo "$k = $v\n";
}
