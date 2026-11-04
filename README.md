# Senja Pastry

Website pemesanan pastry: pelanggan memilih pastry, memilih ambil di toko atau diantar,
lalu pesanan dikirim ke WhatsApp toko. Satu file `index.html`, tanpa build dan tanpa dependensi.

## Menjalankan

Buka `index.html` di browser, atau jalankan server lokal:

```bash
python3 -m http.server 8000
```

Lalu buka http://localhost:8000.

## Mengubah isi

Semua data ada di bagian `EDIT BAGIAN INI` pada tag `<script>` di `index.html`:

- `CONFIG`: nama toko, nomor WhatsApp (format `62…`), alamat, jam buka, hari tutup, ongkir per area, minimal pesanan antar, jam ambil/antar, dan teks banner.
- `ITEMS`: daftar produk (`name`, `price`, `tag`, `soldOut`, `img`).

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

Foto produk paling cocok berbentuk tegak (sekitar 600 × 1000 px). Foto yang lebar akan terpotong di kiri dan kanan.
Usahakan tiap file di bawah 300 KB. Untuk nama file lain, ubah `img` di `ITEMS` pada `index.html`.

## Cara kerja pesanan

Tombol "Siapkan pesanan" membuat teks pesanan dan tautan `https://wa.me/<nomor>?text=…`.
Pelanggan membuka WhatsApp dan mengirim pesan itu. Tidak ada server atau database,
dan pesanan baru sah setelah toko membalas dan mengonfirmasi.
