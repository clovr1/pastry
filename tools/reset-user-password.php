<?php
// Mengganti kata sandi akun pembeli yang lupa. Jalankan di terminal: php tools/reset-user-password.php email@pembeli.com
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
define('SB_API', 1);
require dirname(__DIR__) . '/api/_lib.php';

$email = strtolower(trim($argv[1] ?? ''));
if ($email === '') { fwrite(STDERR, "Cara pakai: php tools/reset-user-password.php email@pembeli.com\n"); exit(1); }
$data = sb_store_read();
$found = false;
foreach ($data['users'] as $u) { if ($u['email'] === $email) $found = true; }
if (!$found) { fwrite(STDERR, "Tidak ada akun dengan email $email.\n"); exit(1); }

echo 'Kata sandi baru (minimal 8 karakter): ';
$pw = trim((string)fgets(STDIN));
if (strlen($pw) < 8 || strlen($pw) > 72) { fwrite(STDERR, "Kata sandi harus 8 sampai 72 karakter.\n"); exit(1); }
$hash = password_hash($pw, PASSWORD_DEFAULT);
sb_store_update(function (&$d) use ($email, $hash) {
    foreach ($d['users'] as &$u) { if ($u['email'] === $email) $u['pass'] = $hash; }
});
echo "Selesai. Kata sandi untuk $email sudah diganti.\n";
