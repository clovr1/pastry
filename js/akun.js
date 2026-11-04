/* Halaman pembeli: masuk / daftar (masuk.html) dan akun + riwayat pesanan (akun.html). */
(function () {
  const root = document.getElementById('acc');
  const LABEL = { baru: 'Diterima', dikonfirmasi: 'Dikonfirmasi', disiapkan: 'Disiapkan', siap: 'Siap', selesai: 'Selesai', dibatalkan: 'Dibatalkan' };

  // Setelah masuk, kembali ke halaman asal kalau alamatnya salah satu halaman kita sendiri.
  function nextUrl() {
    const n = new URLSearchParams(location.search).get('next') || '';
    return ['checkout.html', 'keranjang.html', 'akun.html', 'products.html', 'index.html'].indexOf(n) >= 0 ? n : 'akun.html';
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
        '<div class="auth-head"><h1>Akun ' + esc(CONFIG.shop) + '</h1><p>Simpan data dan lihat riwayat pesananmu. Tanpa akun pun kamu tetap bisa memesan.</p></div>' +
        '<div class="seg auth-tabs" role="tablist">' +
          '<button type="button" role="tab" id="tabIn" aria-selected="true">Masuk</button>' +
          '<button type="button" role="tab" id="tabUp" aria-selected="false">Daftar</button></div>' +
        '<form id="fIn" class="auth-form" novalidate>' +
          field('inEmail', 'Email', 'email', ' autocomplete="email" inputmode="email" required') +
          field('inPw', 'Kata sandi', 'password', ' autocomplete="current-password" required') +
          '<p class="err" id="inErr" role="alert" hidden></p>' +
          '<button class="btn block" type="submit" id="inBtn">Masuk</button>' +
          '<p class="auth-alt">Belum punya akun? <a href="#daftar" id="goUp">Daftar</a></p>' +
        '</form>' +
        '<form id="fUp" class="auth-form" novalidate hidden>' +
          field('upName', 'Nama lengkap', 'text', ' autocomplete="name" required') +
          field('upEmail', 'Email', 'email', ' autocomplete="email" inputmode="email" required') +
          field('upPhone', 'No. HP (WhatsApp)', 'tel', ' autocomplete="tel" inputmode="tel" placeholder="0812…" required') +
          field('upPw', 'Kata sandi', 'password', ' autocomplete="new-password" minlength="8" required') +
          '<p class="auth-hint">Minimal 8 karakter.</p>' +
          '<p class="err" id="upErr" role="alert" hidden></p>' +
          '<button class="btn block" type="submit" id="upBtn">Buat akun</button>' +
          '<p class="auth-alt">Sudah punya akun? <a href="#masuk" id="goIn">Masuk</a></p>' +
        '</form>' +
      '</div>';

    const $q = id => document.getElementById(id);
    function tab(which) {
      const up = which === 'up';
      $q('fIn').hidden = up; $q('fUp').hidden = !up;
      $q('tabIn').setAttribute('aria-selected', String(!up)); $q('tabUp').setAttribute('aria-selected', String(up));
      document.title = (up ? 'Daftar · ' : 'Masuk · ') + CONFIG.shop;
      try { history.replaceState(null, '', location.pathname + location.search + (up ? '#daftar' : '')); } catch (e) {}
      $q(up ? 'upName' : 'inEmail').focus();
    }
    $q('tabIn').addEventListener('click', () => tab('in'));
    $q('tabUp').addEventListener('click', () => tab('up'));
    $q('goUp').addEventListener('click', e => { e.preventDefault(); tab('up'); });
    $q('goIn').addEventListener('click', e => { e.preventDefault(); tab('in'); });

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
    return '<a class="acc-order" href="pesanan.html?id=' + encodeURIComponent(o.publicId) + '">' +
      '<span class="acc-o-top"><b>' + esc(o.code) + '</b><span class="ord-chip' + (o.status === 'dibatalkan' ? ' warn' : '') + '">' + esc(LABEL[o.status] || o.status) + '</span></span>' +
      '<span class="acc-o-mid">' + n + ' produk · ' + (o.mode === 'delivery' ? 'Delivery' : 'Ambil di tempat') + ' · ' + esc(fmtDate(o.date)) + ', ' + esc(o.slot) + '</span>' +
      '<span class="acc-o-bot"><b>' + rp(o.total) + '</b><span>' + (o.paid ? 'Lunas' : 'Belum dibayar') + ' ›</span></span></a>';
  }

  async function showAccount(user) {
    document.title = 'Akun saya · ' + CONFIG.shop;
    root.innerHTML =
      '<div class="acc-wrap">' +
        '<div class="co-head"><h1>Halo, <span id="aName"></span></h1><p id="aMail"></p></div>' +
        '<div class="acc-cols">' +
          '<section class="acc-card" aria-labelledby="hOrd"><h2 id="hOrd">Riwayat pesanan</h2><div id="aOrders"><p class="ord-load">Memuat…</p></div></section>' +
          '<section class="acc-card" aria-labelledby="hProf"><h2 id="hProf">Data diri</h2>' +
            '<form id="fProf" class="auth-form" novalidate>' +
              field('pName', 'Nama lengkap', 'text', ' autocomplete="name"') +
              field('pPhone', 'No. HP (WhatsApp)', 'tel', ' autocomplete="tel" inputmode="tel"') +
              '<details class="acc-pw"><summary>Ganti kata sandi</summary>' +
                field('pOld', 'Kata sandi lama', 'password', ' autocomplete="current-password"') +
                field('pNew', 'Kata sandi baru', 'password', ' autocomplete="new-password"') +
              '</details>' +
              '<p class="err" id="pErr" role="alert" hidden></p><p class="acc-ok" id="pOk" role="status" hidden></p>' +
              '<button class="btn block" type="submit" id="pBtn">Simpan</button>' +
            '</form>' +
            '<button class="btn ghost block" type="button" id="outBtn">Keluar</button>' +
          '</section>' +
        '</div>' +
      '</div>';
    const $q = id => document.getElementById(id);
    function fill(u) { $q('aName').textContent = u.name.split(' ')[0]; $q('aMail').textContent = u.email; $q('pName').value = u.name; $q('pPhone').value = u.phone; }
    fill(user);

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
      $q('pOk').textContent = 'Tersimpan.'; $q('pOk').hidden = false;
    });

    $q('outBtn').addEventListener('click', async () => {
      busy($q('outBtn'), true);
      await api('logout', {});
      rememberUser(null);
      location.href = 'index.html';
    });

    const r = await api('orders');
    const box = $q('aOrders');
    if (!r.ok) { box.innerHTML = '<p class="ord-muted">' + esc(r.data.error || 'Riwayat belum bisa dimuat.') + '</p>'; return; }
    box.innerHTML = r.data.orders.length ? '<div class="acc-orders">' + r.data.orders.map(orderRow).join('') + '</div>' :
      '<div class="acc-empty"><p>Belum ada pesanan di akun ini.</p><a class="btn" href="products.html">Lihat produk</a></div>';
  }

  authReady.then(user => {
    if (PAGE === 'akun') {
      if (user) showAccount(user); else location.replace('masuk.html?next=akun.html');
    } else {
      if (user) location.replace(nextUrl());
      else showAuth(location.hash === '#daftar' ? 'up' : 'in');
    }
  });
})();
