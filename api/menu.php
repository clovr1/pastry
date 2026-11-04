<?php
// Mengirim data toko dan menu ke browser sebagai JavaScript (CONFIG, CATS, ITEMS).
// Sumber datanya satu: data/menu.json. Data pembayaran sengaja tidak ikut dikirim.
define('SB_API', 1);
require __DIR__ . '/_lib.php';

$menu = sb_menu();
$config = $menu['config'];
unset($config['paymentInfo']);

// Tambahkan ?v=<waktu ubah file> pada foto lokal, supaya browser langsung memuat foto baru
// saat file di folder images/ diganti (nama file yang sama tidak lagi tersangkut di cache).
function sb_versioned($path) {
    if (!is_string($path) || $path === '' || preg_match('#^(https?:)?//#', $path) || strpos($path, '..') !== false) return $path;
    $file = SB_ROOT . '/' . ltrim($path, '/');
    return is_file($file) ? $path . '?v=' . filemtime($file) : $path;
}
if (isset($config['banner']['img'])) $config['banner']['img'] = sb_versioned($config['banner']['img']);
foreach ($menu['items'] as &$it) { if (isset($it['img'])) $it['img'] = sb_versioned($it['img']); }
unset($it);

$flags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;
header('Content-Type: application/javascript; charset=utf-8');
header('Cache-Control: no-cache');
header('X-Content-Type-Options: nosniff');
echo 'const CONFIG = ', json_encode($config, $flags), ";\n";
echo 'const CATS = ', json_encode($menu['cats'], $flags), ";\n";
echo 'const ITEMS = ', json_encode($menu['items'], $flags), ";\n";
