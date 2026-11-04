<?php
// Fungsi bersama untuk semua endpoint API. Tidak dipanggil langsung dari browser.
if (!defined('SB_API')) { http_response_code(403); exit; }

define('SB_ROOT', dirname(__DIR__));

const SB_STATUSES = ['baru', 'dikonfirmasi', 'disiapkan', 'siap', 'selesai', 'dibatalkan'];

const SB_SCHEMA = '
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT "baru",
  paid INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  mode TEXT NOT NULL,
  date TEXT NOT NULL,
  slot TEXT NOT NULL,
  zone_label TEXT,
  address TEXT,
  payment TEXT NOT NULL,
  note TEXT,
  subtotal INTEGER NOT NULL,
  fee INTEGER NOT NULL,
  total INTEGER NOT NULL,
  ip_hash TEXT
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  qty INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS login_attempts (
  ip_hash TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_ip ON orders(ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
';

/* ---------- Pengaturan ---------- */

function sb_config() {
    static $cfg = null;
    if ($cfg !== null) return $cfg;
    $defaults = [
        'owner_password_hash' => '',
        'db_path' => SB_ROOT . '/storage/orders.sqlite',
        'timezone' => 'Asia/Jakarta',
        'order_limit_max' => 8,
        'order_limit_window' => 600,
    ];
    $file = __DIR__ . '/config.php';
    $user = is_file($file) ? require $file : [];
    $cfg = array_merge($defaults, is_array($user) ? $user : []);
    date_default_timezone_set($cfg['timezone']);
    return $cfg;
}

function sb_menu() {
    static $menu = null;
    if ($menu !== null) return $menu;
    $raw = @file_get_contents(SB_ROOT . '/data/menu.json');
    $menu = json_decode($raw ? $raw : '', true);
    if (!is_array($menu) || !isset($menu['config'], $menu['cats'], $menu['items'])) {
        sb_fail(500, 'Data menu tidak terbaca. Periksa file data/menu.json.');
    }
    sb_config(); // pastikan zona waktu terpasang
    return $menu;
}

/* ---------- Respons ---------- */

function sb_json($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function sb_fail($code, $message) {
    sb_json(['error' => $message], $code);
}

function sb_body() {
    $raw = file_get_contents('php://input', false, null, 0, 40001);
    if ($raw === false || strlen($raw) > 40000) sb_fail(413, 'Data terlalu besar.');
    $data = json_decode($raw, true);
    if (!is_array($data)) sb_fail(400, 'Data tidak valid.');
    return $data;
}

// Permintaan yang mengubah data harus POST dan membawa header khusus.
// Form dari situs lain tidak bisa menambahkan header ini tanpa izin browser (CORS).
function sb_require_post() {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST');
        sb_fail(405, 'Metode tidak diizinkan.');
    }
    if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'sb') sb_fail(403, 'Permintaan ditolak.');
}

/* ---------- Database ---------- */

function sb_db() {
    static $pdo = null;
    if ($pdo !== null) return $pdo;
    $path = sb_config()['db_path'];
    $dir = dirname($path);

    // Periksa penyebab yang paling sering terjadi, supaya pesannya bisa langsung ditindaklanjuti.
    if (!extension_loaded('pdo_sqlite')) {
        sb_fail(500, 'Ekstensi PHP pdo_sqlite belum aktif. Di Laragon: klik kanan ikon Laragon > PHP > Extensions > centang pdo_sqlite dan sqlite3, lalu Stop All dan Start All.');
    }
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    if (!is_dir($dir)) {
        sb_fail(500, 'Folder database tidak ada dan tidak bisa dibuat: ' . basename($dir) . '. Buat folder itu secara manual.');
    }
    if (!is_writable($dir) || (is_file($path) && !is_writable($path))) {
        sb_fail(500, 'Folder ' . basename($dir) . ' tidak bisa ditulis oleh PHP. Beri izin tulis ke folder itu (klik kanan > Properties > Security) atau pindahkan proyek ke C:\\laragon\\www.');
    }

    try {
        $pdo = new PDO('sqlite:' . $path);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $pdo->exec('PRAGMA busy_timeout = 5000');
        $pdo->exec('PRAGMA journal_mode = WAL');
        $pdo->exec('PRAGMA foreign_keys = ON');
        $pdo->exec(SB_SCHEMA);
    } catch (Exception $e) {
        error_log('[sweetbite] database: ' . $e->getMessage());
        sb_fail(500, 'Database tidak bisa dibuka. Lihat log error PHP (di Laragon: Menu > Logs) untuk detailnya.');
    }
    return $pdo;
}

function sb_ip_hash() {
    return hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|sweetbite');
}

/* ---------- Pesanan ---------- */

function sb_code($id) {
    $prefix = sb_menu()['config']['orderPrefix'] ?? 'SB';
    return $prefix . '-' . str_pad((string)$id, 4, '0', STR_PAD_LEFT);
}

function sb_items_for(array $orderIds) {
    if (!$orderIds) return [];
    $in = implode(',', array_fill(0, count($orderIds), '?'));
    $st = sb_db()->prepare("SELECT order_id, item_id, name, price, qty FROM order_items WHERE order_id IN ($in) ORDER BY id");
    $st->execute(array_values($orderIds));
    $by = [];
    foreach ($st->fetchAll() as $r) {
        $by[$r['order_id']][] = [
            'id' => $r['item_id'],
            'name' => $r['name'],
            'price' => (int)$r['price'],
            'qty' => (int)$r['qty'],
        ];
    }
    return $by;
}

function sb_payment_label($id) {
    foreach (sb_menu()['config']['payments'] ?? [] as $p) {
        if ($p['id'] === $id) return $p['label'];
    }
    return $id;
}

// $owner = true menambahkan data pemesan yang hanya perlu dilihat pemilik toko.
function sb_order_view(array $r, array $items, $owner) {
    $view = [
        'code' => sb_code($r['id']),
        'publicId' => $r['public_id'],
        'status' => $r['status'],
        'paid' => (bool)$r['paid'],
        'mode' => $r['mode'],
        'date' => $r['date'],
        'slot' => $r['slot'],
        'zone' => $r['zone_label'],
        'address' => $r['address'],
        'payment' => $r['payment'],
        'paymentLabel' => sb_payment_label($r['payment']),
        'note' => $r['note'],
        'subtotal' => (int)$r['subtotal'],
        'fee' => (int)$r['fee'],
        'total' => (int)$r['total'],
        'createdAt' => (int)$r['created_at'],
        'updatedAt' => (int)$r['updated_at'],
        'items' => $items,
    ];
    if ($owner) {
        $view['id'] = (int)$r['id'];
        $view['name'] = $r['name'];
        $view['phone'] = $r['phone'];
    } else {
        $view['name'] = $r['name'];
    }
    return $view;
}

/* ---------- Sesi pemilik toko ---------- */

function sb_session() {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    session_name('sb_owner');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
    // keluar otomatis kalau tidak ada aktivitas lebih dari 12 jam
    if (!empty($_SESSION['owner']) && isset($_SESSION['t']) && time() - $_SESSION['t'] > 43200) {
        $_SESSION = [];
    }
    if (!empty($_SESSION['owner'])) $_SESSION['t'] = time();
}

function sb_is_owner() {
    // pengunjung tanpa cookie sesi tidak perlu dibuatkan sesi baru
    if (session_status() !== PHP_SESSION_ACTIVE && empty($_COOKIE['sb_owner'])) return false;
    sb_session();
    return !empty($_SESSION['owner']);
}

function sb_require_owner() {
    if (!sb_is_owner()) sb_fail(401, 'Silakan masuk dulu.');
}

/* ---------- Teks ---------- */

function sb_len($s) {
    return function_exists('mb_strlen') ? mb_strlen($s, 'UTF-8') : strlen($s);
}

// Bersihkan teks dari pemesan: buang karakter kontrol, rapikan spasi, batasi panjang.
function sb_text($v, $max, $multiline = false) {
    if (!is_string($v)) return '';
    if (function_exists('mb_check_encoding') && !mb_check_encoding($v, 'UTF-8')) return '';
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v);
    if ($v === null) return '';
    if (!$multiline) $v = preg_replace('/\s+/u', ' ', $v);
    $v = trim($v === null ? '' : $v);
    if (sb_len($v) > $max) $v = function_exists('mb_substr') ? mb_substr($v, 0, $max, 'UTF-8') : substr($v, 0, $max);
    return $v;
}
