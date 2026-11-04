<?php
// Semua yang dibutuhkan halaman owner: masuk, keluar, daftar pesanan, dan ubah status.
// Memakai ?action=me|login|logout|list|update
define('SB_API', 1);
require __DIR__ . '/_lib.php';

$action = $_GET['action'] ?? '';
$cfg = sb_config();
$db = sb_db();
$shop = sb_menu()['config']['shop'] ?? 'Toko';
$configured = $cfg['owner_password_hash'] !== '';

if ($action === 'me') {
    sb_json(['configured' => $configured, 'loggedIn' => $configured && sb_is_owner(), 'shop' => $shop]);
}

if ($action === 'login') {
    sb_require_post();
    if (!$configured) sb_fail(503, 'Kata sandi owner belum dibuat. Jalankan: php tools/set-owner-password.php');
    $ip = sb_ip_hash();
    $now = time();
    $db->prepare('DELETE FROM login_attempts WHERE at < ?')->execute([$now - 3600]);
    $st = $db->prepare('SELECT COUNT(*) FROM login_attempts WHERE ip_hash = ? AND at > ?');
    $st->execute([$ip, $now - 600]);
    if ((int)$st->fetchColumn() >= 6) sb_fail(429, 'Terlalu banyak percobaan. Coba lagi 10 menit lagi.');

    $in = sb_body();
    $pw = is_string($in['password'] ?? null) ? $in['password'] : '';
    if ($pw === '' || !password_verify($pw, $cfg['owner_password_hash'])) {
        $db->prepare('INSERT INTO login_attempts (ip_hash, at) VALUES (?, ?)')->execute([$ip, $now]);
        usleep(400000);
        sb_fail(401, 'Kata sandi salah.');
    }
    sb_session();
    session_regenerate_id(true);
    $_SESSION['owner'] = true;
    $_SESSION['t'] = $now;
    $db->prepare('DELETE FROM login_attempts WHERE ip_hash = ?')->execute([$ip]);
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
    $rows = $db->query('SELECT * FROM orders ORDER BY created_at DESC, id DESC LIMIT 300')->fetchAll();
    $ids = array_map(function ($r) { return (int)$r['id']; }, $rows);
    $items = sb_items_for($ids);
    $orders = [];
    foreach ($rows as $r) $orders[] = sb_order_view($r, $items[(int)$r['id']] ?? [], true);

    $counts = array_fill_keys(SB_STATUSES, 0);
    foreach ($db->query('SELECT status, COUNT(*) AS n FROM orders GROUP BY status')->fetchAll() as $c) $counts[$c['status']] = (int)$c['n'];

    $start = strtotime('today');
    $st = $db->prepare('SELECT COUNT(*) AS n, COALESCE(SUM(total), 0) AS revenue FROM orders WHERE created_at >= ? AND status != "dibatalkan"');
    $st->execute([$start]);
    $today = $st->fetch();
    $unpaid = (int)$db->query('SELECT COUNT(*) FROM orders WHERE paid = 0 AND status NOT IN ("dibatalkan", "selesai")')->fetchColumn();

    sb_json([
        'orders' => $orders,
        'counts' => $counts,
        'today' => ['orders' => (int)$today['n'], 'revenue' => (int)$today['revenue']],
        'unpaid' => $unpaid,
        'now' => time(),
    ]);
}

if ($action === 'update') {
    sb_require_post();
    sb_require_owner();
    $in = sb_body();
    $id = (int)($in['id'] ?? 0);
    $st = $db->prepare('SELECT * FROM orders WHERE id = ?');
    $st->execute([$id]);
    $row = $st->fetch();
    if (!$row) sb_fail(404, 'Pesanan tidak ditemukan.');

    $status = $row['status'];
    $paid = (int)$row['paid'];
    if (array_key_exists('status', $in)) {
        if (!is_string($in['status']) || !in_array($in['status'], SB_STATUSES, true)) sb_fail(422, 'Status tidak dikenal.');
        $status = $in['status'];
    }
    if (array_key_exists('paid', $in)) $paid = $in['paid'] ? 1 : 0;

    $db->prepare('UPDATE orders SET status = ?, paid = ?, updated_at = ? WHERE id = ?')->execute([$status, $paid, time(), $id]);
    $st->execute([$id]);
    $row = $st->fetch();
    $items = sb_items_for([$id]);
    sb_json(sb_order_view($row, $items[$id] ?? [], true));
}

sb_fail(404, 'Tidak ditemukan.');
