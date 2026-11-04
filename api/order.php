<?php
// Menerima pesanan dari pembeli. Semua aturan dicek ulang di sini, harga dihitung dari data/menu.json,
// jadi angka yang dikirim browser tidak dipercaya.
define('SB_API', 1);
require __DIR__ . '/_lib.php';

$action = $_GET['action'] ?? 'create';   // create (tunai) | prepare (cek pesanan + tampilkan cara bayar) | confirm (sudah bayar, buat pesanan) | proof (unggah bukti)
sb_require_post();

/* --- unggah bukti pembayaran (opsional): disimpan di storage/proofs, hanya owner yang bisa melihat --- */
if ($action === 'proof') {
    $ip = sb_ip_hash();
    $limited = sb_store_update(function (&$d) use ($ip) {
        $now = time();
        $d['attempts'] = array_values(array_filter($d['attempts'], function ($a) use ($now) { return $a['at'] > $now - 3600; }));
        $n = 0;
        foreach ($d['attempts'] as $a) { if ($a['ip'] === 'f|' . $ip && $a['at'] > $now - 600) $n++; }
        if ($n >= 8) return true;
        $d['attempts'][] = ['ip' => 'f|' . $ip, 'at' => $now];
        return false;
    });
    if ($limited) sb_fail(429, 'Terlalu banyak unggahan. Coba lagi beberapa menit lagi.');
    $f = $_FILES['photo'] ?? null;
    if (!$f || !is_uploaded_file($f['tmp_name'] ?? '')) sb_fail(422, 'Pilih foto bukti pembayaran dulu.');
    if (($f['error'] ?? 0) !== UPLOAD_ERR_OK || $f['size'] > 6 * 1024 * 1024) sb_fail(422, 'Foto terlalu besar atau gagal diunggah. Maksimal 6 MB.');
    $info = @getimagesize($f['tmp_name']);
    $types = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'];
    if (!$info || !isset($types[$info[2]])) sb_fail(422, 'Format foto harus JPG, PNG, atau WebP.');
    $dir = SB_ROOT . '/storage/proofs';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    if (!is_dir($dir) || !is_writable($dir)) sb_fail(500, 'Folder penyimpanan bukti tidak bisa ditulis.');
    $name = 'pf-' . bin2hex(random_bytes(6)) . '.' . $types[$info[2]];
    if (!@move_uploaded_file($f['tmp_name'], $dir . '/' . $name)) sb_fail(500, 'Bukti belum tersimpan. Coba lagi.');
    sb_json(['proof' => $name]);
}

$in = sb_body();
$menu = sb_menu();
$cfg = sb_config();
$C = $menu['config'];
$now = time();

/* --- toko sedang tutup (diatur owner) --- */
if (empty($C['acceptOrders'])) {
    $note = trim((string)($C['closedNote'] ?? ''));
    sb_fail(503, 'Toko sedang tutup dan belum menerima pesanan.' . ($note !== '' ? ' ' . $note : ''));
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
$payLabel = '';
foreach ($C['payments'] as $p) { if ($p['id'] === ($in['payment'] ?? '')) { $payment = $p['id']; $payLabel = $p['label']; } }
if (!$payment) sb_fail(422, 'Pilih metode pembayaran.');

/* --- pembayaran di muka (transfer / QRIS): bayar dulu, pesanan baru dibuat --- */
$total = $subtotal + $fee;
$online = $payment !== 'tunai';
$proof = null;
if ($action === 'prepare') {
    if (!$online) sb_fail(422, 'Metode ini tidak perlu bayar di muka.');
    $pi = $C['paymentInfo'][$payment] ?? [];
    $info = $payment === 'qris'
        ? ['image' => (string)($pi['image'] ?? '')]
        : ['bank' => (string)($pi['bank'] ?? ''), 'number' => (string)($pi['number'] ?? ''), 'holder' => (string)($pi['holder'] ?? '')];
    $ready = $payment === 'qris' ? $info['image'] !== '' : ($info['bank'] !== '' && $info['number'] !== '');
    if (!$ready) sb_fail(422, 'Metode ini belum bisa dipakai karena toko belum menyiapkan data pembayarannya. Pilih metode lain atau hubungi toko' . (!empty($C['contact']) ? ' (' . $C['contact'] . ')' : '') . '.');
    // cek stok sekarang supaya pembeli tidak membayar produk yang sudah habis
    $stock = sb_store_read()['stock'];
    foreach ($lines as $l) {
        if (isset($stock[$l['id']]) && (int)$stock[$l['id']] < $l['qty']) {
            sb_fail(422, (int)$stock[$l['id']] > 0 ? 'Stok ' . $l['name'] . ' tinggal ' . (int)$stock[$l['id']] . '. Kurangi jumlahnya lalu coba lagi.' : $l['name'] . ' baru saja habis. Hapus dari keranjang lalu coba lagi.');
        }
    }
    sb_json(['method' => $payment, 'label' => $payLabel, 'total' => $total, 'info' => $info]);
}
if ($online) {
    if ($action !== 'confirm') sb_fail(422, 'Selesaikan pembayaran dulu sebelum pesanan dibuat.');
    if ((int)($in['expectTotal'] ?? -1) !== $total) sb_fail(409, 'Total pesanan berubah (' . 'Rp ' . number_format($total, 0, ',', '.') . '). Muat ulang halaman lalu ulangi pembayaran.');
    $pf = $in['proof'] ?? null;
    if (is_string($pf) && $pf !== '') {
        if (!preg_match('/^pf-[a-f0-9]{12}\.(jpg|png|webp)$/', $pf) || !is_file(SB_ROOT . '/storage/proofs/' . $pf)) sb_fail(422, 'Bukti pembayaran tidak ditemukan. Unggah ulang atau lewati.');
        $proof = $pf;
    }
}

/* --- simpan (dengan batas jumlah pesanan per perangkat, supaya tidak dibanjiri pesanan palsu) --- */
$publicId = bin2hex(random_bytes(8));
$ipHash = sb_ip_hash();
$userId = sb_user_id();   // 0 kalau pembeli memesan tanpa akun
$orderId = sb_store_update(function (&$d) use ($cfg, $now, $ipHash, $userId, $online, $proof, $publicId, $name, $phone, $mode, $date, $slot, $zoneLabel, $address, $payment, $note, $subtotal, $fee, $lines) {
    $recent = 0;
    for ($i = count($d['orders']) - 1; $i >= 0; $i--) {
        if ($d['orders'][$i]['created_at'] <= $now - (int)$cfg['order_limit_window']) break;
        if ($d['orders'][$i]['ip_hash'] === $ipHash) $recent++;
    }
    if ($recent >= (int)$cfg['order_limit_max']) {
        sb_fail(429, 'Terlalu banyak pesanan dalam waktu singkat. Coba lagi beberapa menit lagi.');
    }
    // stok: cek semua produk dulu, baru dikurangi, supaya tidak ada yang berkurang kalau salah satunya kurang
    foreach ($lines as $l) {
        if (isset($d['stock'][$l['id']]) && (int)$d['stock'][$l['id']] < $l['qty']) return ['short' => $l['name'], 'left' => max(0, (int)$d['stock'][$l['id']])];
    }
    foreach ($lines as $l) {
        if (isset($d['stock'][$l['id']])) $d['stock'][$l['id']] = max(0, (int)$d['stock'][$l['id']] - $l['qty']);
    }
    $id = ++$d['seq'];
    $d['orders'][] = [
        'id' => $id, 'public_id' => $publicId, 'created_at' => $now, 'updated_at' => $now,
        'status' => 'baru', 'paid' => 0,
        'name' => $name, 'phone' => $phone, 'mode' => $mode, 'date' => $date, 'slot' => $slot['label'],
        'zone_label' => $zoneLabel, 'address' => $address, 'payment' => $payment,
        'note' => $note === '' ? null : $note,
        'subtotal' => $subtotal, 'fee' => $fee, 'total' => $subtotal + $fee,
        'ip_hash' => $ipHash, 'user_id' => $userId ?: null,
        'pay_claim' => $online ? $now : null, 'proof' => $proof,
        'items' => array_map(function ($l) { return ['id' => $l['id'], 'name' => $l['name'], 'price' => $l['price'], 'qty' => $l['qty']]; }, $lines),
    ];
    return $id;
});

if (is_array($orderId)) {
    sb_fail(422, $orderId['left'] > 0
        ? 'Stok ' . $orderId['short'] . ' tinggal ' . $orderId['left'] . '. Kurangi jumlahnya lalu coba lagi.'
        : $orderId['short'] . ' baru saja habis. Hapus dari keranjang lalu coba lagi.');
}

sb_json(['id' => $publicId, 'code' => sb_code($orderId), 'total' => $subtotal + $fee], 201);
