# Sweet Bite

Website pemesanan pastry. Pembeli memilih pastry, memilih ambil di tempat atau delivery, lalu mengirim pesanan.
Pesanan masuk ke **halaman owner** yang dilindungi kata sandi. Pembeli bisa memantau statusnya di halaman pesanan.

Dibuat dengan HTML, CSS, JavaScript, dan **PHP biasa**. Tidak butuh MySQL atau ekstensi PHP tambahan: pesanan disimpan di satu file JSON.

## Struktur

```
index.html       Home (banner dan slider pastry)
masuk.html       Masuk dan daftar akun pembeli
akun.html        Akun pembeli: riwayat pesanan dan data diri
products.html    Semua produk, filter kategori
product.html     Detail satu produk (product.html?id=cr1)
keranjang.html   Halaman keranjang: ubah jumlah, hapus barang, lanjut ke detail pesanan
checkout.html    Detail pesanan: data diri, ambil di tempat atau delivery, pembayaran
pesanan.html     Status pesanan untuk pembeli (pesanan.html?id=...)
owner/           Halaman owner: pesanan masuk, ubah status, tandai lunas
api/             Backend PHP (menu, buat pesanan, status, owner)
data/menu.json   Data toko dan menu: yang paling sering kamu ubah
storage/         Data pesanan dan salinan cadangannya (dibuat otomatis, tidak masuk GitHub)
tools/           Alat bantu terminal (membuat kata sandi owner)
css/, js/        Tampilan dan logika
images/          Foto banner dan produk
```

## Menjalankan

Situs ini butuh PHP versi 7.3 atau lebih baru (tanpa ekstensi tambahan). Jalankan lewat **Laragon**, bukan Live Server atau klik dua kali file HTML.

1. Taruh folder proyek di `C:\laragon\www`, lalu klik **Start All** di Laragon.
2. Buka `http://localhost/nama-folder/`.
3. Buat kata sandi owner. Buka **Terminal** di Laragon, masuk ke folder proyek, lalu jalankan:

```bash
php tools/set-owner-password.php
```

4. Halaman owner ada di `http://localhost/nama-folder/owner/`.

Tanpa Laragon, bisa juga: `php -S localhost:8000` di folder proyek, lalu buka http://localhost:8000.

## Cara kerja pesanan

1. Pembeli mengisi **Detail pesanan** dan menekan **Kirim pesanan**. Server memeriksa ulang semuanya (produk, stok, harga, hari tutup, jam, minimal antar) dan menghitung harga sendiri dari `data/menu.json`, jadi harga dari browser tidak dipercaya.
2. Pesanan disimpan di file `storage/store-….json` dan pembeli diarahkan ke `pesanan.html?id=…`. Tautan itu berisi kode acak yang hanya diketahui pemesannya. Halaman itu menampilkan status dan petunjuk pembayaran, dan diperbarui otomatis tiap 20 detik.
3. Di halaman owner, pesanan baru muncul otomatis (diperiksa tiap 15 detik). Owner bisa mengonfirmasi, menandai disiapkan, siap, selesai, menandai lunas, atau membatalkan.

Status pesanan: **Baru → Dikonfirmasi → Disiapkan → Siap (diambil/diantar) → Selesai**, atau **Dibatalkan**.

## Mengubah isi

Semua data toko dan menu ada di `data/menu.json`:

- `config`: nama toko, alamat, kontak, jam buka, hari tutup, ongkir per area (`zones`), minimal pesanan antar, jam ambil/antar (`slots`), banner, metode pembayaran (`payments`), dan `paymentInfo`.
- `paymentInfo`: nomor rekening dan gambar QRIS. **Hanya dikirim ke pembeli setelah pesanan dibuat**, tidak ikut dimuat di semua halaman. Isi awalnya contoh, ganti dengan data aslimu.
- `items`: daftar produk (`id`, `cat`, `name`, `desc`, `price`, `tag`, `soldOut`, `allergens`, `img`). Tandai `"soldOut": true` untuk produk yang habis.
- `cats`: kategori untuk filter di halaman Product.
- `allergens` per produk dan `allergyNote` tampil di dropdown **Peringatan alergi**. Isi awalnya hanya contoh, **periksa dan sesuaikan dengan resep aslimu** sebelum toko dibuka.
- `id` produk dipakai di alamat halaman detail dan di pesanan, jadi jangan diubah setelah toko berjalan.

Menu atas ada di fungsi `mountShell()` pada `js/app.js`. Menu itu bersembunyi saat halaman digulir ke bawah dan muncul lagi begitu digulir ke atas (`initHeaderHide()`). Di halaman Detail pesanan, menu diganti header sederhana dengan tombol **Kembali ke keranjang** yang menuju `keranjang.html`. Login pembeli belum ada, hanya menampilkan pemberitahuan.

## Foto

Taruh file foto di folder `images/` dengan nama persis seperti di tabel, format `.jpg`.
Foto yang belum ada otomatis diganti tempat foto, jadi kamu bisa menambah satu per satu.

| File | Dipakai untuk |
|---|---|
| `images/banner.jpg` | Banner layar penuh di beranda. Pakai foto lanskap minimal 1920 × 1080 px; judul ada di bagian atas, jadi taruh kue/produk di tengah-bawah foto |
| `images/butter-croissant.jpg` | Butter Croissant |
| `images/pain-au-chocolat.jpg` | Pain au Chocolat |
| `images/almond-croissant.jpg` | Almond Croissant |
| `images/cinnamon-roll.jpg` | Cinnamon Roll |
| `images/kouign-amann.jpg` | Kouign-Amann |
| `images/pain-aux-raisins.jpg` | Pain aux Raisins |
| `images/lemon-tart.jpg` | Lemon Tart |
| `images/pistachio-eclair.jpg` | Pistachio Éclair |
| `images/berry-mousse-cake.jpg` | Berry Mousse Cake (potong) |
| `images/cookie-box.jpg` | Cookie Box isi 6 |
| `images/nastar-toples.jpg` | Nastar Toples |
| `images/basque-cheesecake-15cm.jpg` | Basque Cheesecake 15 cm |
| `images/lemon-tart-18cm.jpg` | Lemon Tart 18 cm |
| `images/chocolate-eclair.jpg` | Chocolate Éclair |
| `images/raspberry-tart.jpg` | Raspberry Tart |
| `images/palmier.jpg` | Palmier |

Jumlah produk sebaiknya kelipatan 4 supaya setiap geseran di desktop menampilkan 4 produk penuh.
Foto produk paling cocok berbentuk tegak (sekitar 600 × 1000 px). Foto yang lebar akan terpotong di kiri dan kanan.
Usahakan tiap file di bawah 300 KB. Untuk nama file lain, ubah `img` pada produknya di `data/menu.json`.

## Huruf

- **Judul dan nama produk:** Fraunces (lebar dan hangat). **Teks biasa:** Hanken Grotesk. **Nama toko:** kata pertama ("Sweet") memakai Petit Formal Script (tulisan tegak bersambung), sisanya ("BITE") huruf besar renggang Fraunces. Pemisahnya otomatis dari `shop` di `data/menu.json`.
- Semuanya dimuat dari Google Fonts lewat tautan di bagian `<head>` tiap halaman.
- Judul banner di beranda (`config.banner` di `data/menu.json`): `title` ditulis dengan huruf biasa dan `accent` dengan tulisan sambung. Teks banner berwarna putih dengan bayangan gelap tipis supaya terbaca di atas foto. Kosongkan `accent` kalau tidak mau.
- Tombol **Pesan sekarang** di banner berupa kaca gelap transparan dengan garis putih, dan berubah merah saat disorot. Gayanya ada di `.bn-cta .btn` pada `css/style.css`.
- Untuk mengganti gaya nama toko, ubah `--font-brand` di bagian atas `css/style.css`, lalu ganti `Petit+Formal+Script` di tautan Google Fonts pada semua file `.html` (di `owner/index.html` juga). Contoh pengganti yang cocok: Sacramento, Rouge Script, Allison.

## Mode terang dan gelap

Tombol bulan/matahari di menu atas mengganti mode. Kalau pembeli belum memilih, situs mengikuti
pengaturan perangkatnya. Pilihan disimpan di browser (kunci `sweetbite-theme`) dan berlaku di semua halaman.
Warna kedua mode ada di bagian atas `css/style.css`.

## Pemecahan masalah

Kalau halaman owner atau checkout menampilkan pesan galat, buka
`http://localhost/nama-folder/api/diagnose.php`. Halaman itu menampilkan PHP mana yang dipakai web server,
apakah fitur yang dibutuhkan ada, apakah folder `storage` bisa ditulis, dan apakah kata sandi owner sudah dibuat.
Ia hanya menjawab dari komputer yang sama. **Hapus file `api/diagnose.php` sebelum situs dipasang di internet.**

## Setelah mengubah file

Tautan CSS dan JavaScript di semua halaman membawa nomor versi (`?v=...`) supaya browser tidak memakai file lama.
Setelah mengedit `css/` atau `js/`, jalankan ini lalu muat ulang halaman:

```bash
php tools/bump-version.php
```

## Keamanan dan perawatan

- **Kata sandi owner** disimpan sebagai hash di `api/config.php` (tidak masuk GitHub). Setelah 6 kali salah, login dikunci 10 menit.
- **Data pesanan** ada di `storage/store-….json` (nama acak, dibuat oleh `php tools/set-owner-password.php`). Folder `storage/` dan `data/` dilindungi `.htaccess` (Apache, termasuk Laragon). Kalau memakai Nginx, tolak akses langsung ke dua folder itu di pengaturan server.
- **Cadangan:** setiap hari PHP otomatis menyalin data ke `storage/backup-TANGGAL.json` dan menyimpannya 14 hari. Tetap salin file `store-….json` ke tempat lain secara berkala, karena itu seluruh riwayat pesananmu. Kalau file data rusak, ganti dengan salinan backup terbaru.
- **Skala:** penyimpanan satu file ini cukup untuk toko kecil (ribuan pesanan). Kalau pesananmu jauh lebih banyak, saatnya pindah ke database sungguhan.
- Pesanan dibatasi 8 per perangkat dalam 10 menit untuk mengurangi pesanan palsu.
- Kalau situs dipasang di internet, **wajib pakai HTTPS** supaya kata sandi dan data pemesan tidak terkirim terbuka.
- Halaman owner memakai `noindex`, tapi alamatnya tetap sebaiknya tidak dibagikan.

## Akun pembeli

- Pembeli bisa **daftar** (nama, email, nomor HP, kata sandi minimal 8 karakter) dan **masuk** lewat menu **Login** di `masuk.html`. Setelah masuk, menu berubah jadi **Akun** (`akun.html`) yang berisi riwayat pesanan, ubah data diri, ganti kata sandi, dan keluar.
- Akun itu **tidak wajib**: pembeli tanpa akun tetap bisa memesan. Kalau sudah masuk, nama dan nomor HP di halaman detail pesanan terisi otomatis dan pesanan tersimpan di akunnya.
- Data akun disimpan di file yang sama dengan pesanan (`storage/store-*.json`). Kata sandi disimpan sebagai hash (tidak bisa dibaca balik). Login dibatasi 8 percobaan per 10 menit per perangkat.
- Belum ada fitur "lupa kata sandi" lewat email. Kalau pembeli lupa, ganti dari terminal: `php tools/reset-user-password.php email@pembeli.com`.
- Sesi login tersimpan di `storage/sessions/` (ikut terlindungi oleh `storage/.htaccess`).
