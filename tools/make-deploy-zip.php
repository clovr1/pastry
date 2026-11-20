<?php
// Membuat satu file zip siap unggah ke hosting. Jalankan di komputermu (bukan di server): php tools/make-deploy-zip.php
// Hasilnya: deploy/sweetbite-deploy.zip
// Yang ikut: seluruh situs, api/config.php (kata sandi owner, jalankan dulu tools/set-owner-password.php), foto di images/,
//            dan storage/menu-live.json kalau ada (menu yang sudah kamu ubah lewat dashboard).
// Yang TIDAK ikut: .git, pesanan/akun/sesi/bukti bayar di storage (itu data percobaan di komputermu), api/diagnose.php, folder tools, README.
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
if (!class_exists('ZipArchive')) { fwrite(STDERR, "Ekstensi zip PHP belum aktif. Di Laragon: Menu > PHP > Extensions > zip. Atau kompres folder secara manual dengan aturan di README.\n"); exit(1); }

$root = dirname(__DIR__);
if (!is_file($root . '/api/config.php')) { fwrite(STDERR, "api/config.php belum ada. Jalankan dulu: php tools/set-owner-password.php\n"); exit(1); }
$cfg = include $root . '/api/config.php';
if (!is_array($cfg) || empty($cfg['owner_password_hash'])) { fwrite(STDERR, "Kata sandi owner di api/config.php kosong. Jalankan: php tools/set-owner-password.php\n"); exit(1); }

$skipDirs = ['.git', 'deploy', 'tools', 'node_modules'];
$skipFiles = ['README.md', '.gitignore', '.gitattributes', 'api/diagnose.php'];
$keepInStorage = ['.htaccess', '.gitkeep', 'menu-live.json'];

@mkdir($root . '/deploy', 0775, true);
$out = $root . '/deploy/sweetbite-deploy.zip';
@unlink($out);
$zip = new ZipArchive();
if ($zip->open($out, ZipArchive::CREATE) !== true) { fwrite(STDERR, "Tidak bisa membuat $out\n"); exit(1); }

$n = 0; $skippedStore = 0;
$it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::SELF_FIRST);
foreach ($it as $f) {
    $rel = str_replace('\\', '/', substr($f->getPathname(), strlen($root) + 1));
    $top = explode('/', $rel)[0];
    if (in_array($top, $skipDirs, true) || in_array($rel, $skipFiles, true)) continue;
    if ($f->isDir()) { $zip->addEmptyDir($rel); continue; }
    if (strpos($rel, 'storage/') === 0 && !in_array(basename($rel), $keepInStorage, true)) { $skippedStore++; continue; }
    if (preg_match('/\.(tmp|log|bak)$/', $rel)) continue;
    $zip->addFile($f->getPathname(), $rel);
    $n++;
}
// folder storage harus ada walau kosong
foreach (['storage', 'storage/proofs', 'storage/sessions'] as $d) $zip->addEmptyDir($d);
$zip->close();

printf("Selesai: %d file, %.1f MB -> deploy/sweetbite-deploy.zip\n", $n, filesize($out) / 1048576);
echo "Data percobaan di storage yang sengaja tidak diikutkan: $skippedStore file.\n";
echo "PERHATIAN: zip ini berisi api/config.php (hash kata sandi owner). Jangan dibagikan ke orang lain.\n";
