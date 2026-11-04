/* Halaman status pesanan untuk pembeli (pesanan.html?id=...). Diperbarui otomatis tiap 20 detik. */
(function () {
  const root = document.getElementById('ord');
  let id = new URLSearchParams(location.search).get('id') || '';
  if (!id) { try { id = localStorage.getItem('sweetbite-last-order') || ''; } catch (e) {} }

  const STEPS = ['baru', 'dikonfirmasi', 'disiapkan', 'siap', 'selesai'];
  const stepLabel = (s, mode) => ({
    baru: 'Pesanan diterima', dikonfirmasi: 'Dikonfirmasi', disiapkan: 'Disiapkan',
    siap: mode === 'delivery' ? 'Diantar' : 'Siap diambil', selesai: 'Selesai'
  }[s]);
  const FINAL = ['selesai', 'dibatalkan'];
  let timer = 0;

  const fmtDate = s => {
    const d = new Date(s + 'T00:00:00');
    return DAYS[d.getDay()] + ', ' + d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  function message(o) {
    const where = o.mode === 'delivery' ? 'diantar' : 'diambil';
    return {
      baru: 'Pesananmu sudah masuk. Tunggu toko mengonfirmasi. Halaman ini diperbarui otomatis.',
      dikonfirmasi: o.paid ? 'Pesananmu dikonfirmasi dan pembayaran sudah kami terima.' : 'Pesananmu dikonfirmasi. Silakan selesaikan pembayaran di bawah.',
      disiapkan: 'Pesananmu sedang disiapkan.',
      siap: o.mode === 'delivery' ? 'Pesananmu sedang dalam pengantaran.' : 'Pesananmu sudah siap ' + where + ' di toko.',
      selesai: 'Pesanan selesai. Terima kasih sudah memesan!',
      dibatalkan: 'Pesanan ini dibatalkan oleh toko.' + (o.contact ? ' Hubungi ' + esc(o.contact) + ' kalau ada pertanyaan.' : '')
    }[o.status];
  }

  function payBlock(o) {
    if (o.status === 'dibatalkan') return '<p class="ord-muted">Tidak ada pembayaran yang perlu dilakukan.</p>';
    if (o.paid) return '<p class="ord-paid">✓ Lunas</p>';
    const total = '<p>Total yang dibayar: <b>' + rp(o.total) + '</b></p>';
    const info = o.paymentInfo;
    if (o.payment === 'transfer' && info) {
      return '<p class="ord-chip warn">Belum dibayar</p>' + total +
        '<div class="ord-acc"><span>' + esc(info.bank) + '</span><b id="accNo">' + esc(info.number) + '</b><span>a.n. ' + esc(info.holder) + '</span>' +
        '<button type="button" class="linkbtn" id="copyAcc">Salin nomor rekening</button></div>' +
        '<p class="ord-muted">Setelah transfer, tunggu toko menandai pesananmu lunas. Sebut kode <b>' + esc(o.code) + '</b> kalau diminta.</p>';
    }
    if (o.payment === 'qris' && info) {
      return '<p class="ord-chip warn">Belum dibayar</p>' + total +
        (info.image ? '<img class="ord-qr" src="' + esc(info.image) + '" alt="Kode QRIS">' : '<p class="ord-muted">Kode QRIS akan dikirim oleh toko.</p>') +
        '<p class="ord-muted">Setelah membayar, tunggu toko menandai pesananmu lunas.</p>';
    }
    return '<p class="ord-chip">Bayar saat terima</p>' + total + '<p class="ord-muted">Siapkan uang pas saat pesananmu ' + (o.mode === 'delivery' ? 'diantar' : 'diambil') + '.</p>';
  }

  function render(o) {
    document.title = o.code + ' · ' + CONFIG.shop;
    const cancelled = o.status === 'dibatalkan';
    const idx = STEPS.indexOf(o.status);
    const steps = cancelled ? '' : '<ol class="ord-steps" aria-label="Tahap pesanan">' + STEPS.map((s, i) =>
      '<li class="' + (i < idx ? 'is-done' : i === idx ? 'is-now' : '') + '"' + (i === idx ? ' aria-current="step"' : '') + '><span></span>' + stepLabel(s, o.mode) + '</li>').join('') + '</ol>';
    const lines = o.items.map(it => '<li><span>' + it.qty + ' × ' + esc(it.name) + '</span><b>' + rp(it.price * it.qty) + '</b></li>').join('');
    root.innerHTML =
      '<div class="ord-head"><p class="label">Status pesanan</p><h1>' + esc(o.code) + '</h1>' +
      '<p class="ord-sub">Atas nama ' + esc(o.name) + '</p></div>' +
      '<div class="ord-banner' + (cancelled ? ' bad' : '') + '"><p>' + message(o) + '</p></div>' + steps +
      '<div class="ord-grid">' +
        '<section class="ord-card"><h2>Pesanan</h2><ul class="ord-lines">' + lines + '</ul>' +
          '<div class="sum"><div><span>Subtotal</span><span>' + rp(o.subtotal) + '</span></div>' +
          (o.mode === 'delivery' ? '<div class="muted"><span>Ongkir' + (o.zone ? ' (' + esc(o.zone) + ')' : '') + '</span><span>' + rp(o.fee) + '</span></div>' : '') +
          '<div class="total"><span>Total</span><span>' + rp(o.total) + '</span></div></div></section>' +
        '<section class="ord-card"><h2>' + (o.mode === 'delivery' ? 'Delivery' : 'Ambil di tempat') + '</h2>' +
          '<p><b>' + esc(fmtDate(o.date)) + '</b><br>' + esc(o.slot) + '</p>' +
          (o.mode === 'delivery' ? '<p class="ord-muted">Alamat antar</p><p class="ord-pre">' + esc(o.address || '') + '</p>' : '<p class="ord-muted">Ambil di</p><p>' + esc(CONFIG.address) + '</p>') +
          (o.note ? '<p class="ord-muted">Catatan</p><p class="ord-pre">' + esc(o.note) + '</p>' : '') + '</section>' +
        '<section class="ord-card"><h2>Pembayaran · ' + esc(o.paymentLabel) + '</h2>' + payBlock(o) + '</section>' +
      '</div>' +
      '<div class="ord-actions"><a class="btn" href="products.html">Pesan lagi</a>' + (o.contact ? '<span class="ord-muted">Ada pertanyaan? Hubungi ' + esc(o.contact) + '</span>' : '') + '</div>';
    const cp = document.getElementById('copyAcc');
    if (cp) cp.addEventListener('click', () => {
      const no = document.getElementById('accNo').textContent;
      const done = () => { cp.textContent = 'Tersalin'; setTimeout(() => { cp.textContent = 'Salin nomor rekening'; }, 2000); };
      try { navigator.clipboard.writeText(no).then(done, () => { cp.textContent = 'Salin manual: ' + no; }); } catch (e) { cp.textContent = 'Salin manual: ' + no; }
    });
  }

  function notFound(msg) {
    root.innerHTML = '<div class="nf"><h1>Pesanan tidak ditemukan</h1><p>' + esc(msg) + '</p><a class="btn" href="products.html">Lihat produk</a></div>';
  }

  async function load() {
    clearTimeout(timer);
    if (!/^[a-f0-9]{16}$/.test(id)) { notFound('Tautan pesanan tidak lengkap. Buka lagi tautan yang kamu dapat setelah memesan.'); return; }
    try {
      const r = await fetch('api/track.php?id=' + encodeURIComponent(id), { cache: 'no-store' });
      if (r.status === 404) { notFound('Kami tidak menemukan pesanan dengan tautan ini.'); return; }
      const o = await r.json();
      if (!r.ok || !o || !o.code) throw new Error('bad');
      render(o);
      if (!FINAL.includes(o.status)) timer = setTimeout(load, 20000);
    } catch (e) {
      if (!root.querySelector('.ord-head')) root.innerHTML = '<div class="nf"><h1>Belum bisa memuat</h1><p>Periksa koneksi internetmu, lalu muat ulang halaman ini.</p></div>';
      timer = setTimeout(load, 20000);
    }
  }
  load();
})();
