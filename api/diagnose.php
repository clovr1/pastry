<?php
// Alat bantu pemecahan masalah: menampilkan PHP mana yang dipakai web server dan ekstensi apa yang aktif.
// Hanya menjawab dari komputer yang sama (localhost). Hapus file ini kalau situs sudah dipasang di internet.
$ip = $_SERVER['REMOTE_ADDR'] ?? '';
if (!in_array($ip, ['127.0.0.1', '::1'], true) || isset($_SERVER['HTTP_X_FORWARDED_FOR']) || isset($_SERVER['HTTP_FORWARDED'])) {
    http_response_code(403);
    exit('Hanya bisa dibuka dari komputer yang sama.');
}
header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-store');

$yn = function ($v) { return $v ? 'ya' : 'TIDAK'; };
$root = dirname(__DIR__);
$storage = $root . DIRECTORY_SEPARATOR . 'storage';
$ini = php_ini_loaded_file();
$cfgFile = __DIR__ . '/config.php';
$cfg = is_file($cfgFile) ? include $cfgFile : [];
$dataFile = is_array($cfg) && !empty($cfg['data_file']) ? basename((string)$cfg['data_file']) : 'store.json';

echo "PERIKSA SERVER SWEET BITE\n";
echo "=========================\n";
echo "Versi PHP            : " . PHP_VERSION . ' (' . PHP_SAPI . ")\n";
echo "php.ini yang dipakai : " . ($ini ? $ini : '(tidak ada, PHP berjalan tanpa php.ini. Ini tidak masalah)') . "\n";
echo "Fitur yang dibutuhkan:\n";
foreach (['json', 'session', 'hash', 'pcre', 'date'] as $e) {
    echo "  " . str_pad($e, 8) . ": " . $yn(extension_loaded($e)) . "\n";
}
echo "  password_hash : " . $yn(function_exists('password_hash')) . "\n";
echo "  random_bytes  : " . $yn(function_exists('random_bytes')) . "\n";
echo "  mbstring      : " . $yn(extension_loaded('mbstring')) . " (boleh tidak aktif)\n";
echo "Folder storage       : " . $storage . "\n";
echo "  ada                : " . $yn(is_dir($storage)) . "\n";
echo "  bisa ditulis       : " . $yn(is_writable($storage)) . "\n";
echo "File data pesanan    : " . $dataFile . ' (' . (is_file($storage . DIRECTORY_SEPARATOR . $dataFile) ? filesize($storage . DIRECTORY_SEPARATOR . $dataFile) . ' byte' : 'belum dibuat, muncul setelah ada pesanan') . ")\n";
echo "api/config.php ada   : " . $yn(is_file($cfgFile)) . "\n";
echo "Kata sandi owner     : " . $yn(is_array($cfg) && !empty($cfg['owner_password_hash'])) . " (sudah dibuat)\n";

echo "\nKESIMPULAN\n";
$need = ['json', 'session', 'hash', 'pcre', 'date'];
$missing = array_filter($need, function ($e) { return !extension_loaded($e); });
if ($missing) {
    echo "Fitur PHP yang kurang: " . implode(', ', $missing) . ". Pakai PHP versi lain di Laragon.\n";
} elseif (!is_dir($storage) || !is_writable($storage)) {
    echo "Folder storage tidak ada atau tidak bisa ditulis oleh PHP. Beri izin tulis atau pindahkan proyek ke C:\\laragon\\www.\n";
} elseif (!is_array($cfg) || empty($cfg['owner_password_hash'])) {
    echo "Server siap, tapi kata sandi owner belum dibuat. Jalankan: php tools/set-owner-password.php\n";
} else {
    echo "Semuanya siap. Muat ulang halaman owner.\n";
}
