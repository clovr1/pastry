/* Dashboard owner: kelola produk, stok, kategori, status buka/tutup, dan pengaturan toko.
   Bekerja bersama owner.js (window.SBO) dan api/owner.php. */
(function () {
  const S = window.SBO;
  if (!S) return;
  const { $, esc, rp, toast } = S;
  const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const st = { data: null, tab: 'orders', edit: null, q: '', cat: 'all', loaded: false, upload: false };

  /* ---------- API ---------- */
  async function call(action, body) {
    const init = { method: body === undefined ? 'GET' : 'POST', headers: { 'X-Requested-With': 'sb' }, cache: 'no-store', credentials: 'same-origin' };
    if (body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
    let r, data = null;
    try { r = await fetch('../api/owner.php?action=' + action, init); data = await r.json(); } catch (e) { /* jaringan atau bukan JSON */ }
    if (r && r.status === 401) { S.onLoggedOut(); return null; }
    if (!r || !r.ok || !data) { toast((data && data.error) || 'Belum berhasil. Periksa koneksi lalu coba lagi.'); return null; }
    return data;
  }
  function take(d) { if (d) { st.data = d; st.loaded = true; paintStore(); } return d; }

  /* ---------- tab ---------- */
  function setTab(t) {
    st.tab = t;
    document.querySelectorAll('#mainTabs [data-tab]').forEach(b => { if (b.dataset.tab === t) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    $('tabOrders').hidden = t !== 'orders'; $('tabProducts').hidden = t !== 'products'; $('tabSettings').hidden = t !== 'settings';
    if (t !== 'orders' && !st.loaded) { load().then(() => render()); } else render();
  }
  async function load() { take(await call('catalog')); }
  function render() {
    if (st.tab === 'products') renderProducts();
    if (st.tab === 'settings') renderSettings();
  }
  S.onDash = async function () { await load(); setTab(st.tab); };
  $('mainTabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });

  /* ---------- status toko (bilah di atas) ---------- */
  function paintStore() {
    const s = st.data && st.data.settings, bar = $('storeBar');
    if (!s) { bar.hidden = true; return; }
    bar.hidden = false;
    bar.className = 'o-store' + (s.acceptOrders ? '' : ' off');
    const keepNote = $('closedNote') ? $('closedNote').value : s.closedNote;
    bar.innerHTML =
      '<div class="o-store-main"><span class="o-dot" aria-hidden="true"></span>' +
        '<span class="o-store-t"><b>' + (s.acceptOrders ? 'Toko buka' : 'Toko tutup') + '</b> <span class="o-muted">' + (s.acceptOrders ? 'Pembeli bisa memesan.' : 'Pembeli tidak bisa memesan.') + '</span></span>' +
        '<div class="o-onoff" role="group" aria-label="Status toko">' +
          '<button type="button" data-open="1" aria-pressed="' + s.acceptOrders + '">Buka</button>' +
          '<button type="button" data-open="0" aria-pressed="' + !s.acceptOrders + '">Tutup</button></div></div>' +
      (s.acceptOrders ? '' : '<div class="o-store-note"><input id="closedNote" maxlength="200" value="' + esc(keepNote) + '" placeholder="Pesan untuk pembeli (opsional), mis. Libur sampai Senin" aria-label="Pesan untuk pembeli">' +
        '<button type="button" class="o-btn" id="noteSave">Simpan pesan</button></div>');
  }
  $('storeBar').addEventListener('click', async e => {
    const t = e.target.closest('[data-open]'), n = e.target.closest('#noteSave');
    if (!t && !n) return;
    if (t) {
      const next = t.dataset.open === '1';
      if (next === st.data.settings.acceptOrders) return;
      const d = take(await call('settings_save', { acceptOrders: next }));
      if (d) toast(next ? 'Toko buka. Pembeli bisa memesan.' : 'Toko tutup. Pembeli tidak bisa memesan.');
    } else {
      const d = take(await call('settings_save', { closedNote: $('closedNote').value }));
      if (d) toast('Pesan tersimpan.');
    }
  });

  /* ---------- produk ---------- */
  const catName = id => ((st.data.cats.find(c => c.id === id)) || { name: '-' }).name;
  const thumb = it => it.img ? '<img src="../' + esc(it.img) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">' : '<span class="o-noimg">Foto</span>';

  function renderProducts() {
    const d = st.data;
    if (!d) { $('tabProducts').innerHTML = '<p class="o-muted">Memuat…</p>'; return; }
    if (st.edit) { renderForm(); return; }
    const q = st.q.trim().toLowerCase();
    let list = d.items.filter(i => (st.cat === 'all' || i.cat === st.cat) && (!q || i.name.toLowerCase().includes(q)));
    const tabs = [{ id: 'all', name: 'Semua' }].concat(d.cats).map(c => '<button type="button" class="tab" data-cat="' + esc(c.id) + '" aria-pressed="' + (st.cat === c.id) + '">' + esc(c.name) + '</button>').join('');
    const rows = list.map(i => {
      const out = i.soldOut || (i.stock !== null && i.stock <= 0);
      return '<div class="o-prod' + (out ? ' out' : '') + '" data-id="' + esc(i.id) + '">' +
        '<div class="o-pimg">' + thumb(i) + '</div>' +
        '<div class="o-pinfo"><b>' + esc(i.name) + '</b><span class="o-muted">' + esc(catName(i.cat)) + ' · ' + rp(i.price) + (i.tag ? ' · ' + esc(i.tag) : '') + '</span>' +
          (out ? '<span class="o-pill no">Habis</span>' : (i.stock !== null && i.stock <= 5 ? '<span class="o-pill warn">Stok menipis</span>' : '')) + '</div>' +
        '<label class="o-stock"><span>Stok</span><input type="number" min="0" max="99999" inputmode="numeric" data-stock value="' + (i.stock === null ? '' : i.stock) + '" placeholder="∞" aria-label="Stok ' + esc(i.name) + '"></label>' +
        '<button type="button" class="o-btn" data-act="out">' + (out ? 'Ada lagi' : 'Tandai habis') + '</button>' +
        '<button type="button" class="o-btn" data-act="edit">Ubah</button>' +
      '</div>';
    }).join('');
    $('tabProducts').innerHTML =
      '<div class="o-bar"><button type="button" class="btn" data-act="new">＋ Tambah produk</button>' +
        '<div class="field o-search"><label class="o-sr" for="pq">Cari produk</label><input id="pq" type="search" placeholder="Cari produk" value="' + esc(st.q) + '"></div></div>' +
      '<div class="tabs o-cats">' + tabs + '</div>' +
      '<p class="o-hint">Stok kosong (∞) = tidak dibatasi. Kalau diisi angka, stok berkurang otomatis setiap ada pesanan dan produk menjadi "Habis" saat 0.</p>' +
      '<div class="o-plist">' + (rows || '<div class="o-empty">Belum ada produk yang cocok.</div>') + '</div>' +
      renderCats();
  }

  function renderCats() {
    const d = st.data;
    return '<section class="o-sec"><h2>Kategori</h2><div class="o-catlist">' + d.cats.map(c => {
      const n = d.items.filter(i => i.cat === c.id).length;
      return '<div class="o-catrow" data-cid="' + esc(c.id) + '"><input value="' + esc(c.name) + '" aria-label="Nama kategori" maxlength="40"><span class="o-muted">' + n + ' produk</span>' +
        '<button type="button" class="o-btn" data-act="cat-save">Simpan</button>' +
        '<button type="button" class="o-btn danger" data-act="cat-del"' + (n ? ' disabled title="Masih dipakai produk"' : '') + '>Hapus</button></div>';
    }).join('') + '<div class="o-catrow new"><input id="newCat" placeholder="Nama kategori baru" maxlength="40" aria-label="Nama kategori baru"><span></span><button type="button" class="o-btn" data-act="cat-add">Tambah</button></div></div></section>';
  }

  $('tabProducts').addEventListener('input', e => { if (e.target.id === 'pq') { st.q = e.target.value; const pos = e.target.selectionStart; renderProducts(); const i = $('pq'); i.focus(); i.setSelectionRange(pos, pos); } });
  $('tabProducts').addEventListener('change', async e => {
    const inp = e.target.closest('[data-stock]');
    if (!inp) return;
    const id = inp.closest('.o-prod').dataset.id;
    const v = inp.value.trim();
    const d = take(await call('item_stock', { id, stock: v === '' ? null : Number(v) }));
    if (d) { toast(v === '' ? 'Stok tidak dibatasi.' : 'Stok disimpan: ' + v); renderProducts(); }
  });
  $('tabProducts').addEventListener('click', async e => {
    const b = e.target.closest('[data-act], [data-cat]');
    if (!b) return;
    if (b.dataset.cat) { st.cat = b.dataset.cat; renderProducts(); return; }
    const act = b.dataset.act, row = b.closest('.o-prod');
    if (act === 'new') { st.edit = { isNew: true, item: { name: '', cat: (st.cat !== 'all' ? st.cat : st.data.cats[0] && st.data.cats[0].id) || '', price: '', desc: '', tag: '', allergens: [], includes: [], img: '', stock: null, soldOut: false }, home: [], feature: { on: false, layout: 'auto', label: 'Baru launching', headline: '', text: '' } }; renderProducts(); window.scrollTo(0, 0); return; }
    if (act === 'edit') {
      const it = st.data.items.find(i => i.id === row.dataset.id);
      const fr = (st.data.featured || []).find(f => f.id === it.id);
      st.edit = { isNew: false, item: JSON.parse(JSON.stringify(it)), home: st.data.home.filter(h => h.items.includes(it.id)).map(h => h.id), feature: fr ? { on: true, layout: fr.layout || 'auto', label: fr.label || '', headline: fr.headline || '', text: fr.text || '' } : { on: false, layout: 'auto', label: 'Baru launching', headline: '', text: '' } };
      renderProducts(); window.scrollTo(0, 0); return;
    }
    if (act === 'out') {
      const it = st.data.items.find(i => i.id === row.dataset.id);
      const out = it.soldOut || (it.stock !== null && it.stock <= 0);
      // "Ada lagi" pada produk yang stoknya 0 butuh stok baru, jadi isi 10 sebagai awal
      const body = out ? { id: it.id, soldOut: false } : { id: it.id, soldOut: true };
      if (out && it.stock !== null && it.stock <= 0) body.stock = 10;
      const d = take(await call('item_stock', body));
      if (d) { toast(out ? it.name + ' tersedia lagi.' : it.name + ' ditandai habis.'); renderProducts(); }
      return;
    }
    const crow = b.closest('.o-catrow');
    if (act === 'cat-save') {
      const d = take(await call('cat_save', { id: crow.dataset.cid, name: crow.querySelector('input').value }));
      if (d) { toast('Kategori disimpan.'); renderProducts(); }
    } else if (act === 'cat-add') {
      const inp = $('newCat');
      const d = take(await call('cat_save', { name: inp.value }));
      if (d) { toast('Kategori ditambahkan.'); renderProducts(); }
    } else if (act === 'cat-del') {
      if (!confirm('Hapus kategori ini?')) return;
      const d = take(await call('cat_delete', { id: crow.dataset.cid }));
      if (d) { toast('Kategori dihapus.'); if (st.cat === crow.dataset.cid) st.cat = 'all'; renderProducts(); }
    }
  });

  /* ---------- form produk ---------- */
  function renderForm() {
    const e = st.edit, it = e.item, d = st.data;
    $('tabProducts').innerHTML =
      '<form id="pform" class="o-form" novalidate>' +
        '<div class="o-formhead"><button type="button" class="o-btn" data-f="back">‹ Kembali</button><h2>' + (e.isNew ? 'Tambah produk' : 'Ubah produk') + '</h2></div>' +
        '<div class="o-ph"><div class="o-pimg big" id="fImg">' + thumb(it) + '</div>' +
          '<div class="o-phbtns"><label class="o-btn o-file">' + (it.img ? 'Ganti foto' : 'Pilih foto') + '<input type="file" id="fFile" accept="image/jpeg,image/png,image/webp" hidden></label>' +
          (it.img ? '<button type="button" class="o-btn danger" data-f="noimg">Hapus foto</button>' : '') +
          '<span class="o-muted" id="fUp">JPG, PNG, atau WebP, maksimal 8 MB. Rasio tegak (3:5) paling pas.</span></div></div>' +
        '<div class="field"><label for="fName">Nama produk</label><input id="fName" maxlength="80" value="' + esc(it.name) + '"></div>' +
        '<div class="two"><div class="field"><label for="fCat">Kategori</label><select id="fCat">' + d.cats.map(c => '<option value="' + esc(c.id) + '"' + (c.id === it.cat ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select></div>' +
          '<div class="field"><label for="fPrice">Harga (Rp)</label><input id="fPrice" inputmode="numeric" value="' + esc(it.price) + '" placeholder="28000"></div></div>' +
        '<div class="two"><div class="field"><label for="fStock">Stok</label><input id="fStock" type="number" min="0" inputmode="numeric" value="' + (it.stock === null || it.stock === undefined ? '' : it.stock) + '" placeholder="Kosong = tidak dibatasi"></div>' +
          '<div class="field"><label for="fTag">Label di foto (opsional)</label><input id="fTag" maxlength="30" value="' + esc(it.tag || '') + '" placeholder="Terlaris, Baru, Pre-order H-2"></div></div>' +
        '<div class="field"><label for="fDesc">Deskripsi</label><textarea id="fDesc" maxlength="300" rows="3">' + esc(it.desc || '') + '</textarea></div>' +
        '<div class="field"><label for="fAll">Alergen (pisahkan dengan koma)</label><input id="fAll" value="' + esc((it.allergens || []).join(', ')) + '" placeholder="Gluten, Susu, Telur"></div>' +
        '<div class="field"><label for="fInc">Isi paket (satu per baris, khusus paket/bundle)</label><textarea id="fInc" rows="3" placeholder="2 × Butter Croissant">' + esc((it.includes || []).join('\n')) + '</textarea></div>' +
        '<fieldset class="o-checks"><legend>Tampil di beranda</legend>' + d.home.map(h => '<label><input type="checkbox" name="home" value="' + esc(h.id) + '"' + (e.home.includes(h.id) ? ' checked' : '') + '> ' + esc(h.title) + '</label>').join('') + '</fieldset>' +
        '<fieldset class="o-feat"><legend>Sorotan launching di beranda</legend>' +
          '<label class="o-checks one"><input type="checkbox" id="fFeat"' + (e.feature.on ? ' checked' : '') + '> Tampilkan sebagai sorotan besar (gambar besar + tombol "Explore more")</label>' +
          '<div class="o-featbox" id="featBox"' + (e.feature.on ? '' : ' hidden') + '>' +
            '<div class="field"><label for="fFLay">Tampilan</label><select id="fFLay">' + [['auto', 'Otomatis (bergantian antar sorotan)'], ['kiri', 'Foto di kiri, teks di kanan'], ['kanan', 'Foto di kanan, teks di kiri (pita berwarna)'], ['penuh', 'Foto penuh, teks di atas foto'], ['tengah', 'Foto lebar, teks di tengah']].map(o => '<option value="' + o[0] + '"' + (e.feature.layout === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div>' +
            '<div class="field"><label for="fFLabel">Label kecil</label><input id="fFLabel" maxlength="30" value="' + esc(e.feature.label) + '" placeholder="Baru launching, Bundle hemat, Edisi terbatas"></div>' +
            '<div class="field"><label for="fFHead">Judul sorotan (kosong = nama produk)</label><input id="fFHead" maxlength="60" value="' + esc(e.feature.headline) + '"></div>' +
            '<div class="field"><label for="fFText">Kalimat promosi (kosong = deskripsi produk)</label><textarea id="fFText" rows="2" maxlength="200">' + esc(e.feature.text) + '</textarea></div>' +
            '<p class="o-hint">Maksimal 4 sorotan. Foto produk dipakai sebagai gambar besar, jadi pakai foto yang tajam.</p>' +
          '</div></fieldset>' +
        '<label class="o-checks one"><input type="checkbox" id="fOut"' + (it.soldOut ? ' checked' : '') + '> Tandai habis (tidak bisa dipesan)</label>' +
        '<p class="err" id="fErr" role="alert" hidden></p>' +
        '<div class="o-formact"><button type="submit" class="btn" id="fSave">Simpan produk</button>' +
          (e.isNew ? '' : '<button type="button" class="o-btn danger" data-f="del">Hapus produk</button>') + '</div>' +
      '</form>';
  }

  $('tabProducts').addEventListener('click', async ev => {
    const b = ev.target.closest('[data-f]');
    if (!b || !st.edit) return;
    if (b.dataset.f === 'back') { st.edit = null; renderProducts(); }
    else if (b.dataset.f === 'noimg') { st.edit.item.img = ''; keepFields(); renderForm(); }
    else if (b.dataset.f === 'del') {
      if (!confirm('Hapus "' + st.edit.item.name + '" dari menu? Pesanan lama tetap tersimpan.')) return;
      const d = take(await call('item_delete', { id: st.edit.item.id }));
      if (d) { toast('Produk dihapus.'); st.edit = null; renderProducts(); }
    }
  });
  // simpan isian form ke state sebelum menggambar ulang (mis. setelah ganti foto)
  function keepFields() {
    const it = st.edit.item;
    if (!$('fName')) return;
    it.name = $('fName').value; it.cat = $('fCat').value; it.price = $('fPrice').value; it.tag = $('fTag').value; it.desc = $('fDesc').value;
    it.allergens = $('fAll').value.split(',').map(x => x.trim()).filter(Boolean);
    it.includes = $('fInc').value.split('\n').map(x => x.trim()).filter(Boolean);
    it.soldOut = $('fOut').checked; it.stock = $('fStock').value.trim() === '' ? null : Number($('fStock').value);
    st.edit.home = Array.from(document.querySelectorAll('input[name="home"]:checked')).map(x => x.value);
    st.edit.feature = { on: $('fFeat').checked, layout: $('fFLay').value, label: $('fFLabel').value, headline: $('fFHead').value, text: $('fFText').value };
  }
  $('tabProducts').addEventListener('change', ev => { if (ev.target.id === 'fFeat') $('featBox').hidden = !ev.target.checked; });
  $('tabProducts').addEventListener('change', async ev => {
    if (ev.target.id !== 'fFile' || !st.edit) return;
    const f = ev.target.files[0];
    if (!f) return;
    $('fUp').textContent = 'Mengunggah…';
    const fd = new FormData(); fd.append('photo', f);
    let data = null, r = null;
    try { r = await fetch('../api/owner.php?action=upload', { method: 'POST', headers: { 'X-Requested-With': 'sb' }, body: fd, credentials: 'same-origin' }); data = await r.json(); } catch (e) {}
    if (r && r.status === 401) { S.onLoggedOut(); return; }
    if (!r || !r.ok || !data || !data.path) { $('fUp').textContent = (data && data.error) || 'Foto gagal diunggah.'; return; }
    keepFields();
    // foto yang baru diunggah dan diganti lagi sebelum disimpan dibiarkan; server membersihkan foto lama saat simpan
    st.edit.item.img = data.path;
    renderForm();
  });
  $('tabProducts').addEventListener('submit', async ev => {
    if (ev.target.id !== 'pform') return;
    ev.preventDefault();
    keepFields();
    const e = st.edit, it = e.item, err = $('fErr');
    err.hidden = true;
    if (it.name.trim().length < 2) { err.textContent = 'Isi nama produk.'; err.hidden = false; return; }
    if (String(it.price).trim() === '') { err.textContent = 'Isi harga produk.'; err.hidden = false; return; }
    const btn = $('fSave'); btn.disabled = true; btn.textContent = 'Menyimpan…';
    const body = { id: e.isNew ? '' : it.id, name: it.name, cat: it.cat, price: it.price, desc: it.desc, tag: it.tag, allergens: it.allergens, includes: it.includes, img: it.img || '', soldOut: it.soldOut, stock: it.stock, home: e.home, feature: e.feature };
    const d = take(await call('item_save', body));
    btn.disabled = false; btn.textContent = 'Simpan produk';
    if (d) { toast('Produk tersimpan.'); st.edit = null; renderProducts(); }
  });

  /* ---------- pengaturan toko ---------- */
  function hourOpts(from, to, cur) {
    let o = '';
    for (let h = from; h <= to; h++) o += '<option value="' + h + '"' + (h === cur ? ' selected' : '') + '>' + String(h).padStart(2, '0') + '.00</option>';
    return o;
  }
  function renderSettings() {
    const s = st.data && st.data.settings;
    if (!s) { $('tabSettings').innerHTML = '<p class="o-muted">Memuat…</p>'; return; }
    const tr = s.transfer || {};
    $('tabSettings').innerHTML =
      '<div class="o-setgrid">' +
      '<form class="o-card2" data-set="info" novalidate><h2>Info toko</h2>' +
        '<div class="field"><label for="sShop">Nama toko</label><input id="sShop" maxlength="40" value="' + esc(s.shop) + '"></div>' +
        '<div class="field"><label for="sAddr">Alamat</label><input id="sAddr" maxlength="200" value="' + esc(s.address) + '"></div>' +
        '<div class="field"><label for="sContact">Kontak (WhatsApp)</label><input id="sContact" maxlength="40" value="' + esc(s.contact) + '"></div>' +
        '<div class="field"><label for="sIg">Instagram</label><input id="sIg" maxlength="150" value="' + esc((s.social || {}).instagram || '') + '" placeholder="@namaakun atau tautan lengkap"></div>' +
        '<div class="field"><label for="sTt">TikTok</label><input id="sTt" maxlength="150" value="' + esc((s.social || {}).tiktok || '') + '" placeholder="@namaakun atau tautan lengkap"></div>' +
        '<div class="field"><label for="sFb">Facebook</label><input id="sFb" maxlength="150" value="' + esc((s.social || {}).facebook || '') + '" placeholder="namahalaman atau tautan lengkap"></div>' +
        '<button class="btn" type="submit">Simpan</button></form>' +

      '<form class="o-card2" data-set="quote" novalidate><h2>Kutipan di beranda</h2>' +
        '<p class="o-hint">Kalimat dari tokoh yang tampil di bagian bawah beranda. Kosongkan kalimatnya untuk menyembunyikan bagian ini.</p>' +
        '<div class="field"><label for="qText">Kutipan</label><textarea id="qText" rows="3" maxlength="260">' + esc((s.quote || {}).text || '') + '</textarea></div>' +
        '<div class="field"><label for="qAuthor">Nama tokoh</label><input id="qAuthor" maxlength="60" value="' + esc((s.quote || {}).author || '') + '"></div>' +
        '<div class="field"><label for="qLang">Bahasa kutipan</label><select id="qLang">' + [['', 'Sama dengan situs (Indonesia)'], ['fr', 'Prancis'], ['en', 'Inggris'], ['it', 'Italia'], ['es', 'Spanyol']].map(o => '<option value="' + o[0] + '"' + (((s.quote || {}).lang || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div>' +
        '<div class="field"><label for="qRole">Keterangan (opsional)</label><input id="qRole" maxlength="80" value="' + esc((s.quote || {}).role || '') + '" placeholder="Mis. Pâtissier français, 1783–1833"></div>' +
        '<button class="btn" type="submit">Simpan</button></form>' +

      '<form class="o-card2" data-set="hours" novalidate><h2>Jam &amp; hari buka</h2>' +
        '<div class="two"><div class="field"><label for="sOpen">Buka jam</label><select id="sOpen">' + hourOpts(0, 23, s.open) + '</select></div>' +
        '<div class="field"><label for="sClose">Tutup jam</label><select id="sClose">' + hourOpts(1, 24, s.close) + '</select></div></div>' +
        '<fieldset class="o-checks"><legend>Hari libur mingguan</legend>' + DAYS.map((n, i) => '<label><input type="checkbox" name="cday" value="' + i + '"' + (s.closedDays.includes(i) ? ' checked' : '') + '> ' + n + '</label>').join('') + '</fieldset>' +
        '<button class="btn" type="submit">Simpan</button></form>' +

      '<form class="o-card2" data-set="delivery" novalidate><h2>Delivery</h2>' +
        '<div class="field"><label for="sMin">Minimal pesanan antar (Rp)</label><input id="sMin" inputmode="numeric" value="' + esc(s.minDelivery) + '"></div>' +
        '<div class="o-zones" id="zones">' + s.zones.map(zoneRow).join('') + '</div>' +
        '<button type="button" class="o-btn" data-set-act="zone-add">＋ Tambah area</button>' +
        '<button class="btn" type="submit">Simpan</button></form>' +

      '<form class="o-card2" data-set="pay" novalidate><h2>Pembayaran (transfer &amp; QRIS)</h2>' +
        '<p class="o-hint">Ditampilkan ke pembeli di langkah pembayaran, sebelum pesanannya dibuat. Pembeli yang sudah bayar menekan "Saya sudah bayar", lalu kamu memeriksanya di tab Pesanan.</p>' +
        '<div class="field"><label for="sBank">Bank</label><input id="sBank" maxlength="40" value="' + esc(tr.bank) + '"></div>' +
        '<div class="field"><label for="sNo">Nomor rekening</label><input id="sNo" inputmode="numeric" maxlength="40" value="' + esc(tr.number) + '"></div>' +
        '<div class="field"><label for="sHolder">Atas nama</label><input id="sHolder" maxlength="60" value="' + esc(tr.holder) + '"></div>' +
        '<div class="field"><label>Kode QRIS</label><div class="o-ph"><div class="o-pimg big" id="qrPrev">' + (s.qris ? '<img src="../' + esc(s.qris) + '" alt="QRIS" style="object-fit:contain;background:#fff">' : '<span class="o-noimg">Belum ada</span>') + '</div>' +
          '<div class="o-phbtns"><label class="o-btn o-file">' + (s.qris ? 'Ganti gambar QRIS' : 'Unggah gambar QRIS') + '<input type="file" id="qrFile" accept="image/jpeg,image/png,image/webp" hidden></label>' +
          (s.qris ? '<button type="button" class="o-btn danger" id="qrDel">Hapus</button>' : '') +
          '<span class="o-muted" id="qrMsg">Unggah screenshot atau foto kode QRIS tokomu (JPG/PNG/WebP).</span></div></div>' +
          '<input type="hidden" id="sQris" value="' + esc(s.qris || '') + '"></div>' +
        '<button class="btn" type="submit">Simpan</button></form>' +
      '</div>';
  }
  function zoneRow(z) {
    return '<div class="o-zone" data-zid="' + esc(z.id || '') + '"><input data-z="label" value="' + esc(z.label) + '" placeholder="Nama area, mis. Dekat (sampai 3 km)" maxlength="60" aria-label="Nama area">' +
      '<input data-z="fee" inputmode="numeric" value="' + esc(z.fee) + '" placeholder="Ongkir" aria-label="Ongkir (Rp)"><button type="button" class="o-btn danger" data-set-act="zone-del" aria-label="Hapus area">✕</button></div>';
  }
  $('tabSettings').addEventListener('click', e => {
    const b = e.target.closest('[data-set-act]');
    if (!b) return;
    if (b.dataset.setAct === 'zone-add') $('zones').insertAdjacentHTML('beforeend', zoneRow({ id: '', label: '', fee: '' }));
    if (b.dataset.setAct === 'zone-del') b.closest('.o-zone').remove();
  });
  // unggah / hapus gambar QRIS (baru tersimpan setelah menekan Simpan)
  $('tabSettings').addEventListener('change', async e => {
    if (e.target.id !== 'qrFile') return;
    const f = e.target.files[0];
    if (!f) return;
    $('qrMsg').textContent = 'Mengunggah…';
    const fd = new FormData(); fd.append('photo', f);
    let r = null, data = null;
    try { r = await fetch('../api/owner.php?action=upload', { method: 'POST', headers: { 'X-Requested-With': 'sb' }, body: fd, credentials: 'same-origin' }); data = await r.json(); } catch (x) {}
    if (r && r.status === 401) { S.onLoggedOut(); return; }
    if (!r || !r.ok || !data || !data.path) { $('qrMsg').textContent = (data && data.error) || 'Gagal mengunggah.'; return; }
    $('sQris').value = data.path;
    $('qrPrev').innerHTML = '<img src="../' + esc(data.path) + '" alt="QRIS" style="object-fit:contain;background:#fff">';
    $('qrMsg').textContent = 'Terunggah. Tekan Simpan supaya dipakai.';
  });
  $('tabSettings').addEventListener('click', e => {
    if (!e.target.closest('#qrDel')) return;
    $('sQris').value = ''; $('qrPrev').innerHTML = '<span class="o-noimg">Belum ada</span>'; $('qrMsg').textContent = 'Dihapus. Tekan Simpan untuk menyimpan.';
  });
  $('tabSettings').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, kind = f.dataset.set, v = id => $(id).value;
    let body = {};
    if (kind === 'info') body = { shop: v('sShop'), address: v('sAddr'), contact: v('sContact'), social: { instagram: v('sIg'), tiktok: v('sTt'), facebook: v('sFb') } };
    if (kind === 'quote') body = { quote: { text: v('qText'), author: v('qAuthor'), role: v('qRole'), lang: v('qLang') } };
    if (kind === 'hours') body = { open: Number(v('sOpen')), close: Number(v('sClose')), closedDays: Array.from(f.querySelectorAll('input[name="cday"]:checked')).map(x => Number(x.value)) };
    if (kind === 'delivery') body = { minDelivery: v('sMin'), zones: Array.from(f.querySelectorAll('.o-zone')).map(r => ({ id: r.dataset.zid, label: r.querySelector('[data-z="label"]').value, fee: r.querySelector('[data-z="fee"]').value })) };
    if (kind === 'pay') body = { transfer: { bank: v('sBank'), number: v('sNo'), holder: v('sHolder') }, qris: v('sQris') };
    const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
    const d = take(await call('settings_save', body));
    btn.disabled = false;
    if (d) { toast('Pengaturan tersimpan.'); renderSettings(); }
  });
})();
