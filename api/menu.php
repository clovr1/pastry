<?php
// Mengirim data toko dan menu ke browser sebagai JavaScript (CONFIG, CATS, ITEMS).
// Sumber datanya satu: data/menu.json. Data pembayaran sengaja tidak ikut dikirim.
define('SB_API', 1);
require __DIR__ . '/_lib.php';

$menu = sb_menu();
$config = $menu['config'];
unset($config['paymentInfo']);

$flags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;
header('Content-Type: application/javascript; charset=utf-8');
header('Cache-Control: no-cache');
header('X-Content-Type-Options: nosniff');
echo 'const CONFIG = ', json_encode($config, $flags), ";\n";
echo 'const CATS = ', json_encode($menu['cats'], $flags), ";\n";
echo 'const ITEMS = ', json_encode($menu['items'], $flags), ";\n";
