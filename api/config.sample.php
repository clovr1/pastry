<?php
// Salin file ini menjadi config.php, atau jalankan: php tools/set-owner-password.php
// config.php sengaja tidak masuk GitHub karena berisi kata sandi owner (dalam bentuk hash).
return [
    // Hash kata sandi owner. Buat dengan: php -r "echo password_hash('KATA_SANDI_KAMU', PASSWORD_DEFAULT);"
    'owner_password_hash' => '',

    // Nama file penyimpanan pesanan di folder storage (satu file JSON, tanpa database). Folder storage tidak boleh bisa dibuka dari browser.
    // set-owner-password.php mengisinya dengan nama acak supaya tidak bisa ditebak.
    'data_file' => 'store.json',

    // Zona waktu toko, dipakai untuk menolak tanggal yang sudah lewat dan menghitung "hari ini".
    'timezone' => 'Asia/Jakarta',

    // Batas pesanan per perangkat: maksimal 8 pesanan dalam 10 menit.
    'order_limit_max' => 8,
    'order_limit_window' => 600,
];
