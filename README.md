# Senja Pastry

Website pemesanan pastry: pelanggan memilih pastry, memilih ambil di toko atau diantar,
lalu pesanan dikirim ke WhatsApp toko. Situs statis (HTML, CSS, JavaScript), tanpa build dan tanpa dependensi.

## Struktur

```
index.html      Halaman Home (banner dan slider pastry)
products.html   Halaman Product (semua produk, filter kategori)
product.html    Halaman detail satu produk, dibuka dari kartu produk (product.html?id=cr1)
css/style.css   Tampilan untuk semua halaman
js/data.js      Data toko dan menu: yang paling sering kamu ubah
js/app.js       Logika bersama (menu atas, keranjang, form pesanan)
images/         Foto banner dan produk
```

Menu atas, keranjang, dan form pesanan dibuat oleh `js/app.js`, jadi cukup diubah di satu tempat.
Pembeli menambah pesanan dari halaman detail produk, bukan dari kartu. Isi keranjang disimpan di browser dan ikut berpindah antar halaman.

## Menjalankan

Buka lewat server lokal supaya keranjang terbawa antar halaman di semua browser.
Dengan Laragon, taruh folder ini di `C:\laragon\www` lalu buka `http://localhost/nama-folder/`.
Atau, kalau Python terpasang:

```bash
python3 -m http.server 8000
```

Lalu buka http://localhost:8000.

## Mengubah isi

Semua data ada di `js/data.js`:

- `CONFIG`: nama toko, nomor WhatsApp (format `62…`), alamat, jam buka, hari tutup, ongkir per area, minimal pesanan antar, jam ambil/antar, dan teks banner.
- `ITEMS`: daftar produk (`name`, `desc`, `price`, `tag`, `soldOut`, `allergens`, `img`, `cat`). Deskripsi tampil di halaman Product dan halaman detail, tidak di slider.
- `allergens` per produk dan `CONFIG.allergyNote` tampil di dropdown **Peringatan alergi** pada halaman detail. Isi awalnya hanya contoh, **periksa dan sesuaikan dengan resep aslimu** sebelum toko dibuka.
- Dropdown **Delivery**, **Pick up**, dan **Jam buka toko** dibuat otomatis dari `CONFIG` (alamat, jam, hari tutup, area dan ongkir, minimal pesanan, jam antar/ambil).
- `id` produk dipakai di alamat halaman detail, jadi jangan diubah-ubah setelah dibagikan.
- `CATS`: kategori untuk filter di halaman Product. Alamat langsung ke satu kategori, misalnya `products.html#tart`.

Menu atas (Home, Product, Login) ada di fungsi `mountShell()` pada `js/app.js`.
Login belum berfungsi dan hanya menampilkan pemberitahuan, karena butuh server dan database.

## Foto

Taruh file foto di folder `images/` dengan nama persis seperti di tabel, format `.jpg`.
Foto yang belum ada otomatis diganti tempat foto, jadi kamu bisa menambah satu per satu.

| File | Dipakai untuk |
|---|---|
| `images/banner.jpg` | Banner di atas (sekitar 1600 × 820 px, bagian atas agak kosong untuk judul) |
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
Usahakan tiap file di bawah 300 KB. Untuk nama file lain, ubah `img` di `ITEMS` pada `js/data.js`.

## Cara kerja pesanan

Tombol "Siapkan pesanan" membuat teks pesanan dan tautan `https://wa.me/<nomor>?text=…`.
Pelanggan membuka WhatsApp dan mengirim pesan itu. Tidak ada server atau database,
dan pesanan baru sah setelah toko membalas dan mengonfirmasi.
