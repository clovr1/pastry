# Sweet Bite

Website pemesanan pastry. Pembeli memilih pastry, memilih ambil di tempat atau delivery, lalu mengirim pesanan.
Pesanan masuk ke **halaman owner** yang dilindungi kata sandi. Pembeli bisa memantau statusnya di halaman pesanan.

Dibuat dengan HTML, CSS, JavaScript, dan **PHP biasa**. Tidak butuh MySQL atau ekstensi PHP tambahan: pesanan disimpan di satu file JSON.

## Struktur

```
index.html       Home (banner dan slider pastry)
masuk.html       Masuk dan daftar akun pembeli
akun.html        Akun pembeli: riwayat pesanan
profil.html      Data diri pembeli (lihat dan ubah, ganti kata sandi)
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

- Pembeli bisa **daftar** (nama, email, nomor HP, kata sandi minimal 8 karakter) dan **masuk** lewat menu **Login** di `masuk.html`. Setelah masuk, menu berubah jadi **Akun** (`akun.html`) yang berisi riwayat pesanan dan tombol **Data diri** (halaman `profil.html` untuk melihat dan mengubah nama, nomor HP, dan kata sandi) serta **Keluar**.
- Akun itu **tidak wajib**: pembeli tanpa akun tetap bisa memesan. Kalau sudah masuk, nama dan nomor HP di halaman detail pesanan terisi otomatis dan pesanan tersimpan di akunnya.
- Data akun disimpan di file yang sama dengan pesanan (`storage/store-*.json`). Kata sandi disimpan sebagai hash (tidak bisa dibaca balik). Login dibatasi 8 percobaan per 10 menit per perangkat.
- Belum ada fitur "lupa kata sandi" lewat email. Kalau pembeli lupa, ganti dari terminal: `php tools/reset-user-password.php email@pembeli.com`.
- Sesi login tersimpan di `storage/sessions/` (ikut terlindungi oleh `storage/.htaccess`).

## Bagian di beranda (favorit, paket, dll.)

Slider di beranda dibagi jadi beberapa bagian lewat `config.home` di `data/menu.json`. Tiap bagian punya `label` (teks kecil di atas judul), `title`, `items` (daftar id produk), dan `link` (opsional, tautan di kanan judul). Tambah, hapus, atau urutkan bagian sesuka hati.

**Paket / bundle** ditulis sebagai produk biasa di kategori `paket`: isi `price` dengan harga paket, `tag` dengan tulisan seperti "Hemat Rp 15.000", dan `includes` dengan daftar isinya (tampil sebagai "Isi paket" di halaman produk). Harga tetap dihitung server dari file ini, jadi aman.

## Dashboard owner: kelola produk, stok, dan toko

Buka `owner/` lalu masuk. Selain tab **Pesanan**, ada:

- **Bilah status di atas**: satu tombol **Buka / Tutup**. Saat Tutup, label di menu atas situs berubah jadi "Toko tutup", pembeli tetap bisa melihat menu tapi tidak bisa memesan (server juga menolak), dan di halaman keranjang serta detail pesanan muncul pemberitahuan beserta pesan dari kamu (isi di kolom yang muncul saat Tutup). Jam buka di Pengaturan hanya informasi untuk pembeli; yang menentukan buka atau tutup adalah tombol ini.
- **Produk & stok**: tambah, ubah, hapus produk, unggah foto langsung dari browser (JPG/PNG/WebP, maks. 8 MB), atur harga, label, alergen, isi paket, dan pilih produk tampil di bagian beranda mana. Kolom **Stok** di tiap baris bisa langsung diisi: kosong (∞) = tidak dibatasi; angka = berkurang otomatis tiap ada pesanan, jadi "Habis" saat 0, dan **dikembalikan kalau pesanan dibatalkan**. Pembeli melihat label "Sisa N" saat stok tinggal 5 atau kurang. Kategori juga bisa ditambah, diganti nama, dan dihapus di bagian bawah tab ini.
- **Pengaturan toko**: nama/alamat/kontak, jam dan hari buka, minimal pesanan antar dan area+ongkir, serta rekening transfer.

**Di mana datanya disimpan?** `data/menu.json` hanyalah data awal. Begitu owner mengubah sesuatu, menu yang berlaku pindah ke `storage/menu-live.json` (bukan bagian dari Git, jadi tidak bentrok saat `git pull`; salinan sebelumnya ada di `storage/menu-live.bak.json`). Stok disimpan di file pesanan. Kalau ingin mengulang dari data awal, hapus `storage/menu-live.json`. Foto yang diunggah masuk ke folder `images/` (nama `u-xxxx`), jadi folder itu harus bisa ditulis PHP; foto ini ikut tercatat di Git kalau kamu melakukan `git add`.

Pesanan **bayar tunai** otomatis ditandai lunas saat statusnya diubah ke Selesai (transfer dan QRIS tetap harus kamu tandai lunas sendiri setelah uangnya masuk).

## Footer

Footer di semua halaman pembeli (kecuali detail pesanan) dibuat otomatis dari data toko: nama, alamat, jam buka, dan media sosial. Jadi cukup ubah di dashboard owner (Pengaturan toko) atau `data/menu.json`. Kalimat pendek di bawah logo bisa diganti lewat `config.tagline` di `data/menu.json` (opsional). Gayanya ada di bagian `/* Footer */` pada `css/style.css`.

**Media sosial di footer**: isi Instagram, TikTok, dan Facebook di dashboard owner (Pengaturan toko, bagian Info toko). Boleh ditulis `@namaakun` atau tautan lengkap. Yang dikosongkan tidak ditampilkan. Ikon akun (orang) di menu atas membuka halaman masuk/daftar, dan berubah gelap saat pembeli sudah masuk.

## Animasi

Situs memakai animasi ringan tanpa library (CSS di bagian `/* Animasi */` pada `css/style.css`, JavaScript di `js/fx.js`):

- Ganti mode terang/gelap: lingkaran warna meluas dari tombol tema (browser yang belum mendukung memakai pudar warna halus).
- Banner: foto perlahan mengecil saat halaman dibuka, teks naik bertahap, lalu foto bergeser pelan (paralaks) dan teks memudar saat digulir.
- Garis merah tipis di paling atas layar menunjukkan seberapa jauh halaman sudah digulir.
- Kartu produk, judul, footer, riwayat pesanan, dan lainnya muncul bertahap saat digulir ke layar. Foto memudar masuk setelah selesai dimuat, dan membesar sedikit saat disorot.
- Tombol terangkat saat disorot dan menekan saat diklik, garis bawah menu menyapu saat disorot, angka keranjang membesar sebentar saat produk ditambah.
- Semua animasi mati otomatis kalau perangkat pembeli memakai pengaturan "kurangi gerakan".

Kalau ingin mematikan satu efek, hapus aturannya di bagian `/* Animasi */`; kalau ingin mematikan semuanya, hapus tag `js/fx.js` dari halaman dan bagian CSS itu.

## Alur pembayaran: bayar dulu, pesanan dibuat setelahnya

- **Transfer bank dan QRIS**: tombol di halaman detail pesanan bertuliskan **Lanjutkan pembayaran**. Pesanan belum dibuat; yang muncul jendela pembayaran berisi total, nomor rekening (atau gambar QRIS), dan kolom bukti pembayaran (opsional). Pesanan baru dibuat setelah pembeli menekan **Saya sudah bayar**. Server memeriksa ulang harga, stok, dan jadwal, jadi total di jendela itu pasti sama dengan total pesanan.
- **Bayar tunai**: tombolnya **Kirim pesanan** dan pesanan langsung dibuat (bayar saat terima). Pesanan tunai otomatis lunas saat statusnya Selesai.
- **Verifikasi**: situs ini tidak tersambung ke bank atau payment gateway, jadi pembayaran tidak bisa dicek otomatis. Pesanan dari transfer/QRIS masuk dengan tanda **Cek pembayaran** dan tombol **Pembayaran sesuai, tandai lunas**. Cek mutasi rekening atau QRIS-mu dulu (dan bukti yang diunggah pembeli kalau ada: tombol **Lihat bukti pembayaran**), baru tandai lunas. Pembeli melihat "Menunggu verifikasi" sampai kamu menandainya.
- **Menyiapkan QRIS**: di dashboard owner, tab **Pengaturan toko**, kartu **Pembayaran**, unggah gambar QRIS tokomu dan isi data rekening. Selama belum diisi, pembeli yang memilih metode itu mendapat pesan bahwa metodenya belum siap.
- Bukti pembayaran disimpan di `storage/proofs/` (tidak bisa dibuka lewat web, hanya lewat dashboard owner yang sudah login).
- Kalau suatu saat ingin pembayaran terverifikasi otomatis, situs ini bisa disambungkan ke payment gateway seperti Midtrans atau Xendit (butuh akun merchant).

## Pilihan tanggal, jam, dan area antar

Di halaman detail pesanan, tanggal memakai kalender buatan sendiri (hari libur toko, hari yang jamnya sudah lewat, dan tanggal lebih dari 60 hari ke depan otomatis tidak bisa dipilih), jam berupa tombol, dan area antar berupa kartu pilihan. Tampilannya mengikuti mode terang/gelap. Gayanya ada di bagian `/* Pemilih tanggal, jam, ... */` pada `css/style.css`.

## Rekomendasi "Kamu mungkin suka" di halaman produk

Urutannya dihitung dari kecocokan dengan produk yang sedang dibuka: satu kategori paling berpengaruh; paket dan isinya saling merekomendasikan (produk yang ada di dalam paket muncul di halaman paketnya, dan paket yang berisi produk itu muncul di halaman produknya, dibaca dari daftar "Isi paket"); label Terlaris/Baru dan harga yang mirip menambah nilai; produk yang habis dipindah ke belakang. Ditampilkan sebagai slider 8 produk (4 per halaman, bisa berputar) seperti di beranda. Logikanya ada di fungsi `relatedItems` pada `js/app.js`.
