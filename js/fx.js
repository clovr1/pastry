/* Animasi situs: muncul saat digulir, paralaks banner, garis kemajuan gulir, foto memudar masuk.
   Semuanya mati otomatis kalau perangkat meminta gerakan dikurangi (prefers-reduced-motion). */
(function () {
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const html = document.documentElement;
  html.classList.add('fx');   // gaya awal (transparan) hanya berlaku kalau skrip ini berjalan

  /* ---- foto memudar masuk begitu selesai dimuat ---- */
  document.addEventListener('load', e => { if (e.target && e.target.tagName === 'IMG') e.target.classList.add('in'); }, true);
  const settleImgs = root => (root || document).querySelectorAll('.ph img:not(.in)').forEach(i => { if (i.complete && i.naturalWidth) i.classList.add('in'); });

  /* ---- muncul saat digulir ---- */
  const SEL = ['.hsec-head', '.hsec .item', '.pgrid .item', '.menuhead', '.cat', '.strip > div', '.co-head', '.co-sec', '.kr-head',
    '.pd-img', '.rel .item', '.ord-head', '.ord-banner', '.ord-steps', '.ord-card', '.acc-hero', '.acc-h', '.acc-vrow', '.acc-order', '.acc-side',
    '.acc-empty', '.auth', '.foot-in > *', '.foot-bot', '.empty'].join(',');
  let io = null;
  if (!reduced && 'IntersectionObserver' in window) {
    io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const el = en.target;
        io.unobserve(el);
        el.classList.add('in');
        // setelah selesai, lepas kelasnya supaya efek hover/transisi bawaan elemen kembali normal
        setTimeout(() => el.classList.remove('rv', 'in'), 1100);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -36px 0px' });
  }
  function scan() {
    settleImgs();
    if (!io) return;
    const fresh = Array.from(document.querySelectorAll(SEL)).filter(el => !el.dataset.rv && !el.closest('.drawer, #drawer'));
    const seen = new Map();   // nomor urut per induk, untuk jeda bertahap antar kartu
    fresh.forEach(el => {
      el.dataset.rv = '1';
      const p = el.parentElement, n = seen.get(p) || 0;
      seen.set(p, n + 1);
      el.style.setProperty('--d', String(n % 6));
      el.classList.add('rv');
      io.observe(el);
    });
  }
  let queued = false;
  const queue = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; scan(); }); };
  new MutationObserver(queue).observe(document.body, { childList: true, subtree: true });
  scan();

  /* ---- gulir: garis kemajuan di atas, paralaks dan pudar pada banner ---- */
  const bar = document.createElement('i');
  bar.className = 'progress'; bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
  const banner = document.getElementById('banner'), bnImg = document.getElementById('bnImg'), bnText = banner && banner.querySelector('.bn-text');
  let ticking = false;
  function onScroll() {
    ticking = false;
    const y = window.scrollY, max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    bar.style.transform = 'scaleX(' + Math.min(1, y / max) + ')';
    if (reduced || !banner) return;
    const h = banner.offsetHeight;
    if (y > h * 1.2) return;
    if (bnImg) bnImg.style.transform = 'translate3d(0,' + Math.min(110, y * 0.22).toFixed(1) + 'px,0)';
    if (bnText) { bnText.style.opacity = String(Math.max(0, 1 - y / (h * 0.55))); bnText.style.transform = 'translate3d(0,' + (y * -0.08).toFixed(1) + 'px,0)'; }
  }
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();
})();
