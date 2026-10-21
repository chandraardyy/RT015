(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (d) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  async function api(url, opts) {
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan, coba lagi.');
    return data;
  }

  // ---------- Placeholder otomatis bila gambar belum ditaruh ----------
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!img || img.tagName !== 'IMG' || img.dataset.fb) return;
    img.dataset.fb = '1';
    const label = img.dataset.slot ? 'Taruh gambar di: ' + img.dataset.slot : 'Foto belum tersedia';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="#e3e9ef"/><rect x="30" y="30" width="740" height="540" rx="24" fill="none" stroke="#10243a" stroke-width="4" stroke-dasharray="14 12"/><text x="400" y="310" text-anchor="middle" font-family="sans-serif" font-size="30" fill="#10243a">${label}</text></svg>`;
    img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }, true);

  // ---------- Navbar mobile ----------
  const toggle = $('#navToggle'), menu = $('#navMenu');
  toggle.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });
  menu.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') { menu.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); }
  });
  $('#year').textContent = new Date().getFullYear();

  // ---------- Jadwal Posyandu (Senin minggu ke-2) & Posbindu (Rabu minggu ke-3) ----------
  // "Minggu ke-n" = kemunculan ke-n hari tersebut dalam bulan.
  const nthWeekday = (y, m, weekday, n) => {
    const first = new Date(y, m, 1);
    const offset = (weekday - first.getDay() + 7) % 7;
    return new Date(y, m, 1 + offset + (n - 1) * 7);
  };
  const nextOccurrence = (weekday, n) => {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    let d = nthWeekday(t.getFullYear(), t.getMonth(), weekday, n);
    if (d < t) d = nthWeekday(t.getFullYear(), t.getMonth() + 1, weekday, n);
    return { d, today: d.getTime() === t.getTime() };
  };
  const label = ({ d, today }) =>
    (today ? 'Hari ini, ' : '') + d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
  const pos = label(nextOccurrence(1, 2));  // Senin ke-2
  const bin = label(nextOccurrence(3, 3));  // Rabu ke-3
  $('#nextPosyandu').textContent = pos;  $('#nextPosyandu2').textContent = pos;
  $('#nextPosbindu').textContent = bin;  $('#nextPosbindu2').textContent = bin;

  // ---------- Hitung naik angka data warga ----------
  const countUp = (el, to) => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || to === 0) { el.textContent = to.toLocaleString('id-ID'); return; }
    const start = performance.now(), dur = 1200;
    const tick = (now) => {
      const p = Math.min((now - start) / dur, 1);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))).toLocaleString('id-ID');
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  // ---------- Pengaturan situs ----------
  async function loadSettings() {
    try {
      const s = await api('/api/settings');
      $$('[data-set]').forEach((el) => { if (s[el.dataset.set] !== undefined) el.textContent = s[el.dataset.set]; });
      $('#tentangText').textContent = s.tentang || '';
      $('#visiText').textContent = s.visi || '';
      $('#misiList').innerHTML = (s.misi || '').split('\n').filter(Boolean).map((m) => `<li>${esc(m)}</li>`).join('');

      const digits = (v) => String(v || '').replace(/[^\d+]/g, '');
      $('#telLink').href = 'tel:' + digits(s.telepon);
      const wa = digits(s.whatsapp).replace(/^\+/, '').replace(/^0/, '62');
      $('#waLink').href = 'https://wa.me/' + wa;

      if (s.maps_embed) $('#mapBox').innerHTML = `<iframe src="${esc(s.maps_embed)}" title="Peta lokasi RT 15 RW 03" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>`;

      const laki = +s.laki_laki || 0, per = +s.perempuan || 0, kel = +s.keluarga || 0;
      const targets = [['#stLaki', laki], ['#stPerempuan', per], ['#stTotal', laki + per], ['#stKeluarga', kel]];
      const io = new IntersectionObserver((entries, o) => {
        if (entries[0].isIntersecting) { targets.forEach(([sel, v]) => countUp($(sel), v)); o.disconnect(); }
      }, { threshold: 0.3 });
      io.observe($('#data-warga'));
    } catch (e) { console.error(e); }
  }

  // ---------- Anggota Karang Taruna ----------
  async function loadMembers() {
    const box = $('#members');
    try {
      const list = await api('/api/members');
      if (!list.length) { box.innerHTML = '<p class="muted">Data anggota belum tersedia.</p>'; return; }
      box.innerHTML = list.map((m) => `
        <figure class="member">
          <div class="member__photo">${m.photo
            ? `<img src="/uploads/${esc(m.photo)}" alt="Foto ${esc(m.name)}" loading="lazy">`
            : `<span>${esc(m.name.trim().charAt(0).toUpperCase())}</span>`}</div>
          <figcaption><strong>${esc(m.name)}</strong><span>${esc(m.position)}</span></figcaption>
        </figure>`).join('');
    } catch { box.innerHTML = '<p class="muted">Gagal memuat anggota.</p>'; }
  }

  // ---------- Berita ----------
  let news = [];
  async function loadNews() {
    const box = $('#newsList');
    try {
      news = await api('/api/news?limit=12');
      if (!news.length) { box.innerHTML = '<p class="muted">Belum ada berita.</p>'; return; }
      box.innerHTML = news.map((n, i) => `
        <article class="card">
          <div class="card__img">${n.image
            ? `<img src="/uploads/${esc(n.image)}" alt="" loading="lazy">`
            : '<div class="noimg">Foto belum ada</div>'}</div>
          <div class="card__body">
            <time datetime="${esc(n.created_at)}">${fmtDate(n.created_at)}</time>
            <h3>${esc(n.title)}</h3>
            <p>${esc(n.content.length > 130 ? n.content.slice(0, 130) + '…' : n.content)}</p>
            <button class="btn btn--outline btn--sm" data-news="${i}">Baca selengkapnya</button>
          </div>
        </article>`).join('');
    } catch { box.innerHTML = '<p class="muted">Gagal memuat berita.</p>'; }
  }
  $('#newsList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-news]');
    if (!b) return;
    const n = news[+b.dataset.news];
    $('#newsModalBody').innerHTML = `
      ${n.image ? `<img src="/uploads/${esc(n.image)}" alt="">` : ''}
      <time>${fmtDate(n.created_at)}</time>
      <h3>${esc(n.title)}</h3>
      ${n.content.split(/\n+/).map((p) => `<p>${esc(p)}</p>`).join('')}`;
    $('#newsModal').showModal();
  });

  // ---------- Galeri ----------
  let gallery = [];
  async function loadGallery() {
    const box = $('#galleryList');
    try {
      gallery = await api('/api/gallery');
      if (!gallery.length) { box.innerHTML = '<p class="muted">Belum ada foto di galeri.</p>'; return; }
      box.innerHTML = gallery.map((g, i) => `
        <button class="gallery__item" data-g="${i}" aria-label="Perbesar foto: ${esc(g.title)}">
          <img src="/uploads/${esc(g.image)}" alt="${esc(g.title)}" loading="lazy">
          <span>${esc(g.title)}</span>
        </button>`).join('');
    } catch { box.innerHTML = '<p class="muted">Gagal memuat galeri.</p>'; }
  }
  $('#galleryList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-g]');
    if (!b) return;
    const g = gallery[+b.dataset.g];
    $('#lightboxBody').innerHTML = `<img src="/uploads/${esc(g.image)}" alt="${esc(g.title)}"><figcaption><strong>${esc(g.title)}</strong>${g.description ? ' – ' + esc(g.description) : ''}</figcaption>`;
    $('#lightbox').showModal();
  });

  // ---------- Tutup modal ----------
  $$('dialog').forEach((dlg) => {
    dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.hasAttribute('data-close')) dlg.close(); });
  });

  // ---------- Form (laporan & kontak) ----------
  function handleForm(form, url, okText) {
    const msg = $('.form__msg', form), btn = $('button[type=submit]', form);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      btn.disabled = true; msg.className = 'form__msg'; msg.textContent = 'Mengirim…';
      try {
        await api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
        form.reset(); msg.classList.add('ok'); msg.textContent = okText;
      } catch (err) { msg.classList.add('err'); msg.textContent = err.message; }
      btn.disabled = false;
    });
  }
  handleForm($('#reportForm'), '/api/reports', 'Laporan terkirim. Terima kasih, pengurus RT akan menindaklanjuti.');
  handleForm($('#contactForm'), '/api/contact', 'Pesan terkirim. Terima kasih sudah menghubungi kami.');

  loadSettings(); loadMembers(); loadNews(); loadGallery();
})();
