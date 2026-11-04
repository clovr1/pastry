/* ====== EDIT BAGIAN INI: nama toko, kontak, jam, ongkir, banner, foto, dan menu ====== */
const CONFIG = {
  shop: 'Senja Pastry',
  whatsapp: '6281234567890',          // format 62…, tanpa + dan tanpa spasi
  address: 'Jl. Melati No. 12, Bandung',
  deliveryText: 'Ongkir mulai Rp 10.000. Minimal pesanan Rp 75.000.',
  banner: {
    img: 'images/banner.jpg',         // foto banner lebar, disarankan rasio 16:8 (contoh 1600×820)
    badge: 'Dipanggang hari ini',
    title: 'Pastry segar tiap pagi',
    cta: 'Pesan sekarang'
  },
  open: 7, close: 18,
  closedDays: [1],                    // 0=Minggu, 1=Senin, …
  minDelivery: 75000,
  zones: [
    { id: 'z1', label: 'Dekat (sampai 3 km)', fee: 10000 },
    { id: 'z2', label: 'Sedang (3–7 km)', fee: 20000 },
    { id: 'z3', label: 'Jauh (7–12 km)', fee: 30000 }
  ],
  slots: [
    { label: '08.00–10.00', start: 8 },
    { label: '10.00–12.00', start: 10 },
    { label: '13.00–15.00', start: 13 },
    { label: '15.00–17.00', start: 15 }
  ]
};
const CATS = [
  { id: 'croissant', name: 'Croissant & Roti' },
  { id: 'tart', name: 'Tart & Choux' },
  { id: 'kering', name: 'Kue Kering' },
  { id: 'utuh', name: 'Kue Utuh' }
];
// img: alamat foto produk. Taruh file di folder images/ dengan nama yang sama. Kalau file belum ada, tampil tempat foto.
const ITEMS = [
  { id: 'cr1', cat: 'croissant', name: 'Butter Croissant', desc: 'Berlapis, mentega Prancis, renyah di luar.', price: 28000, tag: 'Terlaris', img: 'images/butter-croissant.jpg' },
  { id: 'cr2', cat: 'croissant', name: 'Pain au Chocolat', desc: 'Dua batang dark chocolate di dalam lipatan croissant.', price: 32000, img: 'images/pain-au-chocolat.jpg' },
  { id: 'cr3', cat: 'croissant', name: 'Almond Croissant', desc: 'Isi krim almond, taburan almond panggang.', price: 35000, img: 'images/almond-croissant.jpg' },
  { id: 'cr4', cat: 'croissant', name: 'Cinnamon Roll', desc: 'Kayu manis, gula merah, glasir cream cheese.', price: 30000, soldOut: true, img: 'images/cinnamon-roll.jpg' },
  { id: 'cr5', cat: 'croissant', name: 'Kouign-Amann', desc: 'Karamel renyah di luar, lembut berlapis di dalam.', price: 34000, tag: 'Baru', img: 'images/kouign-amann.jpg' },
  { id: 'cr6', cat: 'croissant', name: 'Pain aux Raisins', desc: 'Gulungan krim custard dan kismis.', price: 31000, img: 'images/pain-aux-raisins.jpg' },
  { id: 'tt1', cat: 'tart', name: 'Lemon Tart', desc: 'Kulit tart rapuh, krim lemon yang asam segar.', price: 38000, img: 'images/lemon-tart.jpg' },
  { id: 'tt2', cat: 'tart', name: 'Pistachio Éclair', desc: 'Choux isi krim pistachio dengan glasir hijau.', price: 36000, img: 'images/pistachio-eclair.jpg' },
  { id: 'tt3', cat: 'tart', name: 'Berry Mousse Cake (potong)', desc: 'Sponge lembut, mousse vanila, selai berry.', price: 42000, img: 'images/berry-mousse-cake.jpg' },
  { id: 'kk1', cat: 'kering', name: 'Cookie Box isi 6', desc: 'Choco chip, oat raisin, dan brown butter.', price: 65000, img: 'images/cookie-box.jpg' },
  { id: 'kk2', cat: 'kering', name: 'Nastar Toples', desc: 'Selai nanas buatan sendiri, mentega Wisman.', price: 95000, tag: 'Pre-order H-2', img: 'images/nastar-toples.jpg' },
  { id: 'ku1', cat: 'utuh', name: 'Basque Cheesecake 15 cm', desc: 'Cukup untuk 6–8 potong.', price: 185000, tag: 'Pre-order H-2', img: 'images/basque-cheesecake-15cm.jpg' },
  { id: 'ku2', cat: 'utuh', name: 'Lemon Tart 18 cm', desc: 'Tart utuh untuk acara kecil.', price: 165000, tag: 'Pre-order H-1', img: 'images/lemon-tart-18cm.jpg' },
  { id: 'tt4', cat: 'tart', name: 'Chocolate Éclair', desc: 'Choux isi krim cokelat dengan glasir ganache.', price: 36000, img: 'images/chocolate-eclair.jpg' },
  { id: 'tt5', cat: 'tart', name: 'Raspberry Tart', desc: 'Krim vanila dan raspberry segar di atas kulit tart.', price: 42000, img: 'images/raspberry-tart.jpg' },
  { id: 'cr7', cat: 'croissant', name: 'Palmier', desc: 'Puff pastry karamel, tipis dan renyah.', price: 24000, img: 'images/palmier.jpg' }
];
/* ====== AKHIR BAGIAN EDIT ====== */
