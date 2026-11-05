/* Sweet Bite: logika bersama untuk semua halaman (keranjang, panel pesanan, menu atas). */
if (typeof CONFIG === 'undefined') {
  document.body.innerHTML = '<div style="max-width:560px;margin:15vh auto;padding:0 20px;font:16px/1.6 system-ui,sans-serif"><h1 style="font-weight:600">Situs belum bisa dimuat</h1><p>Data menu dibaca lewat PHP. Buka situs ini lewat Laragon (alamat <b>http://localhost/…</b>), bukan lewat Live Server atau klik dua kali file HTML.</p></div>';
  throw new Error('api/menu.php tidak berjalan');
}
const PAGE = document.body.dataset.page || 'home';

/* Nama toko: kata pertama bertulisan sambung, sisanya huruf besar renggang (mis. "Sweet" + "BITE"). */
function brandHtml(name) {
  const w = String(name).trim().split(/\s+/), first = w.shift();
  return '<i class="b0" aria-hidden="true"></i><span class="b1">' + esc(first) + '</span>' + (w.length ? '<span class="b2">' + esc(w.join(' ')) + '</span>' : '');
}

/* ---- Mode terang / gelap ---- */
const THEME_KEY = 'sweetbite-theme';
const ACCT_BTN_HTML = '<a class="acctbtn" id="loginLink" href="masuk.html" aria-label="Login" title="Login"' + (['masuk', 'akun', 'profil'].includes(document.body.dataset.page) ? ' aria-current="page"' : '') +
  '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg></a>';
const THEME_BTN_HTML = '<button class="themebtn" type="button" id="themeBtn"></button>';
const ICON_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
const ICON_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const systemDark = () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
const currentTheme = () => document.documentElement.getAttribute('data-theme') || (systemDark() ? 'dark' : 'light');
function paintThemeBtn() {
  const b = document.getElementById('themeBtn');
  if (!b) return;
  const dark = currentTheme() === 'dark';
  b.innerHTML = dark ? ICON_SUN : ICON_MOON;
  b.setAttribute('aria-label', dark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap');
  b.title = dark ? 'Mode terang' : 'Mode gelap';
}
function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  const apply = () => {
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    paintThemeBtn();
  };
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const btn = document.getElementById('themeBtn');
  if (btn) { btn.classList.remove('spin'); void btn.offsetWidth; btn.classList.add('spin'); }
  if (reduced) { apply(); return; }
  // peralihan melingkar yang meluas dari tombol tema (browser yang mendukung), kalau tidak: warna memudar halus
  if (document.startViewTransition && btn) {
    const r = btn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.documentElement.classList.add('vt-theme');
    const vt = document.startViewTransition(apply);
    vt.finished.finally(() => document.documentElement.classList.remove('vt-theme'));
    vt.ready.then(() => document.documentElement.animate(
      { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + radius + 'px at ' + x + 'px ' + y + 'px)'] },
      { duration: 650, easing: 'cubic-bezier(.4, 0, .2, 1)', pseudoElement: '::view-transition-new(root)' })).catch(() => {});
    return;
  }
  const root = document.documentElement;
  root.classList.add('theme-anim');
  apply();
  setTimeout(() => root.classList.remove('theme-anim'), 600);
}

/* Footer: dibuat dari data toko (nama, alamat, kontak, jam buka, cara bayar) di data/menu.json. */
const SOCIAL_ICONS = {
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none"/>',
  tiktok: '<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.3 2.6 2 4.1 4.5 4.3"/>',
  facebook: '<path d="M15 8h-2a1 1 0 0 0-1 1v3h3l-.5 3H12v6H9v-6H7v-3h2V9a4 4 0 0 1 4-4h2z"/>'
};
const SOCIAL_NAMES = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook' };
function socialHtml() {
  const soc = CONFIG.social || {};
  const links = Object.keys(SOCIAL_NAMES).filter(k => /^https?:\/\//.test(soc[k] || '')).map(k =>
    '<a class="foot-soc" href="' + esc(soc[k]) + '" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + SOCIAL_ICONS[k] + '</svg>' + SOCIAL_NAMES[k] + '</a>');
  return links.length ? links.join('') : '<p>Akun media sosial segera hadir.</p>';
}
function footerHtml() {
  return '<footer class="foot"><div class="foot-in">' +
    '<div class="foot-brand"><a class="brand" href="index.html">' + brandHtml(CONFIG.shop) + '</a>' +
      '<p>' + esc(CONFIG.tagline || 'Pastry dibuat dengan tangan dan dipanggang segar setiap pagi.') + '</p></div>' +
    '<nav class="foot-col" aria-label="Explore"><h2>Explore</h2><a href="index.html">Home</a><a href="products.html">Product</a>' + ((CONFIG.collections || []).length ? '<a href="koleksi.html">Collection</a>' : '') + '<a href="keranjang.html">Cart</a><a href="masuk.html">Account</a></nav>' +
    '<div class="foot-col"><h2>Visit us</h2><p>' + esc(CONFIG.address) + '</p>' +
      '<p>Jam buka ' + esc(hoursText()) + '</p></div>' +
    '<div class="foot-col"><h2>Follow us</h2>' + socialHtml() + '</div>' +
    '</div><div class="foot-bot"><span>© ' + new Date().getFullYear() + ' ' + esc(CONFIG.shop) + '. Semua hak dilindungi.</span>' +
      '<span>Kami mengolah gluten, susu, telur, kacang, dan kedelai di dapur yang sama.</span></div></footer>';
}

/* Owner menutup toko: pemberitahuan di halaman keranjang dan detail pesanan. */
function closedBarHtml() {
  // cukup di halaman keranjang dan detail pesanan, tempat pembeli akan mengirim pesanan; di halaman lain label di menu atas sudah cukup
  if (CONFIG.acceptOrders !== false || (PAGE !== 'cart' && PAGE !== 'checkout')) return '';
  return '<div class="closedbar" role="status"><b>Toko sedang tutup, belum menerima pesanan.</b>' + (CONFIG.closedNote ? ' <span>' + esc(CONFIG.closedNote) + '</span>' : '') + '</div>';
}

/* ---- Kerangka bersama: menu atas, tombol keranjang, panel pesanan ---- */
function mountShell() {
  if (PAGE === 'checkout') {
    // halaman detail pesanan: header sederhana; tombol kembali menuju halaman keranjang
    document.querySelector('.wrap').insertAdjacentHTML('afterbegin',
      '<header class="top top-min" id="top">' +
        '<a class="brand" href="index.html" id="shopName">' + brandHtml(CONFIG.shop) + '</a>' +
        '<div class="top-r">' + THEME_BTN_HTML +
        '<a class="backcart" href="keranjang.html" id="cartBtn" aria-label="Kembali ke keranjang, 0 item">' +
          '<span aria-hidden="true">←</span><span>Kembali ke keranjang</span><span class="cn" id="cartN" hidden>0</span></a></div>' +
      '</header><div class="notice" id="notice" role="status" hidden></div>');
    document.body.insertAdjacentHTML('beforeend', SHELL_PANEL);
    document.querySelector('.wrap').insertAdjacentHTML('afterbegin', closedBarHtml());
    return;
  }
  const cur = n => ((PAGE === n || (n === 'products' && PAGE === 'product')) ? ' aria-current="page"' : '');
  // menu atas ditaruh di luar .wrap supaya latarnya bisa selebar layar; ia bersembunyi saat digulir ke bawah (lihat initHeaderHide)
  document.body.insertAdjacentHTML('afterbegin',
    '<div class="topbar" id="topbar"><header class="top" id="top">' +
      '<a class="brand" href="index.html" id="shopName">' + brandHtml(CONFIG.shop) + '</a>' +
      '<nav class="nav" aria-label="Menu utama">' +
        '<a href="index.html"' + cur('home') + '>Home</a>' +
        '<a href="products.html"' + cur('products') + '>Product</a>' +
        ((CONFIG.collections || []).length ? '<a href="koleksi.html"' + cur('koleksi') + '>Collection</a>' : '') +
      '</nav>' +
      '<div class="top-r"><span class="status" id="status">Memuat…</span>' + THEME_BTN_HTML + ACCT_BTN_HTML +
        '<button class="cartbtn" type="button" id="cartBtn" aria-label="Shopping Cart, 0 item">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 7H6"/></svg>' +
          '<span class="cn" id="cartN" hidden>0</span></button></div>' +
    '</header></div>');
  document.getElementById('topbar').insertAdjacentHTML('beforeend', closedBarHtml());
  document.querySelector('.wrap').insertAdjacentHTML('afterbegin', '<div class="notice" id="notice" role="status" hidden></div>');
  document.body.insertAdjacentHTML('beforeend', SHELL_PANEL);
  document.body.classList.add('has-foot');
  document.body.insertAdjacentHTML('beforeend', footerHtml());
}

/* Menu atas: sembunyi saat digulir ke bawah, muncul lagi begitu digulir ke atas (tidak perlu sampai paling atas). */
function initHeaderHide() {
  const bar = document.getElementById('topbar');
  if (!bar) return;
  const root = document.documentElement;
  let barH = bar.offsetHeight;
  // --hdr-h (tinggi menu, dipakai banner) hanya diperbarui saat ukuran berubah; menulis variabel di <html> memaksa seluruh halaman dihitung ulang,
  // jadi saat menu muncul/hilang saat digulir yang diperbarui hanya elemen lengket yang memakainya (kolom ringkasan, info produk).
  const stickies = () => document.querySelectorAll('.pd-info, .kr-sum');
  const measure = () => { barH = bar.offsetHeight; root.style.setProperty('--hdr-h', barH + 'px'); apply(); };
  const apply = () => { const v = (bar.classList.contains('is-hidden') ? 0 : barH) + 'px'; stickies().forEach(el => el.style.setProperty('--hdr', v)); };
  const setOffset = apply;
  const setHidden = h => { if (bar.classList.contains('is-hidden') === h) return; bar.classList.toggle('is-hidden', h); apply(); };
  let lastY = window.scrollY, acc = 0;
  function onScroll() {
    const y = Math.max(0, window.scrollY), d = y - lastY;
    lastY = y;
    bar.classList.toggle('stuck', y > 4);
    if ((d > 0 && acc < 0) || (d < 0 && acc > 0)) acc = 0;   // arah berubah: mulai hitung dari awal
    acc += d;
    if (y <= 4) { setHidden(false); acc = 0; }
    else if (acc > 18) { setHidden(true); acc = 0; }
    else if (acc < -18) { setHidden(false); acc = 0; }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', measure);
  window.addEventListener('load', measure);
  bar.addEventListener('focusin', () => setHidden(false));   // pengguna keyboard tidak kehilangan menu
  measure(); onScroll();
  new MutationObserver(apply).observe(document.body, { childList: true });   // elemen lengket yang dibuat belakangan ikut mendapat nilainya
}
const SHELL_PANEL = `
<div class="scrim" id="scrim" hidden></div>
<aside class="drawer" id="drawer" role="dialog" aria-modal="true" aria-labelledby="cartTitle" inert>
  <div class="dhead">
    <h2 id="cartTitle">Shopping Cart</h2>
    <button class="x" type="button" id="closeCart" aria-label="Tutup">✕</button>
  </div>
  <div class="dbody" id="dbody">
    <div class="empty" id="emptyMsg">
      <span>Belum ada pesanan. Tambahkan pastry dari menu.</span>
      <a class="btn ghost" href="products.html" id="toMenu">Lihat produk</a>
    </div>
    <div class="nudge" id="nudge" hidden></div>
    <ul class="lines" id="lines"></ul>
  </div>
  <div class="dfoot" id="dfoot" hidden>
    <div class="sum" id="sum"></div>
    <div class="dbtns"><a class="btn ghost" href="keranjang.html" id="toCart">Keranjang</a><a class="btn" href="checkout.html" id="toForm">Lanjut ke detail pesanan</a></div>
  </div>
</aside>
`;

const rp = n => 'Rp ' + Math.round(n).toLocaleString('id-ID');
const $ = id => document.getElementById(id);
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const pad = n => String(n).padStart(2, '0');
const isoDate = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

mountShell();

const state = { cart: {}, filter: 'all' };
try { const s = JSON.parse(localStorage.getItem('sweetbite-cart') || '{}'); if (s && typeof s === 'object') state.cart = s; } catch (e) {}
const byId = id => ITEMS.find(i => i.id === id);
Object.keys(state.cart).forEach(id => { const it = byId(id); if (!it || it.soldOut || !(state.cart[id] > 0)) delete state.cart[id]; });
const save = () => { try { localStorage.setItem('sweetbite-cart', JSON.stringify(state.cart)); } catch (e) {} };

function photo(src, name, label) {
  const ph = '<div class="noimg"' + (src ? ' hidden' : '') + '><i>' + esc(name) + '</i><span>' + label + '</span></div>';
  return src ? '<img src="' + esc(src) + '" alt="' + esc(name) + '" loading="lazy" decoding="async" onerror="this.hidden=true;this.nextElementSibling.hidden=false">' + ph : ph;
}

/* ---- Info toko ---- */
function storeStatus() {
  // buka/tutup diatur owner lewat satu tombol di dashboard; jam buka hanya informasi
  const open = CONFIG.acceptOrders !== false;
  return { open, text: open ? 'Toko buka' : 'Toko tutup' };
}
function hoursText() {
  const closed = CONFIG.closedDays.map(d => DAYS[d]).join(', ');
  return pad(CONFIG.open) + '.00–' + pad(CONFIG.close) + '.00' + (closed ? ' · Tutup ' + closed : '');
}
function initInfo() {
  $('shopName').innerHTML = brandHtml(CONFIG.shop);
  if (PAGE !== 'product') document.title = (PAGE === 'products' ? 'Product · ' : PAGE === 'checkout' ? 'Detail pesanan · ' : '') + CONFIG.shop;
  if ($('bnImg')) {
    const b = CONFIG.banner;
    $('bnBadge').textContent = b.badge; $('bnBadge').hidden = !b.badge;
    $('bnTitle').innerHTML = esc(b.title) + (b.accent ? ' <span class="bn-script">' + esc(b.accent) + '</span>' : '');
    $('bnCta').textContent = b.cta;
    $('bnImg').innerHTML = photo(b.img, CONFIG.shop, 'Foto banner · rasio 16:8');
  }
  const s = storeStatus(), st = $('status');
  if (st) { st.textContent = s.text; st.classList.toggle('closed', !s.open); }
}

/* ---- Menu ---- */
// label di pojok foto: label buatan owner, atau "Sisa N" kalau stok tinggal sedikit
const tagOf = it => it.tag || (it.stock != null && it.stock > 0 && it.stock <= 5 ? 'Sisa ' + it.stock : '');
function itemHtml(it, withDesc) {
  return '<a class="item" href="product.html?id=' + encodeURIComponent(it.id) + '" data-item="' + it.id + '"><div class="ph">' + photo(it.img, it.name, 'Foto segera hadir') +
    (tagOf(it) ? '<span class="tag">' + esc(tagOf(it)) + '</span>' : '') +
    (it.soldOut ? '<div class="so">Habis hari ini</div>' : '') + '</div>' +
    '<span class="nm">' + esc(it.name) + '</span><span class="price">' + rp(it.price) + '</span>' +
    (withDesc ? '<p>' + esc(it.desc) + '</p>' : '') + '</a>';
}
/* Sorotan launching (bundle atau produk baru): gambar besar di satu sisi, teks dan tombol "Explore more" di sisi lain.
   Diatur owner di dashboard (config.featured). Posisi gambar bergantian kiri/kanan. */
const FEAT_AUTO = ['kiri', 'penuh', 'kanan', 'tengah'];   // urutan gaya kalau owner tidak memilih sendiri
const FEAT_LAYOUTS = ['kiri', 'kanan', 'penuh', 'tengah'];
function featBlock(o, i) {
  const lay = FEAT_LAYOUTS.includes(o.layout) ? o.layout : FEAT_AUTO[i % FEAT_AUTO.length];
  return '<section class="feat v-' + lay + '" aria-label="' + esc(o.headline) + '">' +
    '<a class="feat-img ph" href="' + o.href + '" aria-label="' + esc(o.headline) + '">' + photo(o.img, o.headline, 'Foto segera hadir') + (o.soldOut ? '<div class="so">Habis hari ini</div>' : '') + '</a>' +
    '<div class="feat-txt">' + (o.label ? '<span class="feat-label">' + esc(o.label) + '</span>' : '') +
      '<h2>' + esc(o.headline) + '</h2>' + (o.text ? '<p>' + esc(o.text) + '</p>' : '') + (o.extra || '') +
      '<a class="btn feat-cta" href="' + o.href + '">' + esc(o.cta || (o.kind === 'koleksi' ? 'Explore more' : 'Order now')) + '</a></div></section>';
}
/* Sorotan di beranda: koleksi/kampanye (mis. "Perfect for Christmas", dengan alasan-alasannya, menuju halaman koleksi)
   lalu produk launching (menuju halaman produknya). Keduanya diatur owner di dashboard. */
function featuredHtml() {
  const blocks = [];
  (CONFIG.collections || []).filter(c => c.home).forEach(c => {
    const why = (c.reasons || []).length ? '<ol class="feat-why">' + c.reasons.map(r => '<li><b>' + esc(r.t) + '</b>' + (r.d ? '<span>' + esc(r.d) + '</span>' : '') + '</li>').join('') + '</ol>' : '';
    blocks.push({ kind: 'koleksi', layout: c.layout, headline: c.title, label: c.label, text: c.text, extra: why, cta: c.cta, img: c.img || ((byId((c.items || [])[0]) || {}).img), href: 'koleksi.html?id=' + encodeURIComponent(c.id) });
  });
  (CONFIG.featured || []).forEach(f => {
    const it = byId(f.id);
    if (!it) return;
    // label produk (mis. "Hemat Rp 15.000") ikut tampil di samping harga, kecuali kalau sama dengan label sorotan (mis. "Baru" dan "Baru launching")
    const tg = (it.tag || '').trim().toLowerCase(), lb = (f.label || '').toLowerCase();
    const extra = tg && tg !== 'baru' && !lb.includes(tg) ? it.tag : '';
    blocks.push({ layout: f.layout, headline: f.headline || it.name, label: f.label, text: f.text || it.desc || '', cta: f.cta, img: it.img, soldOut: it.soldOut, href: 'product.html?id=' + encodeURIComponent(it.id),
      extra: '<div class="feat-price"><b>' + rp(it.price) + '</b>' + (extra ? '<span>' + esc(extra) + '</span>' : '') + '</div>' });
  });
  return blocks.map(featBlock).join('');
}

/* Halaman koleksi (koleksi.html?id=...): foto besar dengan judul, alasan-alasan, lalu produk yang cocok. */
/* Daftar semua koleksi (koleksi.html tanpa id), dibuka dari menu "Collection". */
function renderCollectionIndex() {
  const box = $('coll'), list = CONFIG.collections || [];
  document.title = 'Collection · ' + CONFIG.shop;
  box.innerHTML = '<section class="menuhead"><div><span class="label">Tema pilihan</span><h1>Collection</h1></div></section>' +
    (list.length ? '<div class="coll-cards">' + list.map(c => {
      const n = (c.items || []).map(byId).filter(Boolean), img = c.img || (n[0] && n[0].img);
      return '<a class="coll-card" href="koleksi.html?id=' + encodeURIComponent(c.id) + '"><div class="coll-card-img ph">' + photo(img, c.title, 'Foto segera hadir') + '</div>' +
        '<div class="coll-card-txt">' + (c.label ? '<span class="feat-label">' + esc(c.label) + '</span>' : '') + '<h2>' + esc(c.title) + '</h2>' + (c.text ? '<p>' + esc(c.text) + '</p>' : '') + '<span class="coll-card-n">' + n.length + ' produk →</span></div></a>';
    }).join('') + '</div>' : '<div class="empty"><span>Belum ada koleksi.</span><a class="btn" href="products.html">Lihat produk</a></div>');
}
function renderCollection() {
  const id = new URLSearchParams(location.search).get('id'), box = $('coll');
  if (!id) { renderCollectionIndex(); return; }
  const c = (CONFIG.collections || []).find(x => x.id === id);
  if (!c) {
    document.title = 'Koleksi tidak ditemukan · ' + CONFIG.shop;
    box.innerHTML = '<div class="nf"><h1>Koleksi tidak ditemukan</h1><p>Koleksi yang kamu cari tidak ada atau sudah tidak ditampilkan.</p><a class="btn" href="products.html">Lihat semua produk</a></div>';
    return;
  }
  document.title = c.title + ' · ' + CONFIG.shop;
  const items = (c.items || []).map(byId).filter(Boolean);
  const img = c.img || (items[0] && items[0].img);
  box.innerHTML =
    '<section class="coll-hero ph">' + photo(img, c.title, '') + '<div class="coll-hero-txt">' + (c.label ? '<span class="feat-label">' + esc(c.label) + '</span>' : '') + '<h1>' + esc(c.title) + '</h1>' + (c.text ? '<p>' + esc(c.text) + '</p>' : '') + '</div></section>' +
    ((c.reasons || []).length ? '<section class="coll-why" aria-label="Kenapa koleksi ini"><h2 class="cat-h">Kenapa cocok</h2><ol>' + c.reasons.map((r, i) => '<li><span class="n">' + (i + 1) + '</span><b>' + esc(r.t) + '</b>' + (r.d ? '<p>' + esc(r.d) + '</p>' : '') + '</li>').join('') + '</ol></section>' : '') +
    '<section aria-label="Pilihan produk"><div class="cat"><h2>Pilihan produk</h2></div>' +
    (items.length ? '<div class="pgrid">' + items.map(it => {
      const note = c.notes && c.notes[it.id];
      // keterangan "kenapa cocok" untuk produk ini; kalau kosong pakai deskripsi produk
      return itemHtml(it, !note).replace(/<\/a>$/, note ? '<p class="coll-note"><b>Kenapa cocok</b>' + esc(note) + '</p></a>' : '</a>');
    }).join('') + '</div>' : '<p class="ord-muted" style="text-align:center">Produk untuk koleksi ini belum tersedia.</p>') + '</section>';
}

/* Kutipan tokoh di bagian bawah beranda (config.quote; kosongkan teksnya untuk menyembunyikan). */
function quoteHtml() {
  const q = CONFIG.quote;
  if (!q || !q.text) return '';
  return '<figure class="quote"><span class="quote-mark" aria-hidden="true">“</span><blockquote' + (q.lang ? ' lang="' + esc(q.lang) + '"' : '') + '><p>' + esc(q.text) + '</p></blockquote>' +
    (q.author ? '<figcaption><b>' + esc(q.author) + '</b>' + (q.role ? '<span>' + esc(q.role) + '</span>' : '') + '</figcaption>' : '') + '</figure>';
}
function renderHome() {
  // Bagian beranda diatur di data/menu.json (config.home): tiap bagian punya judul dan daftar id produk.
  let secs = (CONFIG.home || []).map(sec => Object.assign({}, sec, { list: (sec.items || []).map(byId).filter(Boolean) })).filter(sec => sec.list.length);
  if (!secs.length) secs = [{ title: 'Pastry kami', list: ITEMS }];
  $('list').innerHTML = featuredHtml() + secs.map(sec =>
    '<section class="hsec" aria-label="' + esc(sec.title) + '"><div class="hsec-head"><div>' +
      (sec.label ? '<span class="label">' + esc(sec.label) + '</span>' : '') + '<h2>' + esc(sec.title) + '</h2></div>' +
      (sec.link ? '<a class="hsec-link" href="' + esc(sec.link.href) + '">' + esc(sec.link.text) + ' →</a>' : '') + '</div>' +
      '<div class="car"><button type="button" class="arr prev" aria-label="Sebelumnya">‹</button>' +
      '<div class="track">' + sec.list.map(it => itemHtml(it, false)).join('') + '</div>' +
      '<button type="button" class="arr next" aria-label="Berikutnya">›</button><div class="dots" aria-hidden="true"></div></div></section>').join('');
  setupCars();
  document.querySelector('.quote')?.remove();
  $('menu').insertAdjacentHTML('afterend', quoteHtml());
}
function renderProducts() {
  const tabs = $('tabs'), list = $('plist');
  if (!tabs.children.length) {
    // tombol kategori dibuat sekali; selanjutnya hanya status tekannya yang berganti, jadi warnanya beralih halus
    tabs.innerHTML = [{ id: 'all', name: 'Semua' }].concat(CATS).map(c => '<button type="button" class="tab" data-cat="' + c.id + '" aria-pressed="false">' + c.name + '</button>').join('');
  }
  tabs.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-pressed', String(t.dataset.cat === state.filter)));
  const html = CATS.filter(c => state.filter === 'all' || state.filter === c.id).map(c => {
    const items = ITEMS.filter(i => i.cat === c.id);
    return items.length ? '<div class="cat"><h2>' + c.name + '</h2></div><div class="pgrid">' + items.map(it => itemHtml(it, true)).join('') + '</div>' : '';
  }).join('');
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!list.dataset.ready || reduced) { list.innerHTML = html; list.dataset.ready = '1'; return; }
  // ganti kategori: daftar lama memudar dulu, lalu produk baru muncul bertahap; tinggi dijaga supaya halaman tidak melompat
  clearTimeout(list._t);
  list.style.minHeight = list.offsetHeight + 'px';
  list.classList.add('swap-out');
  list._t = setTimeout(() => {
    list.innerHTML = html;
    list.classList.remove('swap-out');
    list._t = setTimeout(() => { list.style.minHeight = ''; }, 600);
  }, 170);
}
/* ---- Carousel ---- */
function setupCars() {
  document.querySelectorAll('.car').forEach(car => {
    const track = car.querySelector('.track'), prev = car.querySelector('.prev'), next = car.querySelector('.next'), dots = car.querySelector('.dots');
    const stepOf = () => {
      const it = track.querySelector('.item');
      return it ? it.getBoundingClientRect().width + (parseFloat(getComputedStyle(track).columnGap) || 0) : track.clientWidth;
    };
    const maxLeft = () => track.scrollWidth - track.clientWidth;
    let idx = 0, lockUntil = 0;
    // satu halaman = sebanyak produk yang terlihat sekarang (4 di desktop, 3 di tablet, 2 di HP)
    function geom() {
      const st = stepOf(), gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      const vis = Math.max(1, Math.round((track.clientWidth + gap) / st));
      return { page: vis * st, pages: Math.max(1, Math.ceil(track.children.length / vis)) };
    }
    const pageNow = g => track.scrollLeft >= maxLeft() - 2 ? g.pages - 1 : Math.min(g.pages - 1, Math.round(track.scrollLeft / g.page));
    function upd() {
      const over = maxLeft() > 2;
      prev.hidden = next.hidden = dots.hidden = !over;
      if (!over) return;
      const g = geom();
      // saat animasi dari tombol berjalan, titik mengikuti tujuan, bukan posisi sementara
      const cur = Date.now() < lockUntil ? idx : pageNow(g);
      dots.innerHTML = Array.from({ length: g.pages }, (_, i) => '<span class="dot' + (i === cur ? ' on' : '') + '"></span>').join('');
    }
    // geser satu halaman per klik; di ujung kembali ke sisi sebaliknya
    function go(dir) {
      const g = geom();
      if (Date.now() >= lockUntil) idx = pageNow(g);
      idx += dir;
      if (idx > g.pages - 1) idx = 0;
      if (idx < 0) idx = g.pages - 1;
      lockUntil = Date.now() + 1000;
      track.scrollTo({ left: Math.min(idx * g.page, maxLeft()) });
      setTimeout(upd, 1050);
    }
    prev.addEventListener('click', () => go(-1));
    next.addEventListener('click', () => go(1));
    track.addEventListener('scroll', upd, { passive: true });
    new ResizeObserver(upd).observe(track);
    upd();
  });
}

/* ---- Halaman detail produk ---- */
let prodItem = null, prodQty = 1;
function updateInCart() {
  const el = $('inCart');
  if (!el || !prodItem) return;
  const n = state.cart[prodItem.id] || 0;
  el.hidden = !n; el.textContent = 'Sudah ada ' + n + ' di keranjangmu.';
}
const ICO = {
  alert: '<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17.5v.01"/>',
  truck: '<path d="M1 4h13v12H1zM14 8h4l4 4v4h-8"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  bag: '<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8a3 3 0 0 1 6 0"/>'
};
function hoursLine() {
  const s = storeStatus();
  return '<p class="hours"><span class="sd' + (s.open ? '' : ' off') + '" aria-hidden="true"></span><b>' + s.text + '</b><span>Jam buka ' + hoursText() + '</span></p>';
}
/* Animasi buka-tutup (tinggi dan pudar) untuk bagian yang disembunyikan lewat atribut hidden. */
const EASE = 'cubic-bezier(.22, .61, .36, 1)';
const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function slide(el, show, instant) {
  if (el._anim) { el._anim.cancel(); el._anim = null; el.style.overflow = ''; }
  if (instant || reducedMotion() || (!show && el.hidden) || (show && !el.hidden)) { el.hidden = !show; return; }
  if (show) {
    el.hidden = false;
    const h = el.offsetHeight;
    el.style.overflow = 'hidden';
    el._anim = el.animate([{ height: '0px', opacity: 0 }, { height: h + 'px', opacity: 1 }], { duration: 340, easing: EASE });
    el._anim.onfinish = () => { el.style.overflow = ''; el._anim = null; };
  } else {
    const h = el.offsetHeight;
    el.style.overflow = 'hidden';
    el._anim = el.animate([{ height: h + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 260, easing: EASE });
    el._anim.onfinish = () => { el.hidden = true; el.style.overflow = ''; el._anim = null; };
  }
}
// dropdown (peringatan alergi, delivery, pick up): isi membuka dan menutup dengan halus, bukan langsung muncul
document.addEventListener('click', e => {
  const sum = e.target.closest('.acc summary');
  if (!sum || reducedMotion()) return;
  const det = sum.parentElement, body = det.querySelector('.acc-body');
  if (!body) return;
  e.preventDefault();
  if (body._a) { body._a.cancel(); body._a = null; body.style.overflow = ''; }
  if (det.open && !det.classList.contains('closing')) {
    const h = body.offsetHeight;
    det.classList.add('closing'); body.style.overflow = 'hidden';
    body._a = body.animate([{ height: h + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 280, easing: EASE });
    body._a.onfinish = () => { det.open = false; det.classList.remove('closing'); body.style.overflow = ''; body._a = null; };
  } else {
    det.classList.remove('closing'); det.open = true;
    const h = body.offsetHeight;
    body.style.overflow = 'hidden';
    body._a = body.animate([{ height: '0px', opacity: 0 }, { height: h + 'px', opacity: 1 }], { duration: 340, easing: EASE });
    body._a.onfinish = () => { body.style.overflow = ''; body._a = null; };
  }
});
function accordion(it) {
  const slotText = CONFIG.slots.map(s => s.label).join(', ');
  const row = (key, title, body, open) => '<details' + (open ? ' open' : '') + '><summary><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICO[key] + '</svg>' + title + '</summary><div class="acc-body">' + body + '</div></details>';
  const al = it.allergens && it.allergens.length
    ? '<p class="al-l">Produk ini mengandung:</p><div class="al">' + it.allergens.map(x => '<span>' + esc(x) + '</span>').join('') + '</div>' : '';
  return '<div class="acc">' +
    row('alert', 'Peringatan alergi', al + '<p>' + esc(CONFIG.allergyNote) + '</p>', true) +
    row('truck', 'Delivery', '<p>Diantar ke alamatmu. Minimal pesanan ' + rp(CONFIG.minDelivery) + '.</p><ul>' +
      CONFIG.zones.map(z => '<li><span>' + esc(z.label) + '</span><b>' + rp(z.fee) + '</b></li>').join('') + '</ul>' +
      '<p>Jam antar: ' + esc(slotText) + '. Pilih tanggal dan jam saat memesan.</p>') +
    row('bag', 'Pick up', '<p>Ambil sendiri di <b>' + esc(CONFIG.address) + '</b>. Tidak ada minimal pesanan.</p><p>Jam ambil: ' + esc(slotText) + '. Pilih tanggal dan jam saat memesan.</p>') +
    '</div>';
}
/* Rekomendasi di halaman produk: urut berdasarkan kecocokan dengan produk yang dibuka.
   Satu kategori paling kuat; paket dan isinya saling merekomendasikan (isi paket dibaca dari daftar "includes");
   produk "Terlaris"/"Baru" dan harga yang mirip menambah nilai; produk yang habis dipush ke belakang. */
function relatedItems(it) {
  const inc = x => (x.includes || []).join(' ').toLowerCase();
  const mine = inc(it);
  const scored = ITEMS.filter(o => o.id !== it.id).map((o, idx) => {
    let sc = 0;
    if (o.cat === it.cat) sc += 50;
    if (mine && mine.includes(o.name.toLowerCase())) sc += 90;          // o ada di dalam paket ini
    if (inc(o).includes(it.name.toLowerCase())) sc += 90;                // paket yang berisi produk ini
    if (o.tag === 'Terlaris') sc += 15; else if (o.tag === 'Baru') sc += 8;
    sc += 20 * (1 - Math.min(1, Math.abs(o.price - it.price) / Math.max(it.price, 1)));
    if (o.soldOut) sc -= 100;
    return { o, sc, idx };
  });
  scored.sort((a, b) => b.sc - a.sc || a.idx - b.idx);
  return scored.slice(0, 8).map(x => x.o);
}
function renderProduct() {
  const it = byId(new URLSearchParams(location.search).get('id')), box = $('pd');
  if (!it) {
    document.title = 'Produk tidak ditemukan · ' + CONFIG.shop;
    box.innerHTML = '<div class="nf"><h1>Produk tidak ditemukan</h1><p>Produk yang kamu cari tidak ada atau sudah tidak dijual.</p><a class="btn" href="products.html">Lihat semua produk</a></div>';
    return;
  }
  prodItem = it; prodQty = 1;
  document.title = it.name + ' · ' + CONFIG.shop;
  $('crumbName').textContent = it.name;
  const cat = CATS.find(c => c.id === it.cat), closed = CONFIG.closedDays.map(d => DAYS[d]).join(', ');
  box.innerHTML = '<div class="pd-img ph">' + photo(it.img, it.name, 'Foto segera hadir') +
    (tagOf(it) ? '<span class="tag">' + esc(tagOf(it)) + '</span>' : '') + (it.soldOut ? '<div class="so">Habis hari ini</div>' : '') + '</div>' +
    '<div class="pd-info"><p class="label">' + esc(cat ? cat.name : '') + '</p><h1>' + esc(it.name) + '</h1><p class="pd-price">' + rp(it.price) + '</p>' +
    (it.soldOut ? '<p class="soldout">Habis hari ini. Coba lagi besok atau pilih produk lain.</p>' :
      '<div class="qtyrow"><span class="label">Jumlah</span><div class="stepper q"><button type="button" data-qty="-1" aria-label="Kurangi jumlah">−</button><output id="qty" aria-live="polite">1</output><button type="button" data-qty="1" aria-label="Tambah jumlah">+</button></div></div>' +
      '<p class="incart" id="inCart" hidden></p><button class="btn block" type="button" id="addBtn">Tambah ke keranjang</button>') +
    hoursLine() + '<p class="pd-desc">' + esc(it.desc) + '</p>' +
    (it.includes && it.includes.length ? '<div class="pd-incl"><span class="label">Isi paket</span><ul>' + it.includes.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>' : '') + accordion(it) +
    '<p class="hint">Toko mengonfirmasi pesananmu sebelum kamu membayar.</p></div>';
  const rel = relatedItems(it);
  $('rel').innerHTML = '<div class="cat"><h2>Kamu mungkin suka</h2></div><div class="car"><button type="button" class="arr prev" aria-label="Sebelumnya">‹</button>' +
    '<div class="track">' + rel.map(i => itemHtml(i, false)).join('') + '</div>' +
    '<button type="button" class="arr next" aria-label="Berikutnya">›</button><div class="dots" aria-hidden="true"></div></div>';
  setupCars();
  updateInCart();
}
let addTimer = 0;
document.addEventListener('click', e => {
  if (PAGE !== 'product' || !prodItem) return;
  const q = e.target.closest('[data-qty]');
  if (q) { prodQty = Math.max(1, Math.min(50, prodQty + Number(q.dataset.qty))); const o = $('qty'); o.textContent = prodQty; o.classList.remove('bump'); void o.offsetWidth; o.classList.add('bump'); return; }
  if (e.target.closest('#addBtn')) {
    change(prodItem.id, prodQty);
    const btn = $('addBtn'); btn.textContent = 'Ditambahkan ✓';
    clearTimeout(addTimer); addTimer = setTimeout(() => { btn.textContent = 'Tambah ke keranjang'; }, 1600);
  }
});

/* ---- Keranjang ---- */
const mode = () => { const r = document.querySelector('input[name="mode"]:checked'); return r ? r.value : 'pickup'; };
function totals() {
  let sub = 0, count = 0;
  Object.keys(state.cart).forEach(id => { const it = byId(id); sub += it.price * state.cart[id]; count += state.cart[id]; });
  const z = $('zone'), zone = CONFIG.zones.find(x => z && x.id === z.value) || CONFIG.zones[0];
  const fee = mode() === 'delivery' && count > 0 ? zone.fee : 0;
  return { sub, count, fee, total: sub + fee, zone };
}
const drawerOpen = () => $('drawer').classList.contains('open');
const hideDone = () => { const d = $('done'); if (d) d.hidden = true; };
const sumRows = (t, withFee) => '<div><span>Subtotal</span><span>' + rp(t.sub) + '</span></div>' +
  (withFee && mode() === 'delivery' ? '<div class="muted"><span>Ongkir</span><span>' + rp(t.fee) + '</span></div>' : '') +
  (withFee ? '<div class="total"><span>Total</span><span>' + rp(t.total) + '</span></div>' : '');
const TRUCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 4h13v12H1zM14 8h4l4 4v4h-8"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>';
const thumb = it => '<div class="th">' + (it.img ? '<img src="' + esc(it.img) + '" alt="" onerror="this.hidden=true">' : '') + '</div>';
function nudgeHtml(t) {
  const left = CONFIG.minDelivery - t.sub, pct = Math.min(100, Math.round(t.sub / CONFIG.minDelivery * 100));
  return '<div class="nrow">' + TRUCK + '<span>' + (left > 0
    ? 'Tambah <b>' + rp(left) + '</b> lagi supaya pesanan bisa diantar. Ambil di tempat tanpa minimal.'
    : 'Pesananmu sudah memenuhi minimal untuk diantar.') + '</span></div>' +
    '<div class="pg" aria-hidden="true"><i style="width:' + pct + '%"></i></div>';
}
function renderCartPage() {
  const t = totals(), ids = Object.keys(state.cart), has = ids.length > 0;
  $('krEmpty').hidden = has; $('krMain').hidden = !has;
  if (!has) return;
  $('krNudge').innerHTML = nudgeHtml(t);
  $('krLines').innerHTML = ids.map(id => {
    const it = byId(id), q = state.cart[id], href = 'product.html?id=' + encodeURIComponent(id);
    return '<li><a class="kr-th" href="' + href + '" aria-label="' + esc(it.name) + '">' + thumb(it) + '</a>' +
      '<div class="kr-info"><a class="kr-name" href="' + href + '">' + esc(it.name) + '</a><span class="kr-unit">' + rp(it.price) + ' per buah</span>' +
      '<div class="stepper"><button type="button" data-act="dec" data-id="' + id + '" aria-label="Kurangi ' + esc(it.name) + '">−</button><output>' + q + '</output><button type="button" data-act="inc" data-id="' + id + '" aria-label="Tambah ' + esc(it.name) + '">+</button></div></div>' +
      '<div class="kr-end"><span class="kr-total">' + rp(it.price * q) + '</span><button type="button" class="linkbtn" data-act="rm" data-id="' + id + '">Hapus</button></div></li>';
  }).join('');
  $('krSum').innerHTML = sumRows(t, false) + '<div class="muted"><span>Ongkir</span><span>Dihitung di detail pesanan</span></div>';
}
function renderCart() {
  const t = totals(), ids = Object.keys(state.cart), has = ids.length > 0;
  $('emptyMsg').hidden = has;

  // pengingat minimal pesanan antar
  const nd = $('nudge');
  nd.hidden = !has;
  if (has) nd.innerHTML = nudgeHtml(t);

  $('lines').innerHTML = ids.map(id => {
    const it = byId(id), q = state.cart[id];
    return '<li>' + thumb(it) +
      '<div class="lm"><span class="ln">' + esc(it.name) + '</span>' +
      '<div class="stepper"><button type="button" data-act="dec" data-id="' + id + '" aria-label="Kurangi ' + esc(it.name) + '">−</button><output>' + q + '</output><button type="button" data-act="inc" data-id="' + id + '" aria-label="Tambah ' + esc(it.name) + '">+</button></div></div>' +
      '<div class="rt"><button type="button" class="rm" data-act="rm" data-id="' + id + '" aria-label="Hapus ' + esc(it.name) + '">×</button><span class="price">' + rp(it.price * q) + '</span></div></li>';
  }).join('');

  $('sum').innerHTML = sumRows(t, false) + '<div class="muted"><span>Ongkir</span><span>Dihitung di detail pesanan</span></div>';
  $('dfoot').hidden = !has;
  const badge = $('cartN');
  const prevN = Number(badge.dataset.n || 0);
  badge.textContent = t.count > 99 ? '99+' : t.count; badge.hidden = t.count === 0;
  if (t.count > prevN && prevN !== undefined && badge.dataset.n !== undefined) { badge.classList.remove('pop'); void badge.offsetWidth; badge.classList.add('pop'); }
  badge.dataset.n = String(t.count);
  $('cartBtn').setAttribute('aria-label', (PAGE === 'checkout' ? 'Kembali ke keranjang, ' : 'Shopping Cart, ') + t.count + ' item');
  updateInCart();
  if (PAGE === 'checkout') renderCheckout();
  if (PAGE === 'cart') renderCartPage();
}
function change(id, d) {
  const it = byId(id); if (!it || it.soldOut) return;
  const q = Math.max(0, Math.min(50, (state.cart[id] || 0) + d));
  if (q === 0) delete state.cart[id]; else state.cart[id] = q;
  save(); hideDone(); renderCart();
}

/* ---- Panel keranjang ---- */
let lastFocus = null;
function openCart() {
  lastFocus = document.activeElement;
  $('drawer').removeAttribute('inert'); $('drawer').classList.add('open'); $('scrim').hidden = false;
  try { document.documentElement.style.overflow = 'hidden'; } catch (e) {}
  $('closeCart').focus();
}
function closeCart() {
  $('drawer').classList.remove('open'); $('drawer').setAttribute('inert', ''); $('scrim').hidden = true;
  try { document.documentElement.style.overflow = ''; } catch (e) {}
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

/* ---- Halaman detail pesanan (checkout.html) ---- */
const payVal = () => { const r = document.querySelector('input[name="pay"]:checked'); return r ? r.value : ''; };
function renderCheckout() {
  const t = totals(), ids = Object.keys(state.cart), has = ids.length > 0;
  $('coEmpty').hidden = has; $('coMain').hidden = !has;
  if (!has) return;
  $('coLines').innerHTML = ids.map(id => {
    const it = byId(id), q = state.cart[id];
    return '<li class="cl">' + thumb(it) + '<div class="lm"><span class="ln">' + esc(it.name) + '</span><span class="sub">' + q + ' × ' + rp(it.price) + '</span></div><span class="price">' + rp(it.price * q) + '</span></li>';
  }).join('');
  $('coSum').innerHTML = sumRows(t, true);
  const mh = $('minHint'), low = mode() === 'delivery' && t.sub < CONFIG.minDelivery;
  mh.hidden = !low;
  if (low) mh.textContent = 'Minimal pesanan antar ' + rp(CONFIG.minDelivery) + '. Tambah ' + rp(CONFIG.minDelivery - t.sub) + ' lagi atau pilih Ambil di tempat.';
}
const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const slotPast = (s, dateStr) => dateStr === isoDate(new Date()) && s.start <= new Date().getHours() + new Date().getMinutes() / 60 + 1;
const hasSlotOn = dateStr => CONFIG.slots.some(s => !slotPast(s, dateStr));
function buildSlots() {
  const val = $('date').value, cur = $('slot').value;
  $('slot').innerHTML = '<option value="">Pilih jam</option>' + CONFIG.slots.map(s => {
    const past = slotPast(s, val);
    return '<option value="' + s.label + '"' + (past ? ' disabled' : '') + '>' + s.label + (past ? ' (sudah lewat)' : '') + '</option>';
  }).join('');
  if ([...$('slot').options].some(o => o.value === cur && !o.disabled)) $('slot').value = cur;
  paintSlots();
}
// pilihan jam berupa tombol bulat; nilainya disimpan di <select id="slot"> yang disembunyikan
function paintSlots() {
  const val = $('date').value, sel = $('slot').value;
  $('slotChips').innerHTML = CONFIG.slots.map(s => {
    const past = slotPast(s, val);
    return '<button type="button" class="chip" role="radio" aria-checked="' + (s.label === sel) + '" data-slot="' + esc(s.label) + '"' + (past ? ' disabled title="Sudah lewat"' : '') + '>' + esc(s.label) + '</button>';
  }).join('');
}
// area antar: kartu pilihan; nilainya disimpan di <select id="zone"> yang disembunyikan
function paintZones() {
  const cur = $('zone').value;
  $('zoneCards').innerHTML = CONFIG.zones.map(z => '<label class="pay"><input type="radio" name="zonepick" value="' + esc(z.id) + '"' + (z.id === cur ? ' checked' : '') + '><b>' + esc(z.label) + '</b><span>' + rp(z.fee) + '</span></label>').join('');
}
// tanggal pertama yang bisa dipesan: hari ini kalau toko buka dan masih ada jam, kalau tidak hari berikutnya
function firstOrderDate() {
  const d = new Date();
  for (let i = 0; i < 14; i++, d.setDate(d.getDate() + 1)) {
    if (CONFIG.closedDays.includes(d.getDay())) continue;
    if (hasSlotOn(isoDate(d))) return isoDate(d);
  }
  return isoDate(new Date());
}
function setDate(iso, fire) {
  $('date').value = iso;
  const [y, m, dd] = iso.split('-').map(Number), d = new Date(y, m - 1, dd);
  $('dateTxt').textContent = DAYS[d.getDay()] + ', ' + dd + ' ' + MONTHS_ID[m - 1] + ' ' + y;
  if (fire) $('date').dispatchEvent(new Event('change'));
}
/* ---- kalender buatan sendiri (menggantikan pemilih tanggal bawaan browser) ---- */
function initDatePicker() {
  const pop = $('dpPop'), btn = $('dateBtn');
  let view = null;   // bulan yang sedang ditampilkan
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const maxD = new Date(today); maxD.setDate(maxD.getDate() + 60);
  const parse = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  const okDay = d => d >= today && d <= maxD && !CONFIG.closedDays.includes(d.getDay()) && hasSlotOn(isoDate(d));
  function draw() {
    const y = view.getFullYear(), m = view.getMonth(), sel = $('date').value, todayIso = isoDate(today);
    const first = new Date(y, m, 1), lead = (first.getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();   // pekan mulai Senin
    const prevOk = new Date(y, m, 0) >= today, nextOk = new Date(y, m + 1, 1) <= maxD;
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<span></span>';
    for (let d = 1; d <= days; d++) {
      const dt = new Date(y, m, d), iso = isoDate(dt), ok = okDay(dt);
      cells += '<button type="button" class="dp-d' + (iso === sel ? ' sel' : '') + (iso === todayIso ? ' today' : '') + '" data-iso="' + iso + '"' + (ok ? '' : ' disabled') +
        ' aria-label="' + DAYS[dt.getDay()] + ', ' + d + ' ' + MONTHS_ID[m] + ' ' + y + (ok ? '' : ', tidak tersedia') + '"' + (iso === sel ? ' aria-pressed="true"' : '') + '>' + d + '</button>';
    }
    pop.innerHTML = '<div class="dp-head"><button type="button" class="dp-nav" data-nav="-1" aria-label="Bulan sebelumnya"' + (prevOk ? '' : ' disabled') + '>‹</button>' +
      '<b>' + MONTHS_ID[m] + ' ' + y + '</b><button type="button" class="dp-nav" data-nav="1" aria-label="Bulan berikutnya"' + (nextOk ? '' : ' disabled') + '>›</button></div>' +
      '<div class="dp-w">' + ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(x => '<span>' + x + '</span>').join('') + '</div><div class="dp-g">' + cells + '</div>' +
      '<p class="dp-hint">Tanggal yang dicoret tidak tersedia (toko libur atau jam hari itu sudah lewat).</p>';
  }
  function open() {
    view = parse($('date').value || isoDate(today)); view.setDate(1);
    draw(); pop.hidden = false; btn.setAttribute('aria-expanded', 'true');
  }
  function close() { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
  btn.addEventListener('click', () => (pop.hidden ? open() : close()));
  pop.addEventListener('click', e => {
    const n = e.target.closest('[data-nav]'), d = e.target.closest('[data-iso]');
    if (n) { view.setMonth(view.getMonth() + Number(n.dataset.nav)); draw(); }
    if (d && !d.disabled) { setDate(d.dataset.iso, true); close(); btn.focus(); }
  });
  document.addEventListener('click', e => { if (!pop.hidden && !e.target.closest('#dp')) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !pop.hidden) { close(); btn.focus(); } });
}
function initForm() {
  $('pays').innerHTML = CONFIG.payments.map((p, i) => '<label class="pay"><input type="radio" name="pay" value="' + esc(p.id) + '"' + (i === 0 ? ' checked' : '') + '><b>' + esc(p.label) + '</b><span>' + esc(p.desc) + '</span></label>').join('');
  $('zone').innerHTML = CONFIG.zones.map(z => '<option value="' + z.id + '">' + z.label + ' · ' + rp(z.fee) + '</option>').join('');
  paintZones();
  setDate(firstOrderDate(), false);
  initDatePicker();
  $('pickupInfo').innerHTML = 'Ambil sendiri di <b>' + esc(CONFIG.address) + '</b>. Jam buka ' + hoursText() + '. Tidak ada minimal pesanan.';
  buildSlots();
  syncPayBtn();
  $('slotChips').addEventListener('click', e => {
    const c = e.target.closest('[data-slot]');
    if (!c || c.disabled) return;
    $('slot').value = c.dataset.slot; paintSlots(); $('slot').dispatchEvent(new Event('change'));
  });
  $('zoneCards').addEventListener('change', e => { $('zone').value = e.target.value; $('zone').dispatchEvent(new Event('change')); });
}
let modeInit = true;
function syncMode() {
  const d = mode() === 'delivery', first = modeInit;
  modeInit = false;
  slide($('deliveryFields'), d, first); slide($('pickupInfo'), !d, first);
  hideDone(); renderCart();
}
// label tombol di ringkasan: transfer/QRIS bayar dulu, tunai langsung kirim
function syncPayBtn() { const b = $('submitBtn'); if (b) b.textContent = payVal() === 'tunai' ? 'Kirim pesanan' : 'Lanjutkan pembayaran'; }
function showErr(m) { const e = $('err'); e.textContent = m; e.hidden = !m; }

function validate() {
  if (CONFIG.acceptOrders === false) return 'Toko sedang tutup dan belum menerima pesanan.' + (CONFIG.closedNote ? ' ' + CONFIG.closedNote : '');
  const t = totals();
  if (t.count === 0) return 'Pilih minimal satu pastry dari menu.';
  if (!$('name').value.trim()) return 'Isi nama kamu.';
  if ($('phone').value.replace(/[^\d]/g, '').length < 9) return 'Isi nomor HP yang benar.';
  const date = $('date').value;
  if (!date) return 'Pilih tanggal.';
  const [y, m, dd] = date.split('-').map(Number), dObj = new Date(y, m - 1, dd);
  if (date < isoDate(new Date())) return 'Tanggal sudah lewat.';
  if (CONFIG.closedDays.includes(dObj.getDay())) return 'Kami tutup hari ' + DAYS[dObj.getDay()] + '. Pilih tanggal lain.';
  if (!$('slot').value) return 'Pilih jam ' + (mode() === 'delivery' ? 'antar.' : 'ambil.');
  if (mode() === 'delivery') {
    if (t.sub < CONFIG.minDelivery) return 'Minimal pesanan antar ' + rp(CONFIG.minDelivery) + '. Tambah ' + rp(CONFIG.minDelivery - t.sub) + ' lagi atau pilih Ambil di tempat.';
    if (!$('addr').value.trim()) return 'Isi alamat lengkap untuk pengantaran.';
  }
  if (!payVal()) return 'Pilih metode pembayaran.';
  return '';
}
/* ---- Events ---- */
document.addEventListener('click', e => {
  const tab = e.target.closest('[data-cat]');
  if (tab && PAGE === 'products') {
    state.filter = tab.dataset.cat; renderProducts();
    try { history.replaceState(null, '', tab.dataset.cat === 'all' ? location.pathname : '#' + tab.dataset.cat); } catch (err) {}
    return;
  }
  const b = e.target.closest('[data-act]');
  if (b) change(b.dataset.id, b.dataset.act === 'inc' ? 1 : (b.dataset.act === 'rm' ? -999 : -1));
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && drawerOpen()) closeCart(); });
if (PAGE !== 'checkout') $('cartBtn').addEventListener('click', openCart);   // di checkout, tombol ini tautan ke halaman keranjang
$('themeBtn').addEventListener('click', toggleTheme);
paintThemeBtn();
// jika pembeli belum memilih sendiri, ikuti perubahan pengaturan sistem
try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paintThemeBtn); } catch (e) {}
/* ---- Akun pembeli: tautan "Login" berubah jadi "Akun" kalau sudah masuk ---- */
const USER_HINT = 'sweetbite-user';
function paintLogin(user) {
  const a = $('loginLink');
  if (!a) return;
  a.href = user ? 'akun.html' : 'masuk.html';
  a.setAttribute('aria-label', user ? 'Akun saya' : 'Login');
  a.title = user ? 'Akun saya' : 'Login';
  a.classList.toggle('on', !!user);
}
function rememberUser(user) { try { user ? sessionStorage.setItem(USER_HINT, '1') : sessionStorage.removeItem(USER_HINT); } catch (e) {} paintLogin(user); }
try { if (sessionStorage.getItem(USER_HINT)) paintLogin({}); } catch (e) {}   // tebakan awal supaya tautan tidak berkedip
const authReady = fetch('api/user.php?action=me', { cache: 'no-store' }).then(r => r.json()).then(d => {
  const user = d && d.loggedIn ? d.user : null;
  rememberUser(user);
  return user;
}).catch(() => null);
$('closeCart').addEventListener('click', closeCart);
$('scrim').addEventListener('click', closeCart);
$('toMenu').addEventListener('click', e => { if (PAGE === 'products') { e.preventDefault(); closeCart(); } });

if (PAGE === 'checkout') {
  document.querySelectorAll('input[name="mode"]').forEach(r => r.addEventListener('change', syncMode));
  $('zone').addEventListener('change', () => { hideDone(); renderCart(); });
  $('date').addEventListener('change', buildSlots);
  $('pays').addEventListener('change', syncPayBtn);

  const headers = { 'Content-Type': 'application/json', 'X-Requested-With': 'sb' };
  const orderBody = () => {
    const body = {
      name: $('name').value.trim(), phone: $('phone').value.trim(), mode: mode(),
      date: $('date').value, slot: $('slot').value, payment: payVal(), note: $('note').value.trim(),
      items: Object.keys(state.cart).map(id => ({ id, qty: state.cart[id] }))
    };
    if (mode() === 'delivery') { body.zone = $('zone').value; body.address = $('addr').value.trim(); }
    return body;
  };
  const post = async (action, body) => {
    const r = await fetch('api/order.php?action=' + action, { method: 'POST', headers, body: JSON.stringify(body) });
    return { ok: r.ok, data: await r.json().catch(() => null) };
  };
  const done = data => {
    state.cart = {}; save();
    try { localStorage.setItem('sweetbite-last-order', data.id); } catch (err) {}
    location.href = 'pesanan.html?id=' + encodeURIComponent(data.id);
  };

  $('form').addEventListener('submit', async e => {
    e.preventDefault();
    const m = validate(); showErr(m);
    if (m) return;
    const btn = $('submitBtn'), body = orderBody(), cash = payVal() === 'tunai';
    btn.disabled = true; btn.textContent = cash ? 'Mengirim…' : 'Memeriksa…';
    let go = false;
    try {
      if (cash) {
        // bayar tunai: pesanan langsung dibuat
        const r = await post('create', body);
        if (!r.ok || !r.data || !r.data.id) { showErr((r.data && r.data.error) || 'Pesanan belum terkirim. Coba lagi sebentar lagi.'); return; }
        go = true; done(r.data);
      } else {
        // transfer / QRIS: periksa pesanan, tampilkan cara bayar, pesanan baru dibuat setelah pembeli membayar
        const r = await post('prepare', body);
        if (!r.ok || !r.data || !r.data.info) { showErr((r.data && r.data.error) || 'Belum bisa menampilkan pembayaran. Coba lagi sebentar lagi.'); return; }
        openPay(r.data, body);
      }
    } catch (err) {
      showErr('Tidak bisa terhubung ke server. Periksa koneksi lalu coba lagi.');
    } finally {
      if (!go) { btn.disabled = false; syncPayBtn(); }
    }
  });

  /* ---- jendela pembayaran (transfer bank / QRIS) ---- */
  function closePay() {
    const m = $('payModal');
    if (m) m.remove();
    document.body.style.overflow = '';
  }
  function openPay(prep, body) {
    closePay();
    const isQ = prep.method === 'qris', info = prep.info;
    const how = isQ
      ? '<div class="pm-qris">' + (info.image ? '<img src="' + esc(info.image) + '" alt="Kode QRIS ' + esc(CONFIG.shop) + '"><a class="linkbtn" href="' + esc(info.image) + '" download>Simpan gambar QRIS</a>' : '') + '</div>' +
        '<p class="pm-note">Scan dengan aplikasi bank atau e-wallet, lalu bayar <b>tepat ' + rp(prep.total) + '</b>.</p>'
      : '<div class="pm-acc"><span>' + esc(info.bank) + '</span><b id="pmNo">' + esc(info.number) + '</b><span>a.n. ' + esc(info.holder) + '</span>' +
        '<button type="button" class="linkbtn" id="pmCopy">Salin nomor rekening</button></div>' +
        '<p class="pm-note">Transfer <b>tepat ' + rp(prep.total) + '</b> ke rekening di atas.</p>';
    document.body.insertAdjacentHTML('beforeend',
      '<div class="paymodal" id="payModal" role="dialog" aria-modal="true" aria-labelledby="pmT"><div class="pm-card">' +
        '<button type="button" class="pm-x" id="pmX" aria-label="Tutup">✕</button>' +
        '<span class="label">Langkah terakhir · ' + esc(prep.label) + '</span><h2 id="pmT">Bayar dulu, pesananmu dibuat setelahnya</h2>' +
        '<div class="pm-total"><span>Total yang dibayar</span><b>' + rp(prep.total) + '</b></div>' + how +
        '<div class="field"><label for="pmProof">Bukti pembayaran (opsional)</label><input id="pmProof" type="file" accept="image/jpeg,image/png,image/webp"></div>' +
        '<p class="err" id="pmErr" role="alert" hidden></p>' +
        '<button type="button" class="btn block" id="pmOk">Saya sudah bayar</button>' +
        '<button type="button" class="btn ghost block" id="pmBack">Kembali</button>' +
        '<p class="hint">Pesanan baru dibuat setelah kamu menekan "Saya sudah bayar". Toko akan memeriksa pembayaranmu sebelum mengonfirmasi pesanan.</p>' +
      '</div></div>');
    document.body.style.overflow = 'hidden';
    const err = m => { $('pmErr').textContent = m || ''; $('pmErr').hidden = !m; };
    $('pmX').addEventListener('click', closePay);
    $('pmBack').addEventListener('click', closePay);
    $('payModal').addEventListener('click', e => { if (e.target.id === 'payModal') closePay(); });
    document.addEventListener('keydown', function esc1(e) { if (e.key === 'Escape') { closePay(); document.removeEventListener('keydown', esc1); } });
    const copy = $('pmCopy');
    if (copy) copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(info.number); copy.textContent = 'Tersalin ✓'; } catch (e) { copy.textContent = 'Tekan lama untuk menyalin'; }
      setTimeout(() => { copy.textContent = 'Salin nomor rekening'; }, 1800);
    });
    $('pmOk').addEventListener('click', async () => {
      const ok = $('pmOk'), file = $('pmProof').files[0];
      err(''); ok.disabled = true; ok.textContent = 'Membuat pesanan…';
      try {
        let proof = '';
        if (file) {
          const fd = new FormData(); fd.append('photo', file);
          const r = await fetch('api/order.php?action=proof', { method: 'POST', headers: { 'X-Requested-With': 'sb' }, body: fd });
          const d = await r.json().catch(() => null);
          if (!r.ok || !d || !d.proof) { err((d && d.error) || 'Bukti belum terunggah. Coba lagi atau kosongkan.'); ok.disabled = false; ok.textContent = 'Saya sudah bayar'; return; }
          proof = d.proof;
        }
        const r = await post('confirm', Object.assign({}, body, { expectTotal: prep.total, proof }));
        if (!r.ok || !r.data || !r.data.id) { err((r.data && r.data.error) || 'Pesanan belum terkirim. Coba lagi sebentar lagi.'); ok.disabled = false; ok.textContent = 'Saya sudah bayar'; return; }
        done(r.data);
      } catch (e) {
        err('Tidak bisa terhubung ke server. Periksa koneksi lalu coba lagi.'); ok.disabled = false; ok.textContent = 'Saya sudah bayar';
      }
    });
    $('pmOk').focus();
  }
}

initInfo();
initHeaderHide();
if (PAGE === 'checkout') { initForm(); syncMode(); } else { renderCart(); }
if (PAGE === 'checkout') authReady.then(user => {
  const note = $('coAcct');
  if (user) {
    if (!$('name').value.trim()) $('name').value = user.name;
    if (!$('phone').value.trim()) $('phone').value = user.phone;
    note.innerHTML = 'Masuk sebagai <b>' + esc(user.name) + '</b>. Pesanan ini akan tersimpan di <a href="akun.html">akunmu</a>.';
  } else {
    note.innerHTML = 'Punya akun? <a href="masuk.html?next=checkout.html">Masuk</a> atau <a href="masuk.html?next=checkout.html#daftar">daftar</a> supaya riwayat pesananmu tersimpan. Tanpa akun pun tetap bisa memesan.';
  }
  note.hidden = false;
});
if (PAGE === 'home') renderHome();
if (PAGE === 'product') renderProduct();
if (PAGE === 'koleksi') renderCollection();
if (PAGE === 'products') {
  const h = location.hash.slice(1);
  if (CATS.some(c => c.id === h)) state.filter = h;
  renderProducts();
}
