<?php
// Fungsi bersama untuk semua endpoint API. Tidak dipanggil langsung dari browser.
// Penyimpanan memakai satu file JSON (storage/store*.json), jadi tidak butuh ekstensi PHP tambahan.
if (!defined('SB_API')) { http_response_code(403); exit; }

// Galat PHP tidak boleh tampil ke pembeli: pesannya bisa merusak respons JSON dan membuka detail server.
@ini_set('display_errors', '0');
@ini_set('log_errors', '1');
error_reporting(E_ALL);

define('SB_ROOT', dirname(__DIR__));

const SB_STATUSES = ['baru', 'dikonfirmasi', 'disiapkan', 'siap', 'selesai', 'dibatalkan'];

/* ---------- Pengaturan ---------- */

function sb_config() {
    static $cfg = null;
    if ($cfg !== null) return $cfg;
    $defaults = [
        'owner_password_hash' => '',
        'data_file' => 'store.json',
        'timezone' => 'Asia/Jakarta',
        'order_limit_max' => 8,
        'order_limit_window' => 600,
    ];
    $file = __DIR__ . '/config.php';
    $user = is_file($file) ? require $file : [];
    $cfg = array_merge($defaults, is_array($user) ? $user : []);
    $cfg['data_path'] = SB_ROOT . '/storage/' . basename((string)$cfg['data_file']);
    date_default_timezone_set($cfg['timezone']);
    return $cfg;
}

// Sorotan launching di beranda: daftar yang diatur owner (config.featured); kalau belum pernah diatur,
// otomatis memakai bundle pertama dan produk berlabel "Baru" pertama.
function sb_auto_featured(array $m) {
    $out = [];
    foreach ($m['items'] as $it) {
        if (($it['cat'] ?? '') === 'paket') { $out[] = ['id' => $it['id'], 'label' => 'Bundle baru', 'headline' => $it['name'], 'text' => $it['desc'] ?? '']; break; }
    }
    foreach ($m['items'] as $it) {
        if (($it['tag'] ?? '') === 'Baru') { $out[] = ['id' => $it['id'], 'label' => 'Baru launching', 'headline' => $it['name'], 'text' => $it['desc'] ?? '']; break; }
    }
    return $out;
}

// Menu dibaca dari storage/menu-live.json kalau owner sudah pernah mengubahnya lewat dashboard,
// kalau belum dari data/menu.json (data awal). Stok per produk disimpan di file pesanan dan digabungkan di sini.
function sb_menu_path() {
    $live = SB_ROOT . '/storage/menu-live.json';
    return is_file($live) ? $live : SB_ROOT . '/data/menu.json';
}

function sb_menu($reload = false) {
    static $menu = null;
    if ($menu !== null && !$reload) return $menu;
    $raw = @file_get_contents(sb_menu_path());
    $menu = json_decode($raw ? $raw : '', true);
    if (!is_array($menu) || !isset($menu['config'], $menu['cats'], $menu['items'])) {
        sb_fail(500, 'Data menu tidak terbaca. Periksa file data/menu.json.');
    }
    sb_config(); // pastikan zona waktu terpasang
    if (!isset($menu['config']['acceptOrders'])) $menu['config']['acceptOrders'] = true;
    if (!isset($menu['config']['closedNote'])) $menu['config']['closedNote'] = '';
    if (!array_key_exists('quote', $menu['config'])) $menu['config']['quote'] = ['text' => "Il y a cinq beaux-arts : la peinture, la sculpture, la poésie, la musique, l’architecture, laquelle a pour branche principale la pâtisserie.", 'author' => 'Marie-Antoine Carême', 'role' => 'Pâtissier français, 1783–1833', 'lang' => 'fr'];
    if (!isset($menu['config']['featured']) || !is_array($menu['config']['featured'])) $menu['config']['featured'] = sb_auto_featured($menu);
    // dibaca tanpa kunci: file ditulis lewat rename, jadi isinya selalu utuh
    $stock = is_file(sb_config()['data_path']) ? sb_store_load(sb_config()['data_path'])['stock'] : [];
    foreach ($menu['items'] as &$it) {
        if (isset($stock[$it['id']])) {
            $it['stock'] = (int)$stock[$it['id']];
            if ($it['stock'] <= 0) $it['soldOut'] = true;
        } else {
            $it['stock'] = null;
        }
    }
    unset($it);
    return $menu;
}

// Mengubah menu (hanya dari dashboard owner). $fn menerima menu lewat reference; menu disimpan ke storage/menu-live.json.
function sb_menu_update($fn) {
    sb_store_check();
    $dir = SB_ROOT . '/storage';
    $lock = @fopen($dir . '/menu.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX)) sb_fail(500, 'Penyimpanan sedang sibuk. Coba lagi sebentar lagi.');
    $src = sb_menu_path();
    $m = json_decode((string)@file_get_contents($src), true);
    if (!is_array($m) || !isset($m['config'], $m['cats'], $m['items'])) sb_fail(500, 'Data menu tidak terbaca.');
    $result = $fn($m);
    if ($result === false) { flock($lock, LOCK_UN); fclose($lock); return false; }
    $json = json_encode($m, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($json === false) sb_fail(500, 'Data menu tidak bisa disimpan.');
    $live = $dir . '/menu-live.json';
    if (is_file($live)) @copy($live, $dir . '/menu-live.bak.json');
    $tmp = $live . '.tmp';
    if (@file_put_contents($tmp, $json) === false || !@rename($tmp, $live)) {
        @unlink($tmp);
        sb_fail(500, 'Perubahan belum tersimpan. Pastikan folder storage bisa ditulis.');
    }
    flock($lock, LOCK_UN);
    fclose($lock);
    return $result;
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

/* ---------- Penyimpanan (satu file JSON, dikunci saat dipakai) ---------- */

function sb_store_check() {
    static $ok = false;
    if ($ok) return;
    $dir = dirname(sb_config()['data_path']);
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    if (!is_dir($dir)) {
        sb_fail(500, 'Folder penyimpanan tidak ada dan tidak bisa dibuat: ' . basename($dir) . '. Buat folder itu secara manual.');
    }
    if (!is_writable($dir)) {
        sb_fail(500, 'Folder ' . basename($dir) . ' tidak bisa ditulis oleh PHP. Beri izin tulis ke folder itu atau pindahkan proyek ke C:\\laragon\\www.');
    }
    $ok = true;
}

function sb_store_empty() {
    return ['seq' => 0, 'orders' => [], 'attempts' => [], 'users' => [], 'useq' => 0, 'stock' => []];
}

function sb_store_load($path) {
    if (!is_file($path)) return sb_store_empty();
    $raw = @file_get_contents($path);
    if ($raw === false) sb_fail(500, 'Data pesanan tidak bisa dibaca.');
    if (trim($raw) === '') return sb_store_empty();
    $d = json_decode($raw, true);
    if (!is_array($d) || !isset($d['orders'], $d['seq']) || !is_array($d['orders'])) {
        error_log('[sweetbite] file data rusak: ' . $path);
        sb_fail(500, 'File data pesanan rusak. Jangan dihapus. Pulihkan dari salinan backup-*.json di folder storage.');
    }
    if (!isset($d['attempts']) || !is_array($d['attempts'])) $d['attempts'] = [];
    if (!isset($d['users']) || !is_array($d['users'])) $d['users'] = [];
    if (!isset($d['useq'])) $d['useq'] = 0;
    if (!isset($d['stock']) || !is_array($d['stock'])) $d['stock'] = [];
    return $d;
}

function sb_store_lock($exclusive) {
    sb_store_check();
    $fh = @fopen(dirname(sb_config()['data_path']) . '/store.lock', 'c');
    if (!$fh || !flock($fh, $exclusive ? LOCK_EX : LOCK_SH)) {
        if ($fh) fclose($fh);
        sb_fail(500, 'Penyimpanan sedang sibuk. Coba lagi sebentar lagi.');
    }
    return $fh;
}

function sb_store_read() {
    $fh = sb_store_lock(false);
    $d = sb_store_load(sb_config()['data_path']);
    flock($fh, LOCK_UN);
    fclose($fh);
    return $d;
}

// Salinan harian otomatis, disimpan 14 hari, supaya riwayat pesanan tidak hilang kalau file rusak.
function sb_store_backup($path) {
    if (!is_file($path)) return;
    $dir = dirname($path);
    $copy = $dir . '/backup-' . date('Ymd') . '.json';
    if (is_file($copy)) return;
    @copy($path, $copy);
    foreach (glob($dir . '/backup-*.json') ?: [] as $f) {
        if (filemtime($f) < time() - 14 * 86400) @unlink($f);
    }
}

// Menjalankan $fn($data) dengan file terkunci, lalu menyimpan perubahannya. $fn menerima data lewat reference.
function sb_store_update($fn) {
    $fh = sb_store_lock(true);
    $path = sb_config()['data_path'];
    $d = sb_store_load($path);
    $result = $fn($d);
    $json = json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) sb_fail(500, 'Data tidak bisa disimpan.');
    sb_store_backup($path);
    $tmp = $path . '.tmp';
    if (@file_put_contents($tmp, $json) === false || !@rename($tmp, $path)) {
        @unlink($tmp);
        error_log('[sweetbite] gagal menulis ' . $path);
        sb_fail(500, 'Pesanan belum tersimpan. Pastikan folder storage bisa ditulis, lalu coba lagi.');
    }
    flock($fh, LOCK_UN);
    fclose($fh);
    return $result;
}

function sb_ip_hash() {
    return hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|sweetbite');
}

/* ---------- Pesanan ---------- */

function sb_code($id) {
    $prefix = sb_menu()['config']['orderPrefix'] ?? 'SB';
    return $prefix . '-' . str_pad((string)$id, 4, '0', STR_PAD_LEFT);
}

function sb_payment_label($id) {
    foreach (sb_menu()['config']['payments'] ?? [] as $p) {
        if ($p['id'] === $id) return $p['label'];
    }
    return $id;
}

// $owner = true menambahkan data pemesan yang hanya perlu dilihat pemilik toko.
function sb_order_view(array $o, $owner) {
    $view = [
        'code' => sb_code($o['id']),
        'publicId' => $o['public_id'],
        'status' => $o['status'],
        'paid' => (bool)$o['paid'],
        'mode' => $o['mode'],
        'date' => $o['date'],
        'slot' => $o['slot'],
        'zone' => $o['zone_label'],
        'address' => $o['address'],
        'payment' => $o['payment'],
        'paymentLabel' => sb_payment_label($o['payment']),
        'note' => $o['note'],
        'subtotal' => (int)$o['subtotal'],
        'fee' => (int)$o['fee'],
        'total' => (int)$o['total'],
        'createdAt' => (int)$o['created_at'],
        'updatedAt' => (int)$o['updated_at'],
        'items' => array_map(function ($i) {
            return ['id' => $i['id'], 'name' => $i['name'], 'price' => (int)$i['price'], 'qty' => (int)$i['qty']];
        }, $o['items']),
        'name' => $o['name'],
        'payClaim' => !empty($o['pay_claim']),
    ];
    if ($owner) {
        $view['id'] = (int)$o['id'];
        $view['phone'] = $o['phone'];
        $view['proof'] = $o['proof'] ?? null;
        $view['payClaimAt'] = (int)($o['pay_claim'] ?? 0);
    }
    return $view;
}

/* ---------- Sesi pemilik toko ---------- */

// Sesi disimpan di storage/sessions (folder tertutup dari web), terpisah untuk owner (sb_owner) dan pembeli (sb_user).
function sb_session_start($name, $lifetime) {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    sb_store_check();
    $dir = SB_ROOT . '/storage/sessions';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    if (is_dir($dir) && is_writable($dir)) session_save_path($dir);
    @ini_set('session.gc_maxlifetime', (string)(31 * 86400));
    session_name($name);
    session_set_cookie_params([
        'lifetime' => $lifetime,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

function sb_session() {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    sb_session_start('sb_owner', 0);
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

/* ---------- Akun pembeli ---------- */

// Membuka sesi pembeli untuk ditulis (masuk/keluar/ganti data). Dipanggil hanya dari api/user.php.
function sb_user_session() {
    sb_session_start('sb_user', 30 * 86400);
}

// Id pembeli yang sedang masuk (atau 0). Hanya membaca, lalu langsung melepas kunci sesi.
function sb_user_id() {
    if (empty($_COOKIE['sb_user'])) return 0;
    if (session_status() !== PHP_SESSION_ACTIVE) sb_session_start('sb_user', 30 * 86400);
    $id = (int)($_SESSION['uid'] ?? 0);
    session_write_close();
    return $id;
}

function sb_user_find(array $d, $id) {
    foreach ($d['users'] as $u) { if ((int)$u['id'] === (int)$id) return $u; }
    return null;
}

function sb_user_view(array $u) {
    return ['name' => $u['name'], 'email' => $u['email'], 'phone' => $u['phone']];
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
