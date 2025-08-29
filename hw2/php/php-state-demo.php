<?php
session_start();
header('Content-Type: text/html; charset=utf-8');
$name = $_SESSION['name'] ?? null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $name = trim($_POST['name'] ?? '');
  $_SESSION['name'] = $name;
  header('Location: php-state-demo.php');
  exit;
}

if (isset($_GET['destroy'])) {
  session_destroy();
  header('Location: php-state-demo.php');
  exit;
}
?>
<!doctype html>
<meta charset="utf-8">
<title>PHP State Demo</title>
<h1>PHP State Demo</h1>

<?php if ($name): ?>
  <p>Welcome back, <strong><?= htmlspecialchars($name) ?></strong>!</p>
  <p><a href="?destroy=1">Destroy session</a></p>
<?php else: ?>
  <form method="post">
    <label>Name: <input name="name" required></label>
    <button>Save</button>
  </form>
<?php endif; ?>
