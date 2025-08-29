<?php
header('Content-Type: text/plain; charset=utf-8');
foreach ($_SERVER as $k=>$v) {
  echo "$k=$v\n";
}
