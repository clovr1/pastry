<?php
// Mengganti nomor versi (?v=...) pada tautan CSS dan JavaScript di semua halaman, supaya browser
// memuat file terbaru setelah ada perubahan. Jalankan: php tools/bump-version.php
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
$v = date('YmdHis');
$root = dirname(__DIR__);
$files = array_merge(glob($root . '/*.html'), glob($root . '/owner/*.html'));
$count = 0;
foreach ($files as $f) {
    $t = file_get_contents($f);
    $new = preg_replace('/(\.(?:css|js))\?v=[0-9a-z]+/', '$1?v=' . $v, $t, -1, $n);
    if ($n) { file_put_contents($f, $new); $count += $n; }
}
echo "Versi diganti menjadi $v pada $count tautan.\n";
