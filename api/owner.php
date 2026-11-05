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

if ($action === 'proof') {
    sb_require_owner();
    $f = $_GET['file'] ?? '';
    if (!is_string($f) || !preg_match('/^pf-[a-f0-9]{12}\.(jpg|png|webp)$/', $f) || !is_file(SB_ROOT . '/storage/proofs/' . $f)) sb_fail(404, 'Bukti tidak ditemukan.');
    $mime = ['jpg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'][pathinfo($f, PATHINFO_EXTENSION)];
    header('Content-Type: ' . $mime);
    header('Cache-Control: private, max-age=3600');
    header('X-Content-Type-Options: nosniff');
    readfile(SB_ROOT . '/storage/proofs/' . $f);
    exit;
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
            if ($newStatus !== null && $newStatus !== $o['status']) {
                // pesanan dibatalkan: stok produk dikembalikan; dibuka lagi: stok dikurangi lagi
                $cancel = $newStatus === 'dibatalkan';
                if ($cancel || $o['status'] === 'dibatalkan') {
                    foreach ($o['items'] as $li) {
                        if (!isset($d['stock'][$li['id']])) continue;
                        $d['stock'][$li['id']] = max(0, (int)$d['stock'][$li['id']] + ($cancel ? 1 : -1) * (int)$li['qty']);
                    }
                }
            }
            // bayar tunai: pesanan yang diselesaikan otomatis dianggap lunas (kecuali owner mengatur sendiri)
            if ($newStatus === 'selesai' && $o['payment'] === 'tunai' && !$hasPaid) $o['paid'] = 1;
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

/* ---------- Kelola toko: produk, stok, kategori, pengaturan ---------- */

function sb_catalog_view() {
    $m = sb_menu(true);
    $c = $m['config'];
    $home = [];
    foreach ($c['home'] ?? [] as $sec) $home[] = ['id' => $sec['id'], 'title' => $sec['title'], 'items' => $sec['items'] ?? []];
    return [
        'items' => $m['items'],
        'cats' => $m['cats'],
        'home' => $home,
        'featured' => $c['featured'] ?? [],
        'collections' => $c['collections'] ?? [],
        'settings' => [
            'acceptOrders' => !empty($c['acceptOrders']), 'closedNote' => $c['closedNote'] ?? '',
            'shop' => $c['shop'], 'address' => $c['address'], 'contact' => $c['contact'],
            'social' => $c['social'] ?? ['instagram' => '', 'tiktok' => '', 'facebook' => ''],
            'quote' => $c['quote'] ?? ['text' => '', 'author' => '', 'role' => ''],
            'open' => (int)$c['open'], 'close' => (int)$c['close'], 'closedDays' => array_values($c['closedDays']),
            'minDelivery' => (int)$c['minDelivery'], 'zones' => $c['zones'],
            'transfer' => $c['paymentInfo']['transfer'] ?? ['bank' => '', 'number' => '', 'holder' => ''],
            'qris' => (string)($c['paymentInfo']['qris']['image'] ?? ''),
        ],
    ];
}

function sb_int($v, $min, $max, $msg) {
    if (is_string($v) && trim($v) !== '') $v = str_replace(['.', ','], '', $v);
    if (!is_numeric($v) || (int)$v != $v || (int)$v < $min || (int)$v > $max) sb_fail(422, $msg);
    return (int)$v;
}

function sb_remove_upload($path) {
    // hanya foto yang diunggah lewat dashboard (images/u-*) yang boleh dihapus otomatis
    if (is_string($path) && preg_match('#^images/u-[a-f0-9]{12}\.(jpg|png|webp)$#', $path)) @unlink(SB_ROOT . '/' . $path);
}

if ($action === 'catalog') {
    sb_require_owner();
    sb_json(sb_catalog_view());
}

if ($action === 'upload') {
    sb_require_post();
    sb_require_owner();
    $f = $_FILES['photo'] ?? null;
    if (!$f || !is_uploaded_file($f['tmp_name'] ?? '')) sb_fail(422, 'Pilih file foto dulu.');
    if (($f['error'] ?? 0) !== UPLOAD_ERR_OK) sb_fail(422, 'Foto gagal diunggah (kode ' . (int)$f['error'] . '). Coba file yang lebih kecil.');
    if ($f['size'] > 8 * 1024 * 1024) sb_fail(422, 'Foto terlalu besar. Maksimal 8 MB.');
    $info = @getimagesize($f['tmp_name']);
    $types = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'];
    if (!$info || !isset($types[$info[2]])) sb_fail(422, 'Format foto harus JPG, PNG, atau WebP.');
    $dir = SB_ROOT . '/images';
    if (!is_dir($dir) || !is_writable($dir)) sb_fail(500, 'Folder images tidak bisa ditulis oleh PHP. Beri izin tulis ke folder itu.');
    $name = 'u-' . bin2hex(random_bytes(6)) . '.' . $types[$info[2]];
    if (!@move_uploaded_file($f['tmp_name'], $dir . '/' . $name)) sb_fail(500, 'Foto belum tersimpan di folder images.');
    sb_json(['path' => 'images/' . $name]);
}

if ($action === 'item_save') {
    sb_require_post();
    sb_require_owner();
    $in = sb_body();
    $id = is_string($in['id'] ?? null) ? $in['id'] : '';
    $old = null;
    $m0 = sb_menu(true);
    foreach ($m0['items'] as $x) { if ($x['id'] === $id) $old = $x; }
    if ($id !== '' && !$old) sb_fail(404, 'Produk tidak ditemukan.');

    $name = sb_text($in['name'] ?? '', 80);
    if (sb_len($name) < 2) sb_fail(422, 'Isi nama produk.');
    $cat = is_string($in['cat'] ?? null) ? $in['cat'] : '';
    $catOk = false;
    foreach ($m0['cats'] as $c) { if ($c['id'] === $cat) $catOk = true; }
    if (!$catOk) sb_fail(422, 'Pilih kategori.');
    $price = sb_int($in['price'] ?? '', 0, 100000000, 'Harga harus berupa angka (rupiah).');
    $desc = sb_text($in['desc'] ?? '', 300, true);
    $tag = sb_text($in['tag'] ?? '', 30);
    $allergens = [];
    foreach (is_array($in['allergens'] ?? null) ? $in['allergens'] : [] as $a) { $a = sb_text($a, 30); if ($a !== '' && !in_array($a, $allergens, true) && count($allergens) < 10) $allergens[] = $a; }
    $includes = [];
    foreach (is_array($in['includes'] ?? null) ? $in['includes'] : [] as $a) { $a = sb_text($a, 80); if ($a !== '' && count($includes) < 12) $includes[] = $a; }
    $img = is_string($in['img'] ?? null) ? $in['img'] : '';
    if ($img !== '' && !preg_match('#^images/[A-Za-z0-9._-]+$#', $img)) sb_fail(422, 'Alamat foto tidak valid.');
    $soldOut = !empty($in['soldOut']);
    $stock = null;
    if (array_key_exists('stock', $in) && $in['stock'] !== null && $in['stock'] !== '') $stock = sb_int($in['stock'], 0, 99999, 'Stok harus berupa angka bulat, atau kosongkan kalau tidak dibatasi.');
    $homeIds = is_array($in['home'] ?? null) ? array_map('strval', $in['home']) : [];
    $feat = is_array($in['feature'] ?? null) ? $in['feature'] : null;   // sorotan launching di beranda
    $featOn = $feat && !empty($feat['on']);
    $featRow = $featOn ? ['layout' => in_array($feat['layout'] ?? '', ['auto', 'kiri', 'kanan', 'penuh', 'tengah'], true) ? $feat['layout'] : 'auto', 'cta' => sb_text($feat['cta'] ?? '', 24), 'label' => sb_text($feat['label'] ?? '', 30), 'headline' => sb_text($feat['headline'] ?? '', 60), 'text' => sb_text($feat['text'] ?? '', 200, true)] : null;

    $saved = sb_menu_update(function (&$m) use (&$id, $old, $name, $cat, $price, $desc, $tag, $allergens, $includes, $img, $soldOut, $homeIds, $feat, $featRow) {
        if ($id === '') {
            $used = array_column($m['items'], 'id');
            do { $id = 'p' . substr(bin2hex(random_bytes(4)), 0, 6); } while (in_array($id, $used, true));
            $m['items'][] = ['id' => $id];
        }
        foreach ($m['items'] as &$it) {
            if ($it['id'] !== $id) continue;
            $it['cat'] = $cat; $it['name'] = $name; $it['desc'] = $desc; $it['price'] = $price;
            foreach (['tag' => $tag, 'img' => $img] as $k => $v) { if ($v === '') unset($it[$k]); else $it[$k] = $v; }
            $it['allergens'] = $allergens;
            if ($includes) $it['includes'] = $includes; else unset($it['includes']);
            if ($soldOut) $it['soldOut'] = true; else unset($it['soldOut']);
            // urutan kunci rapi: id dulu
            $it = ['id' => $it['id']] + $it;
        }
        unset($it);
        if (!isset($m['config']['home'])) $m['config']['home'] = [];
        foreach ($m['config']['home'] as &$sec) {
            $sec['items'] = array_values(array_diff($sec['items'] ?? [], [$id]));
            if (in_array($sec['id'], $homeIds, true)) $sec['items'][] = $id;
        }
        unset($sec);
        if ($feat !== null) {
            $list = isset($m['config']['featured']) && is_array($m['config']['featured']) ? $m['config']['featured'] : sb_auto_featured($m);
            $list = array_values(array_filter($list, function ($f) use ($id) { return $f['id'] !== $id; }));
            if ($featRow && count($list) < 4) $list[] = ['id' => $id] + $featRow;
            $m['config']['featured'] = $list;
        }
        return true;
    });
    // foto lama yang diganti tidak dipakai lagi
    if ($old && isset($old['img']) && $old['img'] !== $img) sb_remove_upload($old['img']);
    sb_store_update(function (&$d) use ($id, $stock) {
        if ($stock === null) unset($d['stock'][$id]); else $d['stock'][$id] = $stock;
    });
    $v = sb_catalog_view();
    $v['savedId'] = $id;
    sb_json($v);
}

if ($action === 'item_stock') {
    // ubah cepat dari daftar: stok dan/atau tanda habis
    sb_require_post();
    sb_require_owner();
    $in = sb_body();
    $id = is_string($in['id'] ?? null) ? $in['id'] : '';
    $found = false;
    foreach (sb_menu(true)['items'] as $x) { if ($x['id'] === $id) $found = true; }
    if (!$found) sb_fail(404, 'Produk tidak ditemukan.');
    if (array_key_exists('soldOut', $in)) {
        $so = !empty($in['soldOut']);
        sb_menu_update(function (&$m) use ($id, $so) {
            foreach ($m['items'] as &$it) { if ($it['id'] === $id) { if ($so) $it['soldOut'] = true; else unset($it['soldOut']); } }
            return true;
        });
    }
    if (array_key_exists('stock', $in)) {
        $stock = ($in['stock'] === null || $in['stock'] === '') ? null : sb_int($in['stock'], 0, 99999, 'Stok harus berupa angka bulat.');
        sb_store_update(function (&$d) use ($id, $stock) { if ($stock === null) unset($d['stock'][$id]); else $d['stock'][$id] = $stock; });
        // stok diisi lagi: tanda "habis" otomatis hilang
        if ($stock !== null && $stock > 0) {
            sb_menu_update(function (&$m) use ($id) { foreach ($m['items'] as &$it) { if ($it['id'] === $id) unset($it['soldOut']); } return true; });
        }
    }
    sb_json(sb_catalog_view());
}

if ($action === 'item_delete') {
    sb_require_post();
    sb_require_owner();
    $in = sb_body();
    $id = is_string($in['id'] ?? null) ? $in['id'] : '';
    $img = null;
    $res = sb_menu_update(function (&$m) use ($id, &$img) {
        $keep = [];
        foreach ($m['items'] as $it) { if ($it['id'] === $id) $img = $it['img'] ?? null; else $keep[] = $it; }
        if (count($keep) === count($m['items'])) return false;
        $m['items'] = $keep;
        if (!isset($m['config']['home'])) $m['config']['home'] = [];
        foreach ($m['config']['home'] as &$sec) $sec['items'] = array_values(array_diff($sec['items'] ?? [], [$id]));
        unset($sec);
        $list = isset($m['config']['featured']) && is_array($m['config']['featured']) ? $m['config']['featured'] : sb_auto_featured($m);
        $m['config']['featured'] = array_values(array_filter($list, function ($f) use ($id) { return $f['id'] !== $id; }));
        $cl = isset($m['config']['collections']) && is_array($m['config']['collections']) ? $m['config']['collections'] : sb_default_collections($m);
        foreach ($cl as $k => $c) $cl[$k]['items'] = array_values(array_diff($c['items'] ?? [], [$id]));
        $m['config']['collections'] = $cl;
        return true;
    });
    if ($res === false) sb_fail(404, 'Produk tidak ditemukan.');
    sb_remove_upload($img);
    sb_store_update(function (&$d) use ($id) { unset($d['stock'][$id]); });
    sb_json(sb_catalog_view());
}

if ($action === 'cat_save') {
    sb_require_post();
    sb_require_owner();
    $in = sb_body();
    $id = is_string($in['id'] ?? null) ? $in['id'] : '';
    $name = sb_text($in['name'] ?? '', 40);
    if (sb_len($name) < 2) sb_fail(422, 'Isi nama kategori.');
    $res = sb_menu_update(function (&$m) use ($id, $name) {
        if ($id === '') {
            $used = array_column($m['cats'], 'id');
            do { $nid = 'k' . substr(bin2hex(random_bytes(3)), 0, 5); } while (in_array($nid, $used, true));
            $m['cats'][] = ['id' => $nid, 'name' => $name];
            return true;
        }
        foreach ($m['cats'] as &$c) { if ($c['id'] === $id) { $c['name'] = $name; return true; } }
        return false;
    });
    if ($res === false) sb_fail(404, 'Kategori tidak ditemukan.');
    sb_json(sb_catalog_view());
}

if ($action === 'cat_delete') {
    sb_require_post();
    sb_require_owner();
    $in = sb_body();
    $id = is_string($in['id'] ?? null) ? $in['id'] : '';
    $res = sb_menu_update(function (&$m) use ($id) {
        foreach ($m['items'] as $it) { if ($it['cat'] === $id) return 'used'; }
        $keep = array_values(array_filter($m['cats'], function ($c) use ($id) { return $c['id'] !== $id; }));
        if (count($keep) === count($m['cats'])) return false;
        $m['cats'] = $keep;
        return true;
    });
    if ($res === 'used') sb_fail(409, 'Kategori ini masih dipakai produk. Pindahkan atau hapus produknya dulu.');
    if ($res === false) sb_fail(404, 'Kategori tidak ditemukan.');
    sb_json(sb_catalog_view());
}

if ($action === 'collection_save') {
    sb_require_post();
    sb_require_owner();
    $in = sb_body();
    $id = is_string($in['id'] ?? null) ? $in['id'] : '';
    $title = sb_text($in['title'] ?? '', 60);
    if (sb_len($title) < 2) sb_fail(422, 'Isi judul koleksi, mis. "Perfect for Christmas".');
    $label = sb_text($in['label'] ?? '', 30);
    $text = sb_text($in['text'] ?? '', 400, true);
    $reasons = [];
    foreach (is_array($in['reasons'] ?? null) ? $in['reasons'] : [] as $r) {
        if (!is_array($r)) continue;
        $t = sb_text($r['t'] ?? '', 50); $d = sb_text($r['d'] ?? '', 160);
        if ($t === '' && $d === '') continue;
        if (count($reasons) < 4) $reasons[] = ['t' => $t, 'd' => $d];
    }
    $img = is_string($in['img'] ?? null) ? $in['img'] : '';
    if ($img !== '' && !preg_match('#^images/[A-Za-z0-9._-]+$#', $img)) sb_fail(422, 'Alamat foto tidak valid.');
    $known = array_column(sb_menu(true)['items'], 'id');
    $items = [];
    foreach (is_array($in['items'] ?? null) ? $in['items'] : [] as $i) { if (is_string($i) && in_array($i, $known, true) && !in_array($i, $items, true)) $items[] = $i; }
    if (!$items) sb_fail(422, 'Pilih minimal satu produk untuk koleksi ini.');
    $notes = [];
    foreach (is_array($in['notes'] ?? null) ? $in['notes'] : [] as $nid => $nt) {
        if (!in_array((string)$nid, $items, true)) continue;
        $nt = sb_text(is_string($nt) ? $nt : '', 180);
        if ($nt !== '') $notes[(string)$nid] = $nt;
    }
    $cta = sb_text($in['cta'] ?? '', 24);
    $layout = in_array($in['layout'] ?? '', ['auto', 'kiri', 'kanan', 'penuh', 'tengah'], true) ? $in['layout'] : 'auto';
    $home = !empty($in['home']);
    $oldImg = null; $savedId = '';
    $res = sb_menu_update(function (&$m) use ($id, $title, $label, $text, $reasons, $img, $items, $notes, $cta, $layout, $home, &$oldImg, &$savedId) {
        $list = isset($m['config']['collections']) && is_array($m['config']['collections']) ? $m['config']['collections'] : sb_default_collections($m);
        $row = ['id' => $id, 'title' => $title, 'label' => $label, 'text' => $text, 'reasons' => $reasons, 'img' => $img, 'items' => $items, 'notes' => (object)$notes, 'cta' => $cta, 'home' => $home, 'layout' => $layout];
        $found = false;
        foreach ($list as $k => $c) {
            if ($id !== '' && $c['id'] === $id) { $oldImg = $c['img'] ?? null; $list[$k] = $row; $found = true; }
        }
        if ($id !== '' && !$found) return false;
        if ($id === '') {
            if (count($list) >= 12) return 'full';
            $ascii = function_exists('iconv') ? @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $title) : false;
            $slug = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($ascii ?: $title)), '-');
            if ($slug === '') $slug = 'koleksi';
            $slug = substr($slug, 0, 40); $used = array_column($list, 'id'); $base = $slug; $n = 2;
            while (in_array($slug, $used, true)) $slug = $base . '-' . $n++;
            $row['id'] = $slug; $list[] = $row;
        }
        $savedId = $row['id'];
        $m['config']['collections'] = array_values($list);
        return true;
    });
    if ($res === false) sb_fail(404, 'Koleksi tidak ditemukan.');
    if ($res === 'full') sb_fail(422, 'Maksimal 12 koleksi. Hapus yang tidak dipakai dulu.');
    if ($oldImg && $oldImg !== $img) sb_remove_upload($oldImg);
    $v = sb_catalog_view(); $v['savedId'] = $savedId;
    sb_json($v);
}

if ($action === 'collection_delete') {
    sb_require_post();
    sb_require_owner();
    $in = sb_body();
    $id = is_string($in['id'] ?? null) ? $in['id'] : '';
    $img = null;
    $res = sb_menu_update(function (&$m) use ($id, &$img) {
        $list = isset($m['config']['collections']) && is_array($m['config']['collections']) ? $m['config']['collections'] : sb_default_collections($m);
        $keep = [];
        foreach ($list as $c) { if ($c['id'] === $id) $img = $c['img'] ?? null; else $keep[] = $c; }
        if (count($keep) === count($list)) return false;
        $m['config']['collections'] = $keep;
        return true;
    });
    if ($res === false) sb_fail(404, 'Koleksi tidak ditemukan.');
    sb_remove_upload($img);
    sb_json(sb_catalog_view());
}

if ($action === 'settings_save') {
    sb_require_post();
    sb_require_owner();
    $in = sb_body();
    $set = [];   // perubahan yang sudah divalidasi
    if (array_key_exists('acceptOrders', $in)) $set['acceptOrders'] = !empty($in['acceptOrders']);
    if (array_key_exists('closedNote', $in)) $set['closedNote'] = sb_text($in['closedNote'], 200);
    if (array_key_exists('shop', $in)) { $v = sb_text($in['shop'], 40); if (sb_len($v) < 2) sb_fail(422, 'Isi nama toko.'); $set['shop'] = $v; }
    if (array_key_exists('address', $in)) { $v = sb_text($in['address'], 200); if ($v === '') sb_fail(422, 'Isi alamat toko.'); $set['address'] = $v; }
    if (array_key_exists('contact', $in)) $set['contact'] = sb_text($in['contact'], 40);
    if (array_key_exists('quote', $in) && is_array($in['quote'])) {
        $qt = sb_text($in['quote']['text'] ?? '', 260, true);
        $set['quote'] = $qt === '' ? ['text' => '', 'author' => '', 'role' => '', 'lang' => ''] : ['text' => $qt, 'author' => sb_text($in['quote']['author'] ?? '', 60), 'role' => sb_text($in['quote']['role'] ?? '', 80), 'lang' => preg_match('/^[a-z]{2,3}$/', (string)($in['quote']['lang'] ?? '')) ? $in['quote']['lang'] : ''];
    }
    if (array_key_exists('social', $in) && is_array($in['social'])) {
        // boleh diisi tautan lengkap (https://…) atau cukup nama akun (@namaakun)
        $bases = ['instagram' => 'https://instagram.com/', 'tiktok' => 'https://www.tiktok.com/@', 'facebook' => 'https://facebook.com/'];
        $soc = [];
        foreach ($bases as $k => $base) {
            $v = sb_text($in['social'][$k] ?? '', 150);
            if ($v === '') { $soc[$k] = ''; continue; }
            if (preg_match('#^https?://[^\s]+$#i', $v)) { $soc[$k] = $v; continue; }
            if (preg_match('/^@?([A-Za-z0-9._]{1,50})$/', $v, $mm)) { $soc[$k] = $base . $mm[1]; continue; }
            sb_fail(422, 'Isi ' . ucfirst($k) . ' dengan tautan lengkap (https://…) atau nama akun, mis. @sweetbite.');
        }
        $set['social'] = $soc;
    }
    if (array_key_exists('open', $in) || array_key_exists('close', $in)) {
        $o = sb_int($in['open'] ?? null, 0, 23, 'Jam buka tidak valid.');
        $c = sb_int($in['close'] ?? null, 1, 24, 'Jam tutup tidak valid.');
        if ($c <= $o) sb_fail(422, 'Jam tutup harus lebih akhir dari jam buka.');
        $set['open'] = $o; $set['close'] = $c;
    }
    if (array_key_exists('closedDays', $in)) {
        $days = [];
        foreach (is_array($in['closedDays']) ? $in['closedDays'] : [] as $d) { $d = (int)$d; if ($d >= 0 && $d <= 6 && !in_array($d, $days, true)) $days[] = $d; }
        sort($days);
        if (count($days) >= 7) sb_fail(422, 'Tidak bisa menutup semua hari. Pakai tombol Tutup di bagian atas kalau mau libur total.');
        $set['closedDays'] = $days;
    }
    if (array_key_exists('minDelivery', $in)) $set['minDelivery'] = sb_int($in['minDelivery'], 0, 10000000, 'Minimal pesanan antar harus berupa angka.');
    if (array_key_exists('zones', $in)) {
        $zones = []; $used = [];
        foreach (is_array($in['zones']) ? $in['zones'] : [] as $z) {
            if (!is_array($z)) continue;
            $label = sb_text($z['label'] ?? '', 60);
            if ($label === '') continue;
            $zid = is_string($z['id'] ?? null) && preg_match('/^[a-z0-9]{1,12}$/', $z['id']) && !in_array($z['id'], $used, true) ? $z['id'] : 'z' . substr(bin2hex(random_bytes(3)), 0, 5);
            $used[] = $zid;
            $zones[] = ['id' => $zid, 'label' => $label, 'fee' => sb_int($z['fee'] ?? 0, 0, 1000000, 'Ongkir harus berupa angka.')];
            if (count($zones) >= 10) break;
        }
        if (!$zones) sb_fail(422, 'Isi minimal satu area antar.');
        $set['zones'] = $zones;
    }
    if (array_key_exists('transfer', $in) && is_array($in['transfer'])) {
        $t = $in['transfer'];
        $set['transfer'] = ['bank' => sb_text($t['bank'] ?? '', 40), 'number' => sb_text($t['number'] ?? '', 40), 'holder' => sb_text($t['holder'] ?? '', 60)];
    }
    if (array_key_exists('qris', $in)) {
        $q = is_string($in['qris']) ? $in['qris'] : '';
        if ($q !== '' && !preg_match('#^images/[A-Za-z0-9._-]+$#', $q)) sb_fail(422, 'Alamat gambar QRIS tidak valid.');
        $set['qris'] = $q;
    }
    $oldQris = (string)(sb_menu(true)['config']['paymentInfo']['qris']['image'] ?? '');
    sb_menu_update(function (&$m) use ($set) {
        foreach ($set as $k => $v) {
            if ($k === 'transfer') $m['config']['paymentInfo']['transfer'] = $v;
            elseif ($k === 'qris') $m['config']['paymentInfo']['qris'] = ['image' => $v];
            else $m['config'][$k] = $v;
        }
        $fees = array_column($m['config']['zones'], 'fee');
        $m['config']['deliveryText'] = 'Ongkir mulai Rp ' . number_format($fees ? min($fees) : 0, 0, ',', '.') . '. Minimal pesanan Rp ' . number_format((int)$m['config']['minDelivery'], 0, ',', '.') . '.';
        return true;
    });
    if (isset($set['qris']) && $oldQris !== '' && $oldQris !== $set['qris']) sb_remove_upload($oldQris);
    sb_json(sb_catalog_view());
}

sb_fail(404, 'Tidak ditemukan.');
