<?php
header('Content-Type: text/plain; charset=utf-8');
echo "GET params:\n";
foreach ($_GET as $k=>$v) {
  echo "$k = $v\n";
}
