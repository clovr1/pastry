/* Halaman pembeli: masuk / daftar (masuk.html) dan akun + riwayat pesanan (akun.html). */
(function () {
  const root = document.getElementById('acc');
  const LABEL = { baru: 'Diterima', dikonfirmasi: 'Dikonfirmasi', disiapkan: 'Disiapkan', siap: 'Siap', selesai: 'Selesai', dibatalkan: 'Dibatalkan' };

  // Setelah masuk, kembali ke halaman asal kalau alamatnya salah satu halaman kita sendiri.
  function nextUrl() {
    const n = new URLSearchParams(location.search).get('next') || '';
    return ['checkout.html', 'keranjang.html', 'akun.html', 'profil.html', 'products.html', 'index.html'].indexOf(n) >= 0 ? n : 'akun.html';
  }

  async function api(action, body) {
    const opt = body === undefined ? { cache: 'no-store' } :
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'sb' }, body: JSON.stringify(body) };
    try {
      const r = await fetch('api/user.php?action=' + action, opt);
      const data = await r.json().catch(() => null);
      return { ok: r.ok, status: r.status, data: data || {} };
    } catch (e) {
      return { ok: false, status: 0, data: { error: 'Tidak bisa terhubung ke server. Periksa koneksi lalu coba lagi.' } };
    }
  }

  function field(id, label, type, extra) {
    return '<div class="field"><label for="' + id + '">' + label + '</label><input id="' + id + '" type="' + type + '"' + (extra || '') + '></div>';
  }
  function setErr(el, msg) { el.textContent = msg || ''; el.hidden = !msg; }
  function busy(btn, on, text) { btn.disabled = on; if (text) btn.textContent = text; }

  /* ---------- Masuk / Daftar ---------- */
  function showAuth(startTab) {
    document.title = 'Masuk · ' + CONFIG.shop;
    root.innerHTML =
      '<div class="auth">' +
        '<div class="auth-head"><h1 id="aTitle"></h1><p id="aSub"></p></div>' +
        '<form id="fIn" class="auth-form" novalidate>' +
          field('inEmail', 'Email', 'email', ' autocomplete="email" inputmode="email" required') +
          field('inPw', 'Kata sandi', 'password', ' autocomplete="current-password" required') +
          '<p class="err" id="inErr" role="alert" hidden></p>' +
          '<button class="btn block" type="submit" id="inBtn">Masuk</button>' +
        '</form>' +
        '<form id="fUp" class="auth-form" novalidate hidden>' +
          field('upName', 'Nama lengkap', 'text', ' autocomplete="name" required') +
          field('upEmail', 'Email', 'email', ' autocomplete="email" inputmode="email" required') +
          field('upPhone', 'No. HP (WhatsApp)', 'tel', ' autocomplete="tel" inputmode="tel" placeholder="0812…" required') +
          field('upPw', 'Kata sandi', 'password', ' autocomplete="new-password" minlength="8" required') +
          '<p class="auth-hint">Minimal 8 karakter.</p>' +
          '<p class="err" id="upErr" role="alert" hidden></p>' +
          '<button class="btn block" type="submit" id="upBtn">Buat akun</button>' +
        '</form>' +
        '<div class="auth-switch"><span id="swText"></span><button class="btn ghost block" type="button" id="swBtn"></button></div>' +
      '</div>';

    const $q = id => document.getElementById(id);
    let cur = 'in';
    function tab(which) {
      cur = which;
      const up = which === 'up';
      $q('fIn').hidden = up; $q('fUp').hidden = !up;
      $q('aTitle').textContent = up ? 'Buat akun baru' : 'Selamat datang kembali';
      $q('aSub').textContent = up ? 'Daftar untuk menyimpan data dan melihat riwayat pesananmu.' : 'Masuk untuk melihat riwayat pesananmu dan memesan lebih cepat.';
      $q('swText').textContent = up ? 'Sudah punya akun?' : 'Belum punya akun?';
      $q('swBtn').textContent = up ? 'Masuk' : 'Buat akun baru';
      document.title = (up ? 'Daftar · ' : 'Masuk · ') + CONFIG.shop;
      try { history.replaceState(null, '', location.pathname + location.search + (up ? '#daftar' : '')); } catch (e) {}
      $q(up ? 'upName' : 'inEmail').focus();
    }
    $q('swBtn').addEventListener('click', () => tab(cur === 'in' ? 'up' : 'in'));

    $q('fIn').addEventListener('submit', async e => {
      e.preventDefault();
      const email = $q('inEmail').value.trim(), pw = $q('inPw').value;
      if (!email || !pw) { setErr($q('inErr'), 'Isi email dan kata sandi.'); return; }
      setErr($q('inErr'), ''); busy($q('inBtn'), true, 'Memeriksa…');
      const r = await api('login', { email, password: pw });
      if (!r.ok) { setErr($q('inErr'), r.data.error || 'Gagal masuk.'); busy($q('inBtn'), false, 'Masuk'); return; }
      rememberUser(r.data.user);
      location.href = nextUrl();
    });

    $q('fUp').addEventListener('submit', async e => {
      e.preventDefault();
      const b = { name: $q('upName').value.trim(), email: $q('upEmail').value.trim(), phone: $q('upPhone').value.trim(), password: $q('upPw').value };
      if (b.name.length < 2) return setErr($q('upErr'), 'Isi nama kamu.');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email)) return setErr($q('upErr'), 'Isi alamat email yang benar.');
      if (b.phone.replace(/\D/g, '').length < 9) return setErr($q('upErr'), 'Isi nomor HP (WhatsApp) yang benar.');
      if (b.password.length < 8) return setErr($q('upErr'), 'Kata sandi minimal 8 karakter.');
      setErr($q('upErr'), ''); busy($q('upBtn'), true, 'Membuat akun…');
      const r = await api('register', b);
      if (!r.ok) { setErr($q('upErr'), r.data.error || 'Pendaftaran gagal.'); busy($q('upBtn'), false, 'Buat akun'); return; }
      rememberUser(r.data.user);
      location.href = nextUrl();
    });

    tab(startTab);
  }

  /* ---------- Akun ---------- */
  const fmtDate = s => {
    const d = new Date(s + 'T00:00:00');
    return DAYS[d.getDay()] + ', ' + d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' });
  };

  function orderRow(o) {
    const n = o.items.reduce((t, i) => t + i.qty, 0);
    const thumbs = o.items.slice(0, 4).map(i => {
      const it = byId(i.id);
      return '<span class="acc-th ph">' + photo(it && it.img, i.name, '') + '</span>';
    }).join('') + (o.items.length > 4 ? '<span class="acc-th more">+' + (o.items.length - 4) + '</span>' : '');
    return '<a class="acc-order" href="pesanan.html?id=' + encodeURIComponent(o.publicId) + '">' +
      '<span class="acc-o-top"><b>' + esc(o.code) + '</b><span class="ord-chip' + (o.status === 'dibatalkan' ? ' warn' : '') + '">' + esc(LABEL[o.status] || o.status) + '</span></span>' +
      '<span class="acc-thumbs">' + thumbs + '</span>' +
      '<span class="acc-o-mid">' + o.items.map(i => i.qty + '× ' + esc(i.name)).join(', ') + '</span>' +
      '<span class="acc-o-mid">' + (o.mode === 'delivery' ? 'Delivery' : 'Ambil di tempat') + ' · ' + esc(fmtDate(o.date)) + ', ' + esc(o.slot) + '</span>' +
      '<span class="acc-o-bot"><b>' + rp(o.total) + '</b><span>' + (o.paid ? 'Lunas' : 'Belum dibayar') + ' ›</span></span></a>';
  }

  // katalog: produk yang pernah dipesan (dari semua pesanan), dengan tombol pesan lagi
  function boughtCatalog(list) {
    const seen = {};
    list.forEach(o => { if (o.status === 'dibatalkan') return; o.items.forEach(i => { seen[i.id] = (seen[i.id] || 0) + i.qty; }); });
    const items = Object.keys(seen).map(byId).filter(Boolean).sort((a, b) => seen[b.id] - seen[a.id]);
    if (!items.length) return '';
    return '<section aria-labelledby="hBuy"><h2 class="acc-h" id="hBuy">Yang pernah kamu pesan</h2><div class="acc-vlist">' +
      items.map(it => '<div class="acc-vrow' + (it.soldOut ? ' out' : '') + '">' +
        '<a class="acc-vimg ph" href="product.html?id=' + encodeURIComponent(it.id) + '" aria-label="' + esc(it.name) + '">' + photo(it.img, it.name, '') + '</a>' +
        '<div class="acc-vinfo"><a href="product.html?id=' + encodeURIComponent(it.id) + '">' + esc(it.name) + '</a><span>' + rp(it.price) + '</span><small>Dipesan ' + seen[it.id] + '×' + (it.soldOut ? ' · Habis hari ini' : '') + '</small></div>' +
        '<button type="button" class="btn ghost" data-again="' + esc(it.id) + '"' + (it.soldOut ? ' disabled' : '') + '>Pesan lagi</button></div>').join('') +
      '</div></section>';
  }

  /* Halaman akun: hanya pesanan. Data diri ada di halaman sendiri (profil.html). */
  async function showAccount(user) {
    document.title = 'Akun saya · ' + CONFIG.shop;
    root.innerHTML =
      '<div class="acc-wrap">' +
        '<header class="acc-hero">' +
          '<span class="acc-av" id="aAv" aria-hidden="true"></span>' +
          '<div class="acc-who"><span class="label">Akun saya</span><h1>Halo, <span id="aName"></span></h1><p id="aMail"></p></div>' +
          '<div class="acc-btns"><a class="btn ghost" href="profil.html">Data diri</a><button class="btn ghost" type="button" id="outBtn">Keluar</button></div>' +
        '</header>' +
        '<div class="acc-cols two" id="aCols"><div id="aBought"></div>' +
        '<section aria-labelledby="hOrd"><h2 class="acc-h" id="hOrd">Riwayat pesanan</h2><div id="aOrders"><p class="ord-load">Memuat…</p></div></section></div>' +
      '</div>';
    const $q = id => document.getElementById(id);
    $q('aName').textContent = user.name.split(' ')[0];
    $q('aAv').textContent = user.name.trim().charAt(0).toUpperCase();
    $q('aMail').textContent = user.email;

    $q('outBtn').addEventListener('click', async () => {
      busy($q('outBtn'), true);
      await api('logout', {});
      rememberUser(null);
      location.href = 'index.html';
    });

    const r = await api('orders');
    const box = $q('aOrders');
    if (!r.ok) { box.innerHTML = '<p class="ord-muted">' + esc(r.data.error || 'Riwayat belum bisa dimuat.') + '</p>'; return; }
    const list = r.data.orders;
    if (!list.length) {
      box.innerHTML = '<div class="acc-empty"><b>Belum ada pesanan</b><p>Pesanan yang kamu buat saat masuk akan muncul di sini, lengkap dengan statusnya.</p><a class="btn" href="products.html">Lihat produk</a></div>';
      return;
    }
    $q('aBought').innerHTML = boughtCatalog(list);
    if (!$q('aBought').innerHTML) $q('aCols').classList.remove('two');
    $q('aBought').addEventListener('click', e => {
      const b = e.target.closest('[data-again]');
      if (!b) return;
      change(b.dataset.again, 1);
      b.textContent = 'Ditambahkan ✓';
      setTimeout(() => { b.textContent = 'Pesan lagi'; }, 1600);
    });
    box.innerHTML = '<div class="acc-orders">' + list.map(orderRow).join('') + '</div>';
  }

  /* Halaman data diri: tampilan data dan tombol untuk mengubahnya. */
  function showProfile(user) {
    document.title = 'Data diri · ' + CONFIG.shop;
    root.innerHTML =
      '<div class="acc-wrap prof">' +
        '<nav class="steps" aria-label="Navigasi"><a href="akun.html">Akun saya</a><span aria-hidden="true">›</span><b aria-current="page">Data diri</b></nav>' +
        '<div class="co-head"><h1>Data diri</h1><p>Data ini terisi otomatis saat kamu memesan.</p></div>' +
        '<div class="acc-side">' +
          '<dl class="acc-dl" id="aInfo"></dl>' +
          '<p class="acc-ok" id="pOk" role="status" hidden></p>' +
          '<button class="btn ghost block" type="button" id="editBtn" aria-expanded="false">Ubah data diri</button>' +
          '<form id="fProf" class="auth-form" novalidate hidden>' +
            field('pName', 'Nama lengkap', 'text', ' autocomplete="name"') +
            field('pPhone', 'No. HP (WhatsApp)', 'tel', ' autocomplete="tel" inputmode="tel"') +
            '<details class="acc-pw"><summary>Ganti kata sandi</summary>' +
              field('pOld', 'Kata sandi lama', 'password', ' autocomplete="current-password"') +
              field('pNew', 'Kata sandi baru', 'password', ' autocomplete="new-password"') +
            '</details>' +
            '<p class="err" id="pErr" role="alert" hidden></p>' +
            '<button class="btn block" type="submit" id="pBtn">Simpan</button>' +
          '</form>' +
        '</div>' +
      '</div>';
    const $q = id => document.getElementById(id);
    function fill(u) {
      $q('pName').value = u.name; $q('pPhone').value = u.phone;
      $q('aInfo').innerHTML = '<div><dt>Nama</dt><dd>' + esc(u.name) + '</dd></div><div><dt>Email</dt><dd>' + esc(u.email) + '</dd></div><div><dt>No. HP</dt><dd>' + esc(u.phone) + '</dd></div>';
    }
    fill(user);

    $q('editBtn').addEventListener('click', () => {
      const open = $q('fProf').hidden;
      $q('fProf').hidden = !open; $q('editBtn').setAttribute('aria-expanded', String(open));
      $q('editBtn').textContent = open ? 'Batal' : 'Ubah data diri';
      $q('pOk').hidden = true;
      if (open) $q('pName').focus();
    });

    $q('fProf').addEventListener('submit', async e => {
      e.preventDefault();
      setErr($q('pErr'), ''); $q('pOk').hidden = true;
      const b = { name: $q('pName').value.trim(), phone: $q('pPhone').value.trim() };
      if ($q('pNew').value) { b.newPassword = $q('pNew').value; b.password = $q('pOld').value; }
      busy($q('pBtn'), true, 'Menyimpan…');
      const r = await api('update', b);
      busy($q('pBtn'), false, 'Simpan');
      if (!r.ok) { setErr($q('pErr'), r.data.error || 'Belum tersimpan.'); return; }
      fill(r.data.user); $q('pOld').value = ''; $q('pNew').value = '';
      $q('fProf').hidden = true; $q('editBtn').textContent = 'Ubah data diri'; $q('editBtn').setAttribute('aria-expanded', 'false');
      $q('pOk').textContent = 'Perubahan tersimpan.'; $q('pOk').hidden = false;
    });
  }

  authReady.then(user => {
    if (PAGE === 'akun' || PAGE === 'profil') {
      if (!user) location.replace('masuk.html?next=' + (PAGE === 'profil' ? 'profil.html' : 'akun.html'));
      else if (PAGE === 'profil') showProfile(user); else showAccount(user);
    } else {
      if (user) location.replace(nextUrl());
      else showAuth(location.hash === '#daftar' ? 'up' : 'in');
    }
  });
})();
