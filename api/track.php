<?php
// Status satu pesanan untuk pembeli. Pesanan dicari lewat kode acak panjang yang hanya diketahui pemesannya.
define('SB_API', 1);
require __DIR__ . '/_lib.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') { header('Allow: GET'); sb_fail(405, 'Metode tidak diizinkan.'); }
$id = $_GET['id'] ?? '';
if (!is_string($id) || !preg_match('/^[a-f0-9]{16}$/', $id)) sb_fail(404, 'Pesanan tidak ditemukan.');

$row = null;
$orders = sb_store_read()['orders'];
for ($i = count($orders) - 1; $i >= 0; $i--) {
    if (hash_equals($orders[$i]['public_id'], $id)) { $row = $orders[$i]; break; }
}
if (!$row) sb_fail(404, 'Pesanan tidak ditemukan.');

$view = sb_order_view($row, false);

// Petunjuk pembayaran hanya ditampilkan setelah pesanan ada, dan hilang kalau sudah lunas atau dibatalkan.
$info = sb_menu()['config']['paymentInfo'] ?? [];
$view['paymentInfo'] = null;
if (!$row['paid'] && $row['status'] !== 'dibatalkan' && isset($info[$row['payment']])) {
    $view['paymentInfo'] = $info[$row['payment']];
}
$view['contact'] = sb_menu()['config']['contact'] ?? '';
sb_json($view);
