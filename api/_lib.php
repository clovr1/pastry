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
    return ['seq' => 0, 'orders' => [], 'attempts' => []];
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
    ];
    if ($owner) {
        $view['id'] = (int)$o['id'];
        $view['phone'] = $o['phone'];
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
