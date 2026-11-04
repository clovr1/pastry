<?php
// Akun pembeli: daftar, masuk, keluar, ubah data, dan riwayat pesanan.
// Memakai ?action=me|register|login|logout|update|orders
define('SB_API', 1);
require __DIR__ . '/_lib.php';

$action = $_GET['action'] ?? '';

function sb_email($v) {
    $v = is_string($v) ? strtolower(trim($v)) : '';
    return (strlen($v) <= 120 && filter_var($v, FILTER_VALIDATE_EMAIL)) ? $v : '';
}
function sb_phone($v) {
    $p = preg_replace('/\D+/', '', is_string($v) ? $v : '');
    return (strlen($p) >= 9 && strlen($p) <= 15) ? $p : '';
}
function sb_password_ok($v) {
    return is_string($v) && strlen($v) >= 8 && strlen($v) <= 72;
}
// Menghitung percobaan dari satu perangkat dalam $window detik. $key membedakan jenis percobaan.
function sb_attempts_recent(array $d, $key, $ip, $now, $window) {
    $n = 0;
    foreach ($d['attempts'] as $a) { if ($a['ip'] === $key . '|' . $ip && $a['at'] > $now - $window) $n++; }
    return $n;
}
function sb_log_in($uid) {
    sb_user_session();
    session_regenerate_id(true);
    $_SESSION['uid'] = (int)$uid;
}

if ($action === 'me') {
    $uid = sb_user_id();
    if (!$uid) sb_json(['loggedIn' => false]);
    $u = sb_user_find(sb_store_read(), $uid);
    if (!$u) sb_json(['loggedIn' => false]);
    sb_json(['loggedIn' => true, 'user' => sb_user_view($u)]);
}

if ($action === 'register') {
    sb_require_post();
    $in = sb_body();
    $name = sb_text($in['name'] ?? '', 80);
    if (sb_len($name) < 2) sb_fail(422, 'Isi nama kamu.');
    $email = sb_email($in['email'] ?? '');
    if ($email === '') sb_fail(422, 'Isi alamat email yang benar.');
    $phone = sb_phone($in['phone'] ?? '');
    if ($phone === '') sb_fail(422, 'Isi nomor HP (WhatsApp) yang benar.');
    $pw = $in['password'] ?? '';
    if (!sb_password_ok($pw)) sb_fail(422, 'Kata sandi minimal 8 karakter.');
    $hash = password_hash($pw, PASSWORD_DEFAULT);
    $ip = sb_ip_hash();
    $now = time();

    $res = sb_store_update(function (&$d) use ($name, $email, $phone, $hash, $ip, $now) {
        $d['attempts'] = array_values(array_filter($d['attempts'], function ($a) use ($now) { return $a['at'] > $now - 3600; }));
        if (sb_attempts_recent($d, 'r', $ip, $now, 3600) >= 8) return 'blocked';
        foreach ($d['users'] as $u) { if ($u['email'] === $email) return 'exists'; }
        $d['attempts'][] = ['ip' => 'r|' . $ip, 'at' => $now];
        $id = ++$d['useq'];
        $d['users'][] = ['id' => $id, 'name' => $name, 'email' => $email, 'phone' => $phone, 'pass' => $hash, 'created_at' => $now];
        return $id;
    });
    if ($res === 'blocked') sb_fail(429, 'Terlalu banyak pendaftaran dari perangkat ini. Coba lagi nanti.');
    if ($res === 'exists') sb_fail(409, 'Email ini sudah terdaftar. Silakan masuk.');
    sb_log_in($res);
    sb_json(['ok' => true, 'user' => ['name' => $name, 'email' => $email, 'phone' => $phone]], 201);
}

if ($action === 'login') {
    sb_require_post();
    $in = sb_body();
    $email = sb_email($in['email'] ?? '');
    $pw = is_string($in['password'] ?? null) ? $in['password'] : '';
    $ip = sb_ip_hash();
    $now = time();
    // hash palsu supaya waktu proses sama baik email-nya ada maupun tidak
    $dummy = '$2y$10$usesomesillystringforsaltuYQ8l0y4JrYQmZ9n8Zr8y6vO8tK2Wq6';

    $res = sb_store_update(function (&$d) use ($email, $pw, $ip, $now, $dummy) {
        $d['attempts'] = array_values(array_filter($d['attempts'], function ($a) use ($now) { return $a['at'] > $now - 3600; }));
        if (sb_attempts_recent($d, 'u', $ip, $now, 600) >= 8) return 'blocked';
        $found = null;
        foreach ($d['users'] as $u) { if ($email !== '' && $u['email'] === $email) { $found = $u; break; } }
        $ok = password_verify($pw, $found ? $found['pass'] : $dummy) && $found && $pw !== '';
        if (!$ok) { $d['attempts'][] = ['ip' => 'u|' . $ip, 'at' => $now]; return 'wrong'; }
        $d['attempts'] = array_values(array_filter($d['attempts'], function ($a) use ($ip) { return $a['ip'] !== 'u|' . $ip; }));
        return $found;
    });
    if ($res === 'blocked') sb_fail(429, 'Terlalu banyak percobaan. Coba lagi 10 menit lagi.');
    if ($res === 'wrong') { usleep(400000); sb_fail(401, 'Email atau kata sandi salah.'); }
    sb_log_in($res['id']);
    sb_json(['ok' => true, 'user' => sb_user_view($res)]);
}

if ($action === 'logout') {
    sb_require_post();
    sb_user_session();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $p['path'], 'secure' => $p['secure'], 'httponly' => true, 'samesite' => 'Strict']);
    }
    session_destroy();
    sb_json(['ok' => true]);
}

if ($action === 'update') {
    sb_require_post();
    $uid = sb_user_id();
    if (!$uid) sb_fail(401, 'Silakan masuk dulu.');
    $in = sb_body();
    $name = sb_text($in['name'] ?? '', 80);
    if (sb_len($name) < 2) sb_fail(422, 'Isi nama kamu.');
    $phone = sb_phone($in['phone'] ?? '');
    if ($phone === '') sb_fail(422, 'Isi nomor HP (WhatsApp) yang benar.');
    $newPw = $in['newPassword'] ?? '';
    $changePw = is_string($newPw) && $newPw !== '';
    if ($changePw && !sb_password_ok($newPw)) sb_fail(422, 'Kata sandi baru minimal 8 karakter.');
    $oldPw = is_string($in['password'] ?? null) ? $in['password'] : '';
    $newHash = $changePw ? password_hash($newPw, PASSWORD_DEFAULT) : '';

    $res = sb_store_update(function (&$d) use ($uid, $name, $phone, $changePw, $oldPw, $newHash) {
        foreach ($d['users'] as &$u) {
            if ((int)$u['id'] !== $uid) continue;
            if ($changePw) {
                if (!password_verify($oldPw, $u['pass'])) return 'badpw';
                $u['pass'] = $newHash;
            }
            $u['name'] = $name; $u['phone'] = $phone;
            return $u;
        }
        return null;
    });
    if ($res === 'badpw') sb_fail(403, 'Kata sandi lama salah.');
    if (!$res) sb_fail(404, 'Akun tidak ditemukan.');
    sb_json(['ok' => true, 'user' => sb_user_view($res)]);
}

if ($action === 'orders') {
    $uid = sb_user_id();
    if (!$uid) sb_fail(401, 'Silakan masuk dulu.');
    $all = sb_store_read()['orders'];
    $out = [];
    for ($i = count($all) - 1; $i >= 0 && count($out) < 50; $i--) {
        if ((int)($all[$i]['user_id'] ?? 0) === $uid) $out[] = sb_order_view($all[$i], false);
    }
    sb_json(['orders' => $out]);
}

sb_fail(404, 'Tidak ditemukan.');
