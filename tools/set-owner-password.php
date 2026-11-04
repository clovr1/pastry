<?php
// Membuat api/config.php dengan kata sandi owner. Hanya bisa dijalankan dari terminal:
//   php tools/set-owner-password.php
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }

fwrite(STDOUT, "Kata sandi owner baru (minimal 8 karakter): ");
$pw = trim((string)fgets(STDIN));
if (strlen($pw) < 8) { fwrite(STDERR, "Terlalu pendek. Gunakan minimal 8 karakter.\n"); exit(1); }

$target = __DIR__ . '/../api/config.php';
// nama file data: pertahankan yang sudah ada (supaya pesanan lama tidak "hilang"), atau buat yang acak
$existing = is_file($target) ? include $target : [];
$dataFile = is_array($existing) && !empty($existing['data_file']) && $existing['data_file'] !== 'store.json'
    ? basename((string)$existing['data_file'])
    : (is_array($existing) && !empty($existing['data_file']) ? 'store.json' : 'store-' . bin2hex(random_bytes(8)) . '.json');
$sample = file_get_contents(__DIR__ . '/../api/config.sample.php');
$hash = password_hash($pw, PASSWORD_DEFAULT);
// preg_replace_callback: hash bcrypt mengandung tanda "$" yang akan dianggap rujukan balik kalau memakai preg_replace biasa
$line = "'owner_password_hash' => " . var_export($hash, true);
$out = preg_replace_callback("/'owner_password_hash' => '[^']*'/", function () use ($line) { return $line; }, $sample, 1, $n);
if (!$n) { fwrite(STDERR, "Format config.sample.php tidak dikenali.\n"); exit(1); }
$dataLine = "'data_file' => " . var_export($dataFile, true);
$out = preg_replace_callback("/'data_file' => '[^']*'/", function () use ($dataLine) { return $dataLine; }, $out, 1);
file_put_contents($target, $out);
fwrite(STDOUT, "Selesai. Kata sandi owner tersimpan di api/config.php.\n");
