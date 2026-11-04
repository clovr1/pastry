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
- `CONFIG.banner.img`: alamat foto banner (rasio sekitar 16:8).
- `ITEMS`: daftar produk (`name`, `price`, `tag`, `soldOut`) dan `img` untuk foto produk. Foto produk paling bagus dengan latar polos. Kosongkan `img` untuk menampilkan tempat foto.

Taruh foto di folder `images/` lalu isi `img` dengan `images/nama-file.jpg`.

## Cara kerja pesanan

Tombol "Siapkan pesanan" membuat teks pesanan dan tautan `https://wa.me/<nomor>?text=…`.
Pelanggan membuka WhatsApp dan mengirim pesan itu. Tidak ada server atau database,
dan pesanan baru sah setelah toko membalas dan mengonfirmasi.
