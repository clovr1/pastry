/* Senja Pastry: logika bersama untuk semua halaman (keranjang, panel pesanan, menu atas). */
const PAGE = document.body.dataset.page || 'home';

/* ---- Kerangka bersama: menu atas, tombol keranjang, panel pesanan ---- */
function mountShell() {
  if (PAGE === 'checkout') {
    document.querySelector('.wrap').insertAdjacentHTML('afterbegin',
      '<header class="top top-min" id="top">' +
        '<a class="brand" href="index.html" id="shopName">Senja Pastry</a>' +
        '<button class="backcart" type="button" id="cartBtn" aria-label="Kembali ke keranjang, 0 item">' +
          '<span aria-hidden="true">←</span><span>Kembali ke keranjang</span><span class="cn" id="cartN" hidden>0</span></button>' +
      '</header><div class="notice" id="notice" role="status" hidden></div>');
    document.body.insertAdjacentHTML('beforeend', SHELL_PANEL);
    return;
  }
  const cur = n => ((PAGE === n || (n === 'products' && PAGE === 'product')) ? ' aria-current="page"' : '');
  document.querySelector('.wrap').insertAdjacentHTML('afterbegin',
    '<header class="top" id="top">' +
      '<a class="brand" href="index.html" id="shopName">Senja Pastry</a>' +
      '<nav class="nav" aria-label="Menu utama">' +
        '<a href="index.html"' + cur('home') + '>Home</a>' +
        '<a href="products.html"' + cur('products') + '>Product</a>' +
        '<a href="#" id="loginLink">Login</a>' +
      '</nav>' +
      '<div class="top-r"><span class="status" id="status">Memuat…</span>' +
        '<button class="cartbtn" type="button" id="cartBtn" aria-label="Shopping Cart, 0 item">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 7H6"/></svg>' +
          '<span class="cn" id="cartN" hidden>0</span></button></div>' +
    '</header><div class="notice" id="notice" role="status" hidden></div>');
  document.body.insertAdjacentHTML('beforeend', SHELL_PANEL);
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
    <a class="btn block" href="checkout.html" id="toForm">Lanjut ke detail pesanan</a>
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
try { const s = JSON.parse(localStorage.getItem('senja-cart') || '{}'); if (s && typeof s === 'object') state.cart = s; } catch (e) {}
const byId = id => ITEMS.find(i => i.id === id);
Object.keys(state.cart).forEach(id => { const it = byId(id); if (!it || it.soldOut || !(state.cart[id] > 0)) delete state.cart[id]; });
const save = () => { try { localStorage.setItem('senja-cart', JSON.stringify(state.cart)); } catch (e) {} };

function photo(src, name, label) {
  const ph = '<div class="noimg"' + (src ? ' hidden' : '') + '><i>' + esc(name) + '</i><span>' + label + '</span></div>';
  return src ? '<img src="' + esc(src) + '" alt="' + esc(name) + '" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false">' + ph : ph;
}

/* ---- Info toko ---- */
function storeStatus() {
  const now = new Date(), closedDay = CONFIG.closedDays.includes(now.getDay());
  const open = !closedDay && now.getHours() >= CONFIG.open && now.getHours() < CONFIG.close;
  return { open, text: open ? 'Buka sekarang' : (closedDay ? 'Tutup hari ini' : 'Sedang tutup') };
}
function hoursText() {
  const closed = CONFIG.closedDays.map(d => DAYS[d]).join(', ');
  return pad(CONFIG.open) + '.00–' + pad(CONFIG.close) + '.00' + (closed ? ' · Tutup ' + closed : '');
}
function initInfo() {
  $('shopName').textContent = CONFIG.shop;
  if (PAGE !== 'product') document.title = (PAGE === 'products' ? 'Product · ' : PAGE === 'checkout' ? 'Detail pesanan · ' : '') + CONFIG.shop;
  if ($('bnImg')) {
    const b = CONFIG.banner;
    $('bnBadge').textContent = b.badge; $('bnBadge').hidden = !b.badge;
    $('bnTitle').textContent = b.title; $('bnCta').textContent = b.cta;
    $('bnImg').innerHTML = photo(b.img, CONFIG.shop, 'Foto banner · rasio 16:8');
  }
  const s = storeStatus(), st = $('status');
  if (st) { st.textContent = s.text; st.classList.toggle('closed', !s.open); }
}

/* ---- Menu ---- */
function itemHtml(it, withDesc) {
  return '<a class="item" href="product.html?id=' + encodeURIComponent(it.id) + '" data-item="' + it.id + '"><div class="ph">' + photo(it.img, it.name, 'Foto segera hadir') +
    (it.tag ? '<span class="tag">' + esc(it.tag) + '</span>' : '') +
    (it.soldOut ? '<div class="so">Habis hari ini</div>' : '') + '</div>' +
    '<span class="nm">' + esc(it.name) + '</span><span class="price">' + rp(it.price) + '</span>' +
    (withDesc ? '<p>' + esc(it.desc) + '</p>' : '') + '</a>';
}
function renderHome() {
  $('list').innerHTML = '<div class="car"><button type="button" class="arr prev" aria-label="Sebelumnya">‹</button>' +
    '<div class="track">' + ITEMS.map(it => itemHtml(it, false)).join('') + '</div>' +
    '<button type="button" class="arr next" aria-label="Berikutnya">›</button><div class="dots" aria-hidden="true"></div></div>';
  setupCars();
}
function renderProducts() {
  const all = [{ id: 'all', name: 'Semua' }].concat(CATS);
  $('tabs').innerHTML = all.map(c => '<button type="button" class="tab" data-cat="' + c.id + '" aria-pressed="' + (state.filter === c.id) + '">' + c.name + '</button>').join('');
  $('plist').innerHTML = CATS.filter(c => state.filter === 'all' || state.filter === c.id).map(c => {
    const items = ITEMS.filter(i => i.cat === c.id);
    return items.length ? '<div class="cat"><h2>' + c.name + '</h2></div><div class="pgrid">' + items.map(it => itemHtml(it, true)).join('') + '</div>' : '';
  }).join('');
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
    (it.tag ? '<span class="tag">' + esc(it.tag) + '</span>' : '') + (it.soldOut ? '<div class="so">Habis hari ini</div>' : '') + '</div>' +
    '<div class="pd-info"><p class="label">' + esc(cat ? cat.name : '') + '</p><h1>' + esc(it.name) + '</h1><p class="pd-price">' + rp(it.price) + '</p>' +
    (it.soldOut ? '<p class="soldout">Habis hari ini. Coba lagi besok atau pilih produk lain.</p>' :
      '<div class="qtyrow"><span class="label">Jumlah</span><div class="stepper q"><button type="button" data-qty="-1" aria-label="Kurangi jumlah">−</button><output id="qty" aria-live="polite">1</output><button type="button" data-qty="1" aria-label="Tambah jumlah">+</button></div></div>' +
      '<p class="incart" id="inCart" hidden></p><button class="btn block" type="button" id="addBtn">Tambah ke keranjang</button>') +
    hoursLine() + '<p class="pd-desc">' + esc(it.desc) + '</p>' + accordion(it) +
    '<p class="hint">Pesanan dikonfirmasi lewat WhatsApp sebelum kamu bayar.</p></div>';
  const others = ITEMS.filter(i => i.id !== it.id);
  const rel = others.filter(i => i.cat === it.cat).concat(others.filter(i => i.cat !== it.cat)).slice(0, 4);
  $('rel').innerHTML = '<div class="cat"><h2>Produk lainnya</h2></div><div class="pgrid">' + rel.map(i => itemHtml(i, false)).join('') + '</div>';
  updateInCart();
}
let addTimer = 0;
document.addEventListener('click', e => {
  if (PAGE !== 'product' || !prodItem) return;
  const q = e.target.closest('[data-qty]');
  if (q) { prodQty = Math.max(1, Math.min(50, prodQty + Number(q.dataset.qty))); $('qty').textContent = prodQty; return; }
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
function renderCart() {
  const t = totals(), ids = Object.keys(state.cart), has = ids.length > 0;
  $('emptyMsg').hidden = has;

  // pengingat minimal pesanan antar
  const nd = $('nudge');
  nd.hidden = !has;
  if (has) {
    const left = CONFIG.minDelivery - t.sub, pct = Math.min(100, Math.round(t.sub / CONFIG.minDelivery * 100));
    nd.innerHTML = '<div class="nrow">' + TRUCK + '<span>' + (left > 0
      ? 'Tambah <b>' + rp(left) + '</b> lagi supaya pesanan bisa diantar. Ambil di tempat tanpa minimal.'
      : 'Pesananmu sudah memenuhi minimal untuk diantar.') + '</span></div>' +
      '<div class="pg" aria-hidden="true"><i style="width:' + pct + '%"></i></div>';
  }

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
  badge.textContent = t.count > 99 ? '99+' : t.count; badge.hidden = t.count === 0;
  $('cartBtn').setAttribute('aria-label', (PAGE === 'checkout' ? 'Kembali ke keranjang, ' : 'Shopping Cart, ') + t.count + ' item');
  updateInCart();
  if (PAGE === 'checkout') renderCheckout();
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
function buildSlots() {
  const val = $('date').value, now = new Date();
  const today = val === isoDate(now), cur = $('slot').value;
  $('slot').innerHTML = '<option value="">Pilih jam</option>' + CONFIG.slots.map(s => {
    const past = today && s.start <= now.getHours() + now.getMinutes() / 60 + 1;
    return '<option value="' + s.label + '"' + (past ? ' disabled' : '') + '>' + s.label + (past ? ' (sudah lewat)' : '') + '</option>';
  }).join('');
  if ([...$('slot').options].some(o => o.value === cur && !o.disabled)) $('slot').value = cur;
}
function initForm() {
  $('zone').innerHTML = CONFIG.zones.map(z => '<option value="' + z.id + '">' + z.label + ' · ' + rp(z.fee) + '</option>').join('');
  const today = isoDate(new Date());
  $('date').min = today; $('date').value = today;
  $('pickupInfo').innerHTML = 'Ambil sendiri di <b>' + esc(CONFIG.address) + '</b>. Jam buka ' + hoursText() + '. Tidak ada minimal pesanan.';
  buildSlots();
}
function syncMode() {
  const d = mode() === 'delivery';
  $('deliveryFields').hidden = !d; $('pickupInfo').hidden = d;
  hideDone(); renderCart();
}
function showErr(m) { const e = $('err'); e.textContent = m; e.hidden = !m; }

function validate() {
  const t = totals();
  if (t.count === 0) return 'Pilih minimal satu pastry dari menu.';
  if (!$('name').value.trim()) return 'Isi nama kamu.';
  if ($('phone').value.replace(/[^\d]/g, '').length < 9) return 'Isi nomor WhatsApp yang benar.';
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
function buildMessage() {
  const t = totals(), d = mode() === 'delivery';
  const dt = new Date($('date').value + 'T00:00:00');
  const L = ['Halo ' + CONFIG.shop + ', saya mau pesan:', ''];
  Object.keys(state.cart).forEach(id => { const it = byId(id), q = state.cart[id]; L.push('• ' + q + '× ' + it.name + ' (' + rp(it.price * q) + ')'); });
  L.push('', 'Subtotal: ' + rp(t.sub));
  if (d) L.push('Ongkir (' + t.zone.label + '): ' + rp(t.fee));
  L.push('Total: ' + rp(t.total), '');
  L.push('Cara terima: ' + (d ? 'Delivery (diantar)' : 'Ambil di tempat'));
  L.push('Tanggal: ' + DAYS[dt.getDay()] + ', ' + dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }));
  L.push('Jam: ' + $('slot').value);
  if (d) L.push('Alamat: ' + $('addr').value.trim());
  L.push('Nama: ' + $('name').value.trim());
  L.push('WhatsApp: ' + $('phone').value.trim());
  L.push('Pembayaran: ' + payVal());
  if ($('note').value.trim()) L.push('Catatan: ' + $('note').value.trim());
  return L.join('\n');
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
$('cartBtn').addEventListener('click', openCart);
let noticeTimer = 0;
const loginLink = $('loginLink');
if (loginLink) loginLink.addEventListener('click', e => {
  e.preventDefault();
  const n = $('notice');
  n.textContent = 'Fitur login segera hadir. Kamu tetap bisa langsung memesan tanpa akun.';
  n.hidden = false;
  clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { n.hidden = true; }, 4500);
});
$('closeCart').addEventListener('click', closeCart);
$('scrim').addEventListener('click', closeCart);
$('toMenu').addEventListener('click', e => { if (PAGE === 'products') { e.preventDefault(); closeCart(); } });

if (PAGE === 'checkout') {
  document.querySelectorAll('input[name="mode"]').forEach(r => r.addEventListener('change', syncMode));
  $('zone').addEventListener('change', () => { hideDone(); renderCart(); });
  $('date').addEventListener('change', buildSlots);
  $('editCart').addEventListener('click', openCart);
  $('form').addEventListener('submit', e => {
    e.preventDefault();
    const m = validate(); showErr(m);
    if (m) return;
    const text = buildMessage();
    $('msg').textContent = text;
    $('waShow').textContent = '+' + CONFIG.whatsapp;
    $('waLink').href = 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(text);
    $('done').hidden = false;
    $('done').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('copyBtn').addEventListener('click', () => {
    const btn = $('copyBtn'), text = $('msg').textContent;
    const fallback = () => { const r = document.createRange(); r.selectNodeContents($('msg')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); btn.textContent = 'Pesan terpilih, tekan salin'; };
    try {
      navigator.clipboard.writeText(text).then(() => { btn.textContent = 'Tersalin'; setTimeout(() => btn.textContent = 'Salin pesan', 2000); }, fallback);
    } catch (err) { fallback(); }
  });
}

initInfo();
if (PAGE === 'checkout') { initForm(); syncMode(); } else { renderCart(); }
if (PAGE === 'home') renderHome();
if (PAGE === 'product') renderProduct();
if (PAGE === 'products') {
  const h = location.hash.slice(1);
  if (CATS.some(c => c.id === h)) state.filter = h;
  renderProducts();
}
