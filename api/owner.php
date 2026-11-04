<?php
// Semua yang dibutuhkan halaman owner: masuk, keluar, daftar pesanan, dan ubah status.
// Memakai ?action=me|login|logout|list|update
define('SB_API', 1);
require __DIR__ . '/_lib.php';

$action = $_GET['action'] ?? '';
$cfg = sb_config();
$shop = sb_menu()['config']['shop'] ?? 'Toko';
$configured = $cfg['owner_password_hash'] !== '';

if ($action === 'me') {
    sb_json(['configured' => $configured, 'loggedIn' => $configured && sb_is_owner(), 'shop' => $shop]);
}

if ($action === 'login') {
    sb_require_post();
    if (!$configured) sb_fail(503, 'Kata sandi owner belum dibuat. Jalankan: php tools/set-owner-password.php');
    $in = sb_body();
    $pw = is_string($in['password'] ?? null) ? $in['password'] : '';
    $ip = sb_ip_hash();
    $now = time();
    $hash = $cfg['owner_password_hash'];

    $result = sb_store_update(function (&$d) use ($ip, $now, $pw, $hash) {
        // buang catatan percobaan yang sudah lama, lalu hitung yang terbaru dari perangkat ini
        $d['attempts'] = array_values(array_filter($d['attempts'], function ($a) use ($now) { return $a['at'] > $now - 3600; }));
        $recent = 0;
        foreach ($d['attempts'] as $a) { if ($a['ip'] === $ip && $a['at'] > $now - 600) $recent++; }
        if ($recent >= 6) return 'blocked';
        if ($pw === '' || !password_verify($pw, $hash)) {
            $d['attempts'][] = ['ip' => $ip, 'at' => $now];
            return 'wrong';
        }
        $d['attempts'] = array_values(array_filter($d['attempts'], function ($a) use ($ip) { return $a['ip'] !== $ip; }));
        return 'ok';
    });

    if ($result === 'blocked') sb_fail(429, 'Terlalu banyak percobaan. Coba lagi 10 menit lagi.');
    if ($result === 'wrong') { usleep(400000); sb_fail(401, 'Kata sandi salah.'); }
    sb_session();
    session_regenerate_id(true);
    $_SESSION['owner'] = true;
    $_SESSION['t'] = $now;
    sb_json(['ok' => true]);
}

if ($action === 'logout') {
    sb_require_post();
    sb_session();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $p['path'], 'secure' => $p['secure'], 'httponly' => true, 'samesite' => 'Strict']);
    }
    session_destroy();
    sb_json(['ok' => true]);
}

if ($action === 'list') {
    sb_require_owner();
    $all = sb_store_read()['orders'];

    $counts = array_fill_keys(SB_STATUSES, 0);
    $start = strtotime('today');
    $todayOrders = 0; $revenue = 0; $unpaid = 0;
    foreach ($all as $o) {
        if (isset($counts[$o['status']])) $counts[$o['status']]++;
        if ($o['created_at'] >= $start && $o['status'] !== 'dibatalkan') { $todayOrders++; $revenue += (int)$o['total']; }
        if (!$o['paid'] && $o['status'] !== 'dibatalkan' && $o['status'] !== 'selesai') $unpaid++;
    }

    $orders = [];
    for ($i = count($all) - 1; $i >= 0 && count($orders) < 300; $i--) $orders[] = sb_order_view($all[$i], true);

    sb_json([
        'orders' => $orders,
        'counts' => $counts,
        'today' => ['orders' => $todayOrders, 'revenue' => $revenue],
        'unpaid' => $unpaid,
        'now' => time(),
    ]);
}

if ($action === 'update') {
    sb_require_post();
    sb_require_owner();
    $in = sb_body();
    $id = (int)($in['id'] ?? 0);
    $newStatus = null;
    if (array_key_exists('status', $in)) {
        if (!is_string($in['status']) || !in_array($in['status'], SB_STATUSES, true)) sb_fail(422, 'Status tidak dikenal.');
        $newStatus = $in['status'];
    }
    $hasPaid = array_key_exists('paid', $in);
    $paid = $hasPaid && $in['paid'] ? 1 : 0;

    $updated = sb_store_update(function (&$d) use ($id, $newStatus, $hasPaid, $paid) {
        foreach ($d['orders'] as &$o) {
            if ((int)$o['id'] !== $id) continue;
            if ($newStatus !== null) $o['status'] = $newStatus;
            if ($hasPaid) $o['paid'] = $paid;
            $o['updated_at'] = time();
            return $o;
        }
        return null;
    });
    if (!$updated) sb_fail(404, 'Pesanan tidak ditemukan.');
    sb_json(sb_order_view($updated, true));
}

sb_fail(404, 'Tidak ditemukan.');
