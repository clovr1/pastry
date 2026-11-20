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
function sb_log_in($uid, $sv = 0) {
    sb_user_session();
    session_regenerate_id(true);
    $_SESSION['uid'] = (int)$uid;
    $_SESSION['sv'] = (int)$sv;
}


/* ---------- Masuk dengan Google ---------- */
// Token (ID token) dari Google diperiksa di sini: tanda tangannya dicocokkan dengan kunci publik Google,
// lalu tujuan (aud), penerbit (iss), masa berlaku, dan email terverifikasinya dicek.
function sb_b64u($s) {
    $s = strtr((string)$s, '-_', '+/');
    $pad = strlen($s) % 4;
    if ($pad) $s .= str_repeat('=', 4 - $pad);
    return base64_decode($s, true);
}
function sb_http_get($url) {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 6, CURLOPT_CONNECTTIMEOUT => 4, CURLOPT_FOLLOWLOCATION => false]);
        $r = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return ($r !== false && $code === 200) ? $r : null;
    }
    $r = @file_get_contents($url, false, stream_context_create(['http' => ['timeout' => 6, 'ignore_errors' => false]]));
    return $r === false ? null : $r;
}
function sb_der_len($n) { return $n < 128 ? chr($n) : (($n < 256) ? "\x81" . chr($n) : "\x82" . chr($n >> 8) . chr($n & 255)); }
function sb_jwk_pem(array $k) {
    $n = sb_b64u($k['n'] ?? ''); $e = sb_b64u($k['e'] ?? '');
    if ($n === false || $e === false || $n === '' || $e === '') return null;
    $int = function ($b) { if (ord($b[0]) > 127) $b = "\0" . $b; return "\x02" . sb_der_len(strlen($b)) . $b; };
    $seq = $int($n) . $int($e);
    $rsa = "\x30" . sb_der_len(strlen($seq)) . $seq;
    $bits = "\x03" . sb_der_len(strlen($rsa) + 1) . "\0" . $rsa;
    $algo = hex2bin('300d06092a864886f70d0101010500');
    $spki = "\x30" . sb_der_len(strlen($algo . $bits)) . $algo . $bits;
    return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($spki), 64, "\n") . "-----END PUBLIC KEY-----\n";
}
// Kunci publik Google disimpan sebentar di storage supaya tidak diunduh setiap ada yang masuk.
function sb_google_keys($force = false) {
    $file = SB_ROOT . '/storage/google-jwks.json';
    $cache = is_file($file) ? json_decode((string)@file_get_contents($file), true) : null;
    $fresh = is_array($cache) && isset($cache['at'], $cache['keys']) && $cache['at'] > time() - 3600;
    if ($fresh && (!$force || $cache['at'] > time() - 300)) return $cache['keys'];   // unduh ulang paksa paling sering tiap 5 menit
    $raw = sb_http_get('https://www.googleapis.com/oauth2/v3/certs');
    $j = $raw ? json_decode($raw, true) : null;
    if (is_array($j) && !empty($j['keys'])) {
        @file_put_contents($file, json_encode(['at' => time(), 'keys' => $j['keys']]), LOCK_EX);
        return $j['keys'];
    }
    return is_array($cache) && !empty($cache['keys']) ? $cache['keys'] : [];
}
// Mengembalikan data pengguna dari token, atau string kode galat.
function sb_google_verify($token, $clientId) {
    if (!function_exists('openssl_verify')) return 'noopenssl';
    if (!is_string($token) || strlen($token) > 4096 || substr_count($token, '.') !== 2) return 'invalid';
    list($h64, $p64, $s64) = explode('.', $token);
    $h = json_decode((string)sb_b64u($h64), true); $p = json_decode((string)sb_b64u($p64), true); $sig = sb_b64u($s64);
    if (!is_array($h) || !is_array($p) || $sig === false || ($h['alg'] ?? '') !== 'RS256' || empty($h['kid'])) return 'invalid';
    $key = null;
    foreach ([false, true] as $force) {
        foreach (sb_google_keys($force) as $k) { if (($k['kid'] ?? '') === $h['kid'] && ($k['kty'] ?? '') === 'RSA') $key = $k; }
        if ($key) break;
    }
    if (!$key) return 'nokey';
    $pem = sb_jwk_pem($key);
    if (!$pem || openssl_verify($h64 . '.' . $p64, $sig, $pem, OPENSSL_ALGO_SHA256) !== 1) return 'invalid';
    $now = time();
    if (!in_array($p['iss'] ?? '', ['accounts.google.com', 'https://accounts.google.com'], true)) return 'invalid';
    if (($p['aud'] ?? '') !== $clientId) return 'invalid';
    if ((int)($p['exp'] ?? 0) < $now - 30 || (int)($p['iat'] ?? 0) > $now + 300) return 'expired';
    if (!in_array($p['email_verified'] ?? false, [true, 'true'], true)) return 'unverified';
    $email = sb_email($p['email'] ?? '');
    if ($email === '' || empty($p['sub'])) return 'invalid';
    return ['email' => $email, 'sub' => (string)$p['sub'], 'name' => (string)($p['name'] ?? '')];
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
    if (!empty($res['disabled'])) sb_fail(403, 'Akun ini dinonaktifkan oleh toko. Hubungi toko kalau ini keliru.');
    sb_log_in($res['id'], $res['sv'] ?? 0);
    sb_json(['ok' => true, 'user' => sb_user_view($res)]);
}


if ($action === 'google') {
    sb_require_post();
    $cid = (string)(sb_menu()['config']['googleClientId'] ?? '');
    if ($cid === '') sb_fail(503, 'Masuk dengan Google belum diaktifkan oleh toko.');
    $in = sb_body();
    $g = sb_google_verify($in['credential'] ?? '', $cid);
    if (!is_array($g)) {
        $msg = ['noopenssl' => 'Server belum mendukung masuk dengan Google.', 'nokey' => 'Tidak bisa memeriksa token Google. Coba lagi sebentar lagi.', 'expired' => 'Sesi Google sudah kedaluwarsa. Coba lagi.', 'unverified' => 'Email Google kamu belum terverifikasi.'];
        sb_fail($g === 'nokey' || $g === 'noopenssl' ? 503 : 401, $msg[$g] ?? 'Token Google tidak valid.');
    }
    $name = sb_text($g['name'], 80);
    if (sb_len($name) < 2) $name = sb_text(strstr($g['email'], '@', true), 80);
    $ip = sb_ip_hash(); $now = time(); $created = false;
    $res = sb_store_update(function (&$d) use ($g, $name, $ip, $now, &$created) {
        foreach ($d['users'] as &$u) {
            if ($u['email'] !== $g['email']) continue;
            if (!empty($u['disabled'])) return 'disabled';
            if (!empty($u['gsub']) && $u['gsub'] !== $g['sub']) return 'mismatch';
            $u['gsub'] = $g['sub'];
            return $u;
        }
        unset($u);
        $d['attempts'] = array_values(array_filter($d['attempts'], function ($a) use ($now) { return $a['at'] > $now - 3600; }));
        if (sb_attempts_recent($d, 'r', $ip, $now, 3600) >= 8) return 'blocked';
        $d['attempts'][] = ['ip' => 'r|' . $ip, 'at' => $now];
        $id = ++$d['useq'];
        $u = ['id' => $id, 'name' => $name, 'email' => $g['email'], 'phone' => '', 'pass' => password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT), 'created_at' => $now, 'gsub' => $g['sub'], 'nopw' => true];
        $d['users'][] = $u;
        $created = true;
        return $u;
    });
    if ($res === 'disabled') sb_fail(403, 'Akun ini dinonaktifkan oleh toko. Hubungi toko kalau ini keliru.');
    if ($res === 'mismatch') sb_fail(409, 'Email ini terhubung ke akun Google yang lain.');
    if ($res === 'blocked') sb_fail(429, 'Terlalu banyak pendaftaran dari perangkat ini. Coba lagi nanti.');
    sb_log_in($res['id'], $res['sv'] ?? 0);
    sb_json(['ok' => true, 'created' => $created, 'user' => sb_user_view($res)]);
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
                // akun yang dibuat lewat Google belum punya kata sandi, jadi tidak ada kata sandi lama yang perlu diperiksa
                if (empty($u['nopw']) && !password_verify($oldPw, $u['pass'])) return 'badpw';
                $u['pass'] = $newHash; unset($u['nopw']);
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
