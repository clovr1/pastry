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
$extDir = (string)ini_get('extension_dir');
$ini = php_ini_loaded_file();
$root = dirname(__DIR__);
$storage = $root . DIRECTORY_SEPARATOR . 'storage';

echo "PERIKSA SERVER SWEET BITE\n";
echo "=========================\n";
echo "Versi PHP            : " . PHP_VERSION . ' (' . PHP_SAPI . ")\n";
echo "php.ini yang dipakai : " . ($ini ? $ini : '(TIDAK ADA, PHP berjalan tanpa php.ini)') . "\n";
echo "PHP mencari php.ini  : " . (string)get_cfg_var('cfg_file_path') . "\n";
echo "File ini tambahan    : " . (php_ini_scanned_files() ? trim(str_replace("\n", ' ', (string)php_ini_scanned_files())) : '(tidak ada)') . "\n";
echo "extension_dir        : " . ($extDir !== '' ? $extDir : '(kosong)') . "\n";
echo "Folder itu ada       : " . $yn(is_dir($extDir)) . "\n";
echo "php_pdo_sqlite.dll   : " . $yn(is_file($extDir . DIRECTORY_SEPARATOR . 'php_pdo_sqlite.dll') || is_file($extDir . DIRECTORY_SEPARATOR . 'pdo_sqlite.so')) . " (ada di extension_dir)\n";
echo "php_sqlite3.dll      : " . $yn(is_file($extDir . DIRECTORY_SEPARATOR . 'php_sqlite3.dll') || is_file($extDir . DIRECTORY_SEPARATOR . 'sqlite3.so')) . " (ada di extension_dir)\n";
echo "pdo_sqlite aktif     : " . $yn(extension_loaded('pdo_sqlite')) . "\n";
echo "sqlite3 aktif        : " . $yn(extension_loaded('sqlite3')) . "\n";
echo "mbstring aktif       : " . $yn(extension_loaded('mbstring')) . " (boleh tidak aktif)\n";
echo "Folder storage       : " . $storage . "\n";
echo "  ada                : " . $yn(is_dir($storage)) . "\n";
echo "  bisa ditulis       : " . $yn(is_writable($storage)) . "\n";
echo "api/config.php ada   : " . $yn(is_file(__DIR__ . '/config.php')) . "\n";

if ($ini && is_readable($ini)) {
    echo "\nBaris penting di php.ini:\n";
    $found = 0;
    foreach (file($ini, FILE_IGNORE_NEW_LINES) as $i => $line) {
        if (preg_match('/^\s*;?\s*(extension_dir|extension\s*=\s*"?(php_)?(pdo_)?sqlite3?)/i', $line)) {
            echo '  baris ' . ($i + 1) . ': ' . trim($line) . "\n";
            $found++;
        }
    }
    if (!$found) echo "  (tidak ada baris extension_dir atau sqlite)\n";
}

echo "\nKESIMPULAN\n";
if (extension_loaded('pdo_sqlite') && is_writable($storage)) {
    echo "Semuanya siap. Muat ulang halaman owner.\n";
} elseif (!$ini) {
    echo "Web server memakai PHP tanpa php.ini. Taruh php.ini di folder yang sama dengan PHP yang dipakai Apache, lalu Stop dan Start All.\n";
} elseif (!extension_loaded('pdo_sqlite')) {
    echo "php.ini di atas sudah dipakai, tapi pdo_sqlite belum aktif. Pastikan baris extension_dir dan extension=pdo_sqlite di file itu tanpa tanda ';', lalu Stop dan Start All.\n";
} else {
    echo "Folder storage tidak bisa ditulis oleh PHP. Beri izin tulis atau pindahkan proyek ke C:\\laragon\\www.\n";
}
