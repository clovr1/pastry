/* Halaman owner: pesanan masuk, ubah status, tandai lunas. Data diambil dari ../api/owner.php dan diperbarui otomatis. */
(function () {
  const $ = id => document.getElementById(id);
  // semua teks dari pembeli melewati esc() sebelum masuk ke halaman, supaya tidak bisa menyisipkan kode
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rp = n => 'Rp ' + Math.round(n).toLocaleString('id-ID');
  const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const ACTIVE = ['baru', 'dikonfirmasi', 'disiapkan', 'siap'];
  const FILTERS = [['aktif', 'Aktif'], ['baru', 'Baru'], ['dikonfirmasi', 'Dikonfirmasi'], ['disiapkan', 'Disiapkan'], ['siap', 'Siap'], ['selesai', 'Selesai'], ['dibatalkan', 'Dibatalkan'], ['semua', 'Semua']];
  const label = (s, mode) => ({ baru: 'Baru', dikonfirmasi: 'Dikonfirmasi', disiapkan: 'Disiapkan', siap: mode === 'delivery' ? 'Diantar' : 'Siap diambil', selesai: 'Selesai', dibatalkan: 'Dibatalkan' }[s] || s);
  const NEXT = { baru: ['dikonfirmasi', 'Konfirmasi pesanan'], dikonfirmasi: ['disiapkan', 'Mulai disiapkan'], disiapkan: ['siap', null], siap: ['selesai', 'Tandai selesai'] };

  let SHOP = 'Toko';
  const brandHtml = name => {
    const w = String(name).trim().split(/\s+/), first = w.shift();
    return '<span class="b1">' + esc(first) + '</span>' + (w.length ? '<span class="b2">' + esc(w.join(' ')) + '</span>' : '');
  };
  const state = { orders: [], counts: {}, filter: 'aktif', q: '', open: new Set(), fresh: new Set(), maxId: 0, first: true, offset: 0, confirm: null, sound: false, timer: 0, busy: false };
  try { state.sound = localStorage.getItem('sweetbite-owner-sound') === '1'; } catch (e) {}

  /* ---------- tema ---------- */
  const ICON_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  const ICON_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const curTheme = () => document.documentElement.getAttribute('data-theme') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  function paintTheme() {
    const dark = curTheme() === 'dark';
    $('themeBtn').innerHTML = dark ? ICON_SUN : ICON_MOON;
    $('themeBtn').setAttribute('aria-label', dark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap');
  }
  $('themeBtn').addEventListener('click', () => {
    const next = curTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('sweetbite-theme', next); } catch (e) {}
    paintTheme();
  });
  paintTheme();

  /* ---------- API ---------- */
  async function api(action, opt) {
    opt = opt || {};
    const init = { method: opt.method || 'GET', headers: { 'X-Requested-With': 'sb' }, cache: 'no-store', credentials: 'same-origin' };
    if (opt.body) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opt.body); }
    const r = await fetch('../api/owner.php?action=' + action, init);
    let data = null;
    try { data = await r.json(); } catch (e) {}
    return { status: r.status, ok: r.ok, data };
  }

  /* ---------- tampilan ---------- */
  const show = name => ['loading', 'setup', 'login', 'dash'].forEach(n => { $(n).hidden = n !== name; });
  const nowTs = () => Date.now() / 1000 + state.offset;
  function ago(ts) {
    const s = Math.max(0, Math.round(nowTs() - ts));
    if (s < 60) return 'baru saja';
    if (s < 3600) return Math.floor(s / 60) + ' mnt lalu';
    if (s < 86400) return Math.floor(s / 3600) + ' jam lalu';
    return Math.floor(s / 86400) + ' hari lalu';
  }
  function shortDate(s) {
    const d = new Date(s + 'T00:00:00');
    return DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
  }
  function waLink(phone) {
    let p = String(phone).replace(/\D/g, '');
    if (p.startsWith('0')) p = '62' + p.slice(1);
    return 'https://wa.me/' + p;
  }
  let toastTimer = 0;
  function toast(msg) {
    let t = $('toast');
    if (!t) {
      t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status');
      t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:12px 20px;border-radius:999px;font-weight:600;font-size:14px;z-index:50;max-width:90vw;text-align:center';
      document.body.appendChild(t);
    }
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 4000);
  }

  let audio = null;
  function beep() {
    if (!state.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const t = audio.currentTime;
      [880, 1175].forEach((f, i) => {
        const o = audio.createOscillator(), g = audio.createGain(), at = t + i * 0.18;
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.25, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
        o.connect(g); g.connect(audio.destination); o.start(at); o.stop(at + 0.32);
      });
    } catch (e) {}
  }
  function paintSound() {
    $('soundBtn').textContent = 'Bunyi: ' + (state.sound ? 'nyala' : 'mati');
    $('soundBtn').setAttribute('aria-pressed', String(state.sound));
  }

  function visible() {
    let list = state.orders;
    if (state.filter === 'aktif') list = list.filter(o => ACTIVE.includes(o.status));
    else if (state.filter !== 'semua') list = list.filter(o => o.status === state.filter);
    const q = state.q.trim().toLowerCase();
    if (q) list = list.filter(o => (o.code + ' ' + o.name + ' ' + o.phone).toLowerCase().includes(q));
    return list;
  }

  function renderStats(d) {
    $('stNew').textContent = d.counts.baru || 0;
    $('stNew').parentNode.classList.toggle('hot', (d.counts.baru || 0) > 0);
    $('stToday').textContent = d.today.orders;
    $('stRev').textContent = rp(d.today.revenue);
    $('stUnpaid').textContent = d.unpaid;
    const tn = $('tabNew'); if (tn) { tn.hidden = !(d.counts.baru > 0); tn.textContent = d.counts.baru || ''; }
    document.title = ((d.counts.baru || 0) ? '(' + d.counts.baru + ') ' : '') + 'Owner · ' + SHOP;
  }

  function renderFilters() {
    const c = state.counts, active = ACTIVE.reduce((n, s) => n + (c[s] || 0), 0), all = Object.keys(c).reduce((n, s) => n + c[s], 0);
    $('filters').innerHTML = FILTERS.map(([id, name]) => {
      const n = id === 'aktif' ? active : id === 'semua' ? all : (c[id] || 0);
      return '<button type="button" class="tab" data-f="' + id + '" aria-pressed="' + (state.filter === id) + '">' + name + '<small>' + n + '</small></button>';
    }).join('');
  }

  function card(o) {
    const open = state.open.has(o.id);
    const items = o.items.map(i => '<li><span>' + i.qty + ' × ' + esc(i.name) + '</span><b>' + rp(i.price * i.qty) + '</b></li>').join('');
    const brief = o.items.map(i => i.qty + '× ' + esc(i.name)).join(', ');
    const where = o.mode === 'delivery' ? 'Delivery' : 'Ambil di tempat';
    const nx = NEXT[o.status];
    const nextLabel = o.status === 'disiapkan' ? (o.mode === 'delivery' ? 'Tandai sedang diantar' : 'Tandai siap diambil') : (nx && nx[1]);
    const final = o.status === 'selesai' || o.status === 'dibatalkan';
    const sel = '<select data-do="status" aria-label="Ubah status ' + esc(o.code) + '">' +
      ['baru', 'dikonfirmasi', 'disiapkan', 'siap', 'selesai', 'dibatalkan'].map(s => '<option value="' + s + '"' + (s === o.status ? ' selected' : '') + '>' + esc(label(s, o.mode)) + '</option>').join('') + '</select>';
    const cancel = final ? '' : (state.confirm === o.id
      ? '<span class="o-muted">Yakin batalkan?</span><button class="o-btn danger" type="button" data-do="cancel-yes">Ya, batalkan</button><button class="o-btn" type="button" data-do="cancel-no">Tidak</button>'
      : '<button class="o-btn danger" type="button" data-do="cancel">Batalkan pesanan</button>');
    return '<article class="o-card' + (state.fresh.has(o.id) ? ' fresh' : '') + '" data-id="' + o.id + '">' +
      '<button type="button" class="o-sum" data-do="toggle" aria-expanded="' + open + '">' +
        '<span class="o-code">' + esc(o.code) + '</span>' +
        '<span><span class="o-badge s-' + esc(o.status) + '">' + esc(label(o.status, o.mode)) + '</span></span>' +
        '<span class="o-name">' + esc(o.name) + '</span>' +
        '<span class="o-total">' + rp(o.total) + '</span>' +
        '<span class="o-ago">' + esc(ago(o.createdAt)) + '</span>' +
        '<span class="o-line2"><span class="o-pay ' + (o.paid ? 'ok' : 'no') + '">' + (o.paid ? 'Lunas' : 'Belum lunas') + '</span> ' + where + ' · ' + esc(shortDate(o.date)) + ', ' + esc(o.slot) + ' · ' + brief + '</span>' +
      '</button>' +
      (open ? '<div class="o-body">' +
        '<div><h3>Pesanan</h3><ul class="o-items">' + items + '</ul>' +
          '<div class="sum"><div><span>Subtotal</span><span>' + rp(o.subtotal) + '</span></div>' +
          (o.mode === 'delivery' ? '<div class="muted"><span>Ongkir' + (o.zone ? ' (' + esc(o.zone) + ')' : '') + '</span><span>' + rp(o.fee) + '</span></div>' : '') +
          '<div class="total"><span>Total</span><span>' + rp(o.total) + '</span></div></div></div>' +
        '<div><h3>Pemesan</h3><dl class="o-dl">' +
          '<div><dt>Nama</dt><dd>' + esc(o.name) + '</dd></div>' +
          '<div><dt>No. HP</dt><dd>' + esc(o.phone) + ' · <a href="' + esc(waLink(o.phone)) + '" target="_blank" rel="noopener">Chat WhatsApp</a></dd></div>' +
          '<div><dt>' + where + '</dt><dd>' + esc(shortDate(o.date)) + ', ' + esc(o.slot) + '</dd></div>' +
          (o.mode === 'delivery' ? '<div><dt>Alamat</dt><dd>' + esc(o.address || '') + '</dd></div>' : '') +
          '<div><dt>Pembayaran</dt><dd>' + esc(o.paymentLabel) + ' · ' + (o.paid ? 'Lunas' : 'Belum lunas') + '</dd></div>' +
          (o.note ? '<div><dt>Catatan</dt><dd>' + esc(o.note) + '</dd></div>' : '') +
          '<div><dt>Masuk</dt><dd>' + new Date(o.createdAt * 1000).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + '</dd></div>' +
        '</dl></div>' +
        '<div class="o-act">' +
          (nextLabel && !final ? '<button class="btn" type="button" data-do="next">' + esc(nextLabel) + '</button>' : '') +
          '<button class="o-btn" type="button" data-do="paid">' + (o.paid ? 'Tandai belum lunas' : 'Tandai lunas') + '</button>' +
          sel + cancel +
        '</div>' +
      '</div>' : '') +
      '</article>';
  }

  function renderList() {
    const list = visible();
    $('olist').innerHTML = list.length ? list.map(card).join('') :
      '<div class="o-empty">' + (state.orders.length ? 'Tidak ada pesanan yang cocok dengan filter ini.' : 'Belum ada pesanan masuk. Halaman ini diperbarui otomatis.') + '</div>';
    $('foot').textContent = state.orders.length >= 300 ? 'Menampilkan 300 pesanan terbaru.' : '';
  }
  const renderAll = () => { renderFilters(); renderList(); };

  /* ---------- memuat data ---------- */
  async function load() {
    if (state.busy) return;
    state.busy = true;
    try {
      const r = await api('list');
      if (r.status === 401) { showLogin(); return; }
      if (!r.ok || !r.data) throw new Error('bad');
      const d = r.data;
      state.offset = d.now - Date.now() / 1000;
      const maxId = d.orders.reduce((m, o) => Math.max(m, o.id), 0);
      if (!state.first && maxId > state.maxId) {
        const added = d.orders.filter(o => o.id > state.maxId);
        added.forEach(o => state.fresh.add(o.id));
        setTimeout(() => { added.forEach(o => state.fresh.delete(o.id)); renderList(); }, 60000);
        toast(added.length === 1 ? 'Pesanan baru masuk: ' + added[0].code : added.length + ' pesanan baru masuk');
        beep();
      }
      state.maxId = Math.max(state.maxId, maxId);
      state.first = false;
      state.orders = d.orders; state.counts = d.counts;
      renderStats(d); renderAll();
      $('net').hidden = true;
    } catch (e) {
      $('net').hidden = false;
    } finally {
      state.busy = false;
    }
  }

  async function update(id, patch) {
    const r = await api('update', { method: 'POST', body: Object.assign({ id }, patch) });
    if (r.status === 401) { showLogin(); return; }
    if (!r.ok) { toast((r.data && r.data.error) || 'Perubahan belum tersimpan. Coba lagi.'); return; }
    const i = state.orders.findIndex(o => o.id === id);
    if (i >= 0) state.orders[i] = r.data;
    state.confirm = null;
    renderList();
    load();
  }

  /* ---------- masuk / keluar ---------- */
  function showLogin() {
    clearInterval(state.timer);
    $('logoutBtn').hidden = true; $('soundBtn').hidden = true;
    show('login');
    $('pw').value = ''; $('pw').focus();
  }
  function showDash() {
    show('dash');
    $('logoutBtn').hidden = false; $('soundBtn').hidden = false;
    paintSound();
    if (window.SBO && window.SBO.onDash) window.SBO.onDash();
    clearInterval(state.timer);
    state.first = true;
    load();
    state.timer = setInterval(load, 15000);
  }
  function problem(title, text) {
    show('loading');
    $('loading').innerHTML = '<h1>' + esc(title) + '</h1><p class="o-muted">' + text + '</p>';
  }
  async function start() {
    let r;
    try {
      r = await api('me');
    } catch (e) {
      problem('Server tidak bisa dihubungi', 'Pastikan Laragon (Start All) atau server PHP sedang berjalan, lalu buka halaman ini lewat <b>http://localhost/…</b> dan muat ulang.');
      return;
    }
    if (!r.data) {
      problem('PHP belum berjalan', 'Server membalas, tapi bukan dari PHP. Kamu mungkin membuka lewat Live Server atau klik dua kali file. Buka lewat <b>http://localhost/…</b> (Laragon) atau jalankan <b>php -S localhost:8000</b> di folder proyek.');
      return;
    }
    if (!r.ok || r.data.error) {
      problem('Server melaporkan masalah', esc(r.data.error || 'Kode ' + r.status) + ' Kalau pesannya soal database, pastikan ekstensi <b>pdo_sqlite</b> aktif di PHP dan folder <b>storage</b> bisa ditulis.');
      return;
    }
    SHOP = r.data.shop; $('shopName').innerHTML = brandHtml(SHOP);
    if (!r.data.configured) { show('setup'); return; }
    if (!r.data.loggedIn) { showLogin(); return; }
    showDash();
  }

  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('loginBtn'), err = $('loginErr');
    err.hidden = true; btn.disabled = true; btn.textContent = 'Masuk…';
    try {
      const r = await api('login', { method: 'POST', body: { password: $('pw').value } });
      if (r.ok) { showDash(); return; }
      err.textContent = (r.data && r.data.error) || 'Belum bisa masuk. Coba lagi.'; err.hidden = false;
    } catch (x) {
      err.textContent = 'Tidak bisa terhubung ke server.'; err.hidden = false;
    } finally { btn.disabled = false; btn.textContent = 'Masuk'; }
  });
  $('logoutBtn').addEventListener('click', async () => {
    try { await api('logout', { method: 'POST', body: {} }); } catch (e) {}
    state.orders = []; state.open.clear();
    showLogin();
  });
  $('soundBtn').addEventListener('click', () => {
    state.sound = !state.sound;
    try { localStorage.setItem('sweetbite-owner-sound', state.sound ? '1' : '0'); } catch (e) {}
    paintSound();
    if (state.sound) beep();
  });

  /* ---------- interaksi daftar ---------- */
  $('filters').addEventListener('click', e => {
    const b = e.target.closest('[data-f]');
    if (!b) return;
    state.filter = b.dataset.f; renderAll();
  });
  $('q').addEventListener('input', e => { state.q = e.target.value; renderList(); });
  $('olist').addEventListener('click', e => {
    const card = e.target.closest('.o-card');
    const btn = e.target.closest('[data-do]');
    if (!card || !btn) return;
    const id = Number(card.dataset.id), o = state.orders.find(x => x.id === id);
    if (!o) return;
    const act = btn.dataset.do;
    if (act === 'toggle') {
      if (state.open.has(id)) state.open.delete(id); else { state.open.add(id); state.fresh.delete(id); }
      state.confirm = null; renderList();
    } else if (act === 'next') {
      update(id, { status: NEXT[o.status][0] });
    } else if (act === 'paid') {
      update(id, { paid: !o.paid });
    } else if (act === 'cancel') {
      state.confirm = id; renderList();
    } else if (act === 'cancel-no') {
      state.confirm = null; renderList();
    } else if (act === 'cancel-yes') {
      update(id, { status: 'dibatalkan' });
    }
  });
  $('olist').addEventListener('change', e => {
    const sel = e.target.closest('select[data-do="status"]');
    if (!sel) return;
    update(Number(sel.closest('.o-card').dataset.id), { status: sel.value });
  });

  // dipakai manage.js (produk, stok, pengaturan toko)
  window.SBO = { $, esc, rp, toast, api, onLoggedOut: showLogin, onDash: null };
  start();
})();
