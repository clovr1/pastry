<?php
// Menerima pesanan dari pembeli. Semua aturan dicek ulang di sini, harga dihitung dari data/menu.json,
// jadi angka yang dikirim browser tidak dipercaya.
define('SB_API', 1);
require __DIR__ . '/_lib.php';

sb_require_post();
$in = sb_body();
$menu = sb_menu();
$cfg = sb_config();
$C = $menu['config'];
$db = sb_db();
$now = time();

/* --- batas jumlah pesanan per perangkat, supaya tidak dibanjiri pesanan palsu --- */
$st = $db->prepare('SELECT COUNT(*) FROM orders WHERE ip_hash = ? AND created_at > ?');
$st->execute([sb_ip_hash(), $now - (int)$cfg['order_limit_window']]);
if ((int)$st->fetchColumn() >= (int)$cfg['order_limit_max']) {
    sb_fail(429, 'Terlalu banyak pesanan dalam waktu singkat. Coba lagi beberapa menit lagi.');
}

/* --- data pemesan --- */
$name = sb_text($in['name'] ?? '', 80);
if (sb_len($name) < 2) sb_fail(422, 'Isi nama kamu.');
$phone = preg_replace('/\D+/', '', is_string($in['phone'] ?? null) ? $in['phone'] : '');
if (strlen($phone) < 9 || strlen($phone) > 15) sb_fail(422, 'Isi nomor WhatsApp yang benar.');
$note = sb_text($in['note'] ?? '', 500, true);

/* --- cara terima --- */
$mode = $in['mode'] ?? '';
if ($mode !== 'pickup' && $mode !== 'delivery') sb_fail(422, 'Pilih ambil di tempat atau delivery.');

/* --- barang --- */
$byId = [];
foreach ($menu['items'] as $it) $byId[$it['id']] = $it;
$rows = $in['items'] ?? null;
if (!is_array($rows) || !$rows || count($rows) > 40) sb_fail(422, 'Keranjang kosong.');
$qtyById = [];
foreach ($rows as $r) {
    $id = is_array($r) && isset($r['id']) && is_string($r['id']) ? $r['id'] : '';
    $qty = is_array($r) && isset($r['qty']) ? (int)$r['qty'] : 0;
    if ($id === '' || !isset($byId[$id])) sb_fail(422, 'Ada produk yang tidak dikenali. Muat ulang halaman lalu coba lagi.');
    if ($qty < 1 || $qty > 50) sb_fail(422, 'Jumlah produk tidak valid.');
    $qtyById[$id] = min(50, ($qtyById[$id] ?? 0) + $qty);
}
$lines = [];
$subtotal = 0;
foreach ($qtyById as $id => $qty) {
    $it = $byId[$id];
    if (!empty($it['soldOut'])) sb_fail(422, $it['name'] . ' sedang habis. Hapus dari keranjang lalu coba lagi.');
    $price = (int)$it['price'];
    $lines[] = ['id' => $id, 'name' => $it['name'], 'price' => $price, 'qty' => $qty];
    $subtotal += $price * $qty;
}

/* --- tanggal dan jam --- */
$date = $in['date'] ?? '';
$d = is_string($date) ? DateTime::createFromFormat('!Y-m-d', $date) : false;
if (!$d || $d->format('Y-m-d') !== $date) sb_fail(422, 'Pilih tanggal.');
$today = new DateTime('today');
if ($d < $today) sb_fail(422, 'Tanggal sudah lewat.');
if ($d > (clone $today)->modify('+60 days')) sb_fail(422, 'Tanggal terlalu jauh. Pilih maksimal 60 hari ke depan.');
$dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
$dow = (int)$d->format('w');
if (in_array($dow, $C['closedDays'], true)) sb_fail(422, 'Kami tutup hari ' . $dayNames[$dow] . '. Pilih tanggal lain.');

$slotLabel = is_string($in['slot'] ?? null) ? $in['slot'] : '';
$slot = null;
foreach ($C['slots'] as $s) { if ($s['label'] === $slotLabel) $slot = $s; }
if (!$slot) sb_fail(422, 'Pilih jam ' . ($mode === 'delivery' ? 'antar.' : 'ambil.'));
if ($d == $today) {
    $nowHour = (int)date('G', $now) + (int)date('i', $now) / 60;
    if ($slot['start'] <= $nowHour + 1) sb_fail(422, 'Jam itu sudah terlalu dekat atau lewat. Pilih jam lain.');
}

/* --- delivery --- */
$fee = 0; $zoneLabel = null; $address = null;
if ($mode === 'delivery') {
    $zone = null;
    foreach ($C['zones'] as $z) { if ($z['id'] === ($in['zone'] ?? '')) $zone = $z; }
    if (!$zone) sb_fail(422, 'Pilih area antar.');
    $address = sb_text($in['address'] ?? '', 300, true);
    if (sb_len($address) < 5) sb_fail(422, 'Isi alamat lengkap untuk pengantaran.');
    if ($subtotal < (int)$C['minDelivery']) {
        sb_fail(422, 'Minimal pesanan antar Rp ' . number_format((int)$C['minDelivery'], 0, ',', '.') . '.');
    }
    $fee = (int)$zone['fee'];
    $zoneLabel = $zone['label'];
}

/* --- pembayaran --- */
$payment = null;
foreach ($C['payments'] as $p) { if ($p['id'] === ($in['payment'] ?? '')) $payment = $p['id']; }
if (!$payment) sb_fail(422, 'Pilih metode pembayaran.');

/* --- simpan --- */
$publicId = bin2hex(random_bytes(8));
try {
    $db->beginTransaction();
    $ins = $db->prepare('INSERT INTO orders (public_id, created_at, updated_at, status, paid, name, phone, mode, date, slot, zone_label, address, payment, note, subtotal, fee, total, ip_hash)
        VALUES (?, ?, ?, "baru", 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $ins->execute([$publicId, $now, $now, $name, $phone, $mode, $date, $slot['label'], $zoneLabel, $address, $payment,
        $note === '' ? null : $note, $subtotal, $fee, $subtotal + $fee, sb_ip_hash()]);
    $orderId = (int)$db->lastInsertId();
    $li = $db->prepare('INSERT INTO order_items (order_id, item_id, name, price, qty) VALUES (?, ?, ?, ?, ?)');
    foreach ($lines as $l) $li->execute([$orderId, $l['id'], $l['name'], $l['price'], $l['qty']]);
    $db->commit();
} catch (Exception $e) {
    if ($db->inTransaction()) $db->rollBack();
    error_log('[sweetbite] simpan pesanan: ' . $e->getMessage());
    sb_fail(500, 'Pesanan belum tersimpan. Coba lagi sebentar lagi.');
}

sb_json(['id' => $publicId, 'code' => sb_code($orderId), 'total' => $subtotal + $fee], 201);
