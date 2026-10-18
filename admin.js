(function () {
  const C = window.APP_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, txt) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  };
  const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_KEY);
  const BUCKET = 'testimoni';
  const pub = (p) => C.SUPABASE_URL + '/storage/v1/object/public/' + BUCKET + '/' +
    String(p).split('/').map(encodeURIComponent).join('/');
  const mb = (b) => (b / 1048576).toFixed(1);

  /* Harus sama dengan tema di app.js (website publik) */
  const THEMES = {
    wall:  { terang: { bg: '#FBF3E4', surface: '#FFFDF8', text: '#2B2118', line: '#EADBC2' },
             gelap:  { bg: '#1F1913', surface: '#2A221A', text: '#F6EBDD', line: '#3B3126' } },
    fresh: { terang: { bg: '#F3FBF8', surface: '#FFFFFF', text: '#12302A', line: '#D5EEE6' },
             gelap:  { bg: '#0F1F1C', surface: '#162B26', text: '#E6F7F2', line: '#244139' } },
    pop:   { terang: { bg: '#FFF6B8', surface: '#FFFFFF', text: '#111111', line: '#111111' },
             gelap:  { bg: '#18181B', surface: '#27272A', text: '#FAFAFA', line: '#FAFAFA' } },
    ocean: { terang: { bg: '#EEF5FF', surface: '#FFFFFF', text: '#0F2A4A', line: '#D3E2F7' },
             gelap:  { bg: '#0B1626', surface: '#122340', text: '#E5EEFB', line: '#1F3860' } },
    noir:  { terang: { bg: '#F4F4F2', surface: '#FFFFFF', text: '#161616', line: '#E2E2DE' },
             gelap:  { bg: '#0E0E0E', surface: '#1A1A1A', text: '#F2F2F2', line: '#2C2C2C' } }
  };
  const FONTS = {
    poppins:  ["'Poppins',sans-serif", 'Poppins:wght@400;600;800'],
    inter:    ["'Inter',sans-serif", 'Inter:wght@400;600;800'],
    nunito:   ["'Nunito',sans-serif", 'Nunito:wght@400;600;800'],
    playfair: ["'Playfair Display',serif", 'Playfair+Display:wght@400;600;800'],
    space:    ["'Space Grotesk',sans-serif", 'Space+Grotesk:wght@400;600;700']
  };

  let owner = null, items = [], settings = null, booted = null;
  let editId = null, moving = false, logoFile = null, logoRemove = false;

  /* ===== LAYAR & NOTIFIKASI ===== */
  const SCREENS = ['sLoad', 'sLogin', 'sDenied', 'sApp'];
  function show(id) { SCREENS.forEach((s) => { $(s).hidden = s !== id; }); }
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.hidden = true; }, 4000);
  }
  function deny(msg) { $('denMsg').textContent = msg; show('sDenied'); }

  /* ===== VIDEO ===== */
  function parseVideo(u) {
    u = String(u || '').trim();
    let m;
    if ((m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/))) return { k: 'yt', id: m[1] };
    if ((m = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/))) return { k: 'drive', id: m[1] };
    if ((m = u.match(/drive\.google\.com\/open\?(?:.*&)?id=([\w-]+)/))) return { k: 'drive', id: m[1] };
    if (/^https?:\/\//i.test(u)) return { k: 'mp4', url: u };
    return null;
  }
  function testVideo() {
    const st = $('vstat');
    const v = parseVideo($('fVideo').value);
    const say = (txt, ok) => { st.textContent = txt; st.style.color = ok === true ? '#2B8A3E' : ok === false ? '#C92A2A' : ''; };
    if (!v) return say('Link tidak valid. Tempel link lengkap yang diawali https://', false);
    say('Memeriksa link…');
    if (v.k === 'drive') return say('Link Google Drive terdeteksi. Pastikan aksesnya "Siapa saja yang memiliki link", karena tidak bisa dites otomatis.', null);
    if (v.k === 'yt') {
      const i = new Image();
      i.onload = () => say('Link YouTube valid. Pastikan videonya Publik atau Tidak Terdaftar (bukan Pribadi).', true);
      i.onerror = () => say('Video YouTube tidak ditemukan. Cek lagi linknya.', false);
      i.src = 'https://img.youtube.com/vi/' + v.id + '/hqdefault.jpg';
      return;
    }
    const e = document.createElement('video');
    const timer = setTimeout(() => say('Link tidak merespons. Coba link lain.', false), 9000);
    e.onloadedmetadata = () => { clearTimeout(timer); say('Video bisa diputar.', true); };
    e.onerror = () => { clearTimeout(timer); say('Video tidak bisa diputar di website. Coba link lain, atau pakai YouTube.', false); };
    e.preload = 'metadata';
    e.src = v.url;
  }

  /* ===== FOTO -> WEBP ===== */
  const toBlob = (cv, type, q) => new Promise((r) => cv.toBlob(r, type, q));
  async function compress(file, maxW, maxBytes) {
    maxW = maxW || 1080; maxBytes = maxBytes || 900 * 1024;
    const url = URL.createObjectURL(file);
    let img;
    try {
      img = await new Promise((ok, no) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = () => no(new Error('Foto tidak bisa dibaca. Coba format JPG atau PNG.'));
        i.src = url;
      });
    } finally { URL.revokeObjectURL(url); }
    const sc = Math.min(1, maxW / img.naturalWidth);
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(img.naturalWidth * sc));
    cv.height = Math.max(1, Math.round(img.naturalHeight * sc));
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    const types = [['image/webp', 'webp'], ['image/jpeg', 'jpg']];
    for (const [type, ext] of types) {
      for (const q of [0.8, 0.65, 0.5, 0.35]) {
        const b = await toBlob(cv, type, q);
        if (!b || b.type !== type) break;
        if (b.size <= maxBytes) return { blob: b, ext, type };
      }
    }
    throw new Error('Foto terlalu besar. Coba foto yang lebih kecil.');
  }
  async function uploadImage(path, c) {
    const up = await sb.storage.from(BUCKET).upload(path, c.blob, { contentType: c.type, cacheControl: '31536000' });
    if (up.error) {
      throw new Error(/kuota/i.test(up.error.message) ? 'Kuota penyimpanan penuh. Hapus foto lama dulu.' : 'Gagal mengunggah foto: ' + up.error.message);
    }
  }
  const removeFile = (path) => (path ? sb.storage.from(BUCKET).remove([path]) : Promise.resolve());

  /* ===== KUOTA ===== */
  function renderQuota() {
    const used = owner.terpakai_bytes || 0, max = owner.kuota_bytes || 1;
    $('qtxt').textContent = mb(used) + ' MB dari ' + mb(max) + ' MB';
    $('qbar').style.width = Math.min(100, (used / max) * 100) + '%';
  }
  async function refreshQuota() {
    const { data } = await sb.from('owners').select('id,nama_toko,aktif,kuota_bytes,terpakai_bytes').eq('id', owner.id).maybeSingle();
    if (data) { owner = data; renderQuota(); }
  }

  /* ===== CSV ===== */
  function cell(v) {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function exportCsv() {
    if (!items.length) return toast('Belum ada testimoni untuk diexport.');
    const header = ['nama_customer', 'label', 'rating', 'teks', 'media_type', 'foto_url', 'video_url', 'tanggal', 'tampil', 'urutan'];
    const rows = items.map((t) => [t.nama_customer, t.label, t.rating, t.teks, t.media_type,
      t.media_path ? pub(t.media_path) : '', t.video_url, t.tanggal, t.tampil ? 'ya' : 'tidak', t.urutan]);
    const lines = [header.map(cell).join(',')].concat(rows.map((r) => r.map(cell).join(',')));
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'testimoni-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast(items.length + ' testimoni diexport.');
  }

  /* ===== DAFTAR TESTIMONI ===== */
  function thumbEl(t) {
    const d = h('div', 'thumb');
    if (t.media_type === 'foto' && t.media_path) {
      const i = h('img'); i.src = pub(t.media_path); i.alt = ''; i.loading = 'lazy'; d.appendChild(i);
    } else if (t.media_type === 'video') {
      const v = parseVideo(t.video_url);
      if (v && v.k === 'yt') { const i = h('img'); i.src = 'https://img.youtube.com/vi/' + v.id + '/default.jpg'; i.alt = ''; d.appendChild(i); }
      else d.textContent = '\u25B6';
    } else d.textContent = 'Aa';
    return d;
  }
  function rowEl(t, i) {
    const r = h('div', 'item' + (t.tampil ? '' : ' off'));
    r.appendChild(thumbEl(t));
    const m = h('div', 'meta');
    m.appendChild(h('div', 'nm', t.nama_customer));
    m.appendChild(h('div', 'muted small', '\u2605'.repeat(t.rating) + ' \u00B7 ' + (t.label || 'tanpa label') + ' \u00B7 ' + (t.tampil ? 'Tampil' : 'Disembunyikan')));
    if (t.teks) m.appendChild(h('div', 'snip', t.teks.length > 90 ? t.teks.slice(0, 90) + '\u2026' : t.teks));
    r.appendChild(m);
    const a = h('div', 'acts');
    const up = h('button', 'btn ghost sm', '\u25B2'); up.disabled = i === 0; up.onclick = () => move(i, -1);
    const dn = h('button', 'btn ghost sm', '\u25BC'); dn.disabled = i === items.length - 1; dn.onclick = () => move(i, 1);
    const ed = h('button', 'btn ghost sm', 'Edit'); ed.onclick = () => openForm(t);
    const b1 = h('button', 'btn ghost sm', t.tampil ? 'Sembunyikan' : 'Tampilkan'); b1.onclick = () => toggle(t);
    const b2 = h('button', 'btn danger sm', 'Hapus'); b2.onclick = () => del(t);
    [up, dn, ed, b1, b2].forEach((b) => a.appendChild(b));
    r.appendChild(a);
    return r;
  }
  function renderRows() {
    $('rows').replaceChildren(...items.map(rowEl));
    $('empty').hidden = items.length > 0;
    $('cnt').textContent = '(' + items.length + ')';
  }
  async function loadItems() {
    const { data, error } = await sb.from('testimonials').select('*').eq('owner_id', owner.id)
      .order('urutan').order('tanggal', { ascending: false }).order('dibuat', { ascending: false });
    if (error) { toast('Gagal memuat testimoni. Muat ulang halaman.'); return; }
    items = data; renderRows();
  }
  async function toggle(t) {
    const { error } = await sb.from('testimonials').update({ tampil: !t.tampil }).eq('id', t.id);
    if (error) return toast('Gagal mengubah status.');
    t.tampil = !t.tampil; renderRows();
  }
  async function del(t) {
    if (!confirm('Hapus testimoni dari ' + t.nama_customer + '? Tindakan ini tidak bisa dibatalkan.')) return;
    const { error } = await sb.from('testimonials').delete().eq('id', t.id);
    if (error) return toast('Gagal menghapus.');
    await removeFile(t.media_path);
    items = items.filter((x) => x.id !== t.id);
    renderRows(); refreshQuota(); toast('Testimoni dihapus.');
  }
  async function move(i, d) {
    const j = i + d;
    if (moving || j < 0 || j >= items.length) return;
    moving = true;
    try {
      const arr = items.slice();
      [arr[i], arr[j]] = [arr[j], arr[i]];
      const changes = [];
      arr.forEach((t, idx) => { if (t.urutan !== idx) changes.push([t.id, idx]); });
      const res = await Promise.all(changes.map((c) => sb.from('testimonials').update({ urutan: c[1] }).eq('id', c[0])));
      if (res.some((r) => r.error)) { toast('Gagal mengubah urutan.'); await loadItems(); return; }
      arr.forEach((t, idx) => { t.urutan = idx; });
      items = arr; renderRows();
    } finally { moving = false; }
  }

  /* ===== FORM TESTIMONI (TAMBAH / EDIT) ===== */
  const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const mediaLabel = (t) => (t.media_type === 'foto' ? 'foto' : t.media_type === 'video' ? 'video' : 'tanpa media');
  function syncMedia() {
    const v = $('fMedia').value;
    $('boxFoto').hidden = v !== 'foto';
    $('boxVideo').hidden = v !== 'video';
  }
  function setMediaOptions(t) {
    const opts = [];
    if (t) opts.push(['keep', 'Tetap pakai media saat ini (' + mediaLabel(t) + ')']);
    opts.push(['none', 'Tanpa media'], ['foto', t ? 'Foto (ganti)' : 'Foto'], ['video', t ? 'Video, link (ganti)' : 'Video (link)']);
    $('fMedia').replaceChildren(...opts.map((o) => { const e = h('option', null, o[1]); e.value = o[0]; return e; }));
    $('fMedia').value = t ? 'keep' : 'none';
    syncMedia();
  }
  function openForm(t) {
    editId = t ? t.id : null;
    $('form').reset();
    $('fTitle').textContent = t ? 'Edit Testimoni' : 'Tambah Testimoni';
    $('vstat').textContent = '';
    setMediaOptions(t);
    if (t) {
      $('fNama').value = t.nama_customer || '';
      $('fLabel').value = t.label || '';
      $('fRating').value = String(t.rating);
      $('fTeks').value = t.teks || '';
      $('fTgl').value = t.tanggal || today();
      if (t.media_type === 'video') $('fVideo').value = t.video_url || '';
    } else {
      $('fTgl').value = today();
    }
    $('modal').hidden = false;
  }
  async function submitForm(e) {
    e.preventDefault();
    const t = editId ? items.find((x) => x.id === editId) : null;
    if (editId && !t) { $('modal').hidden = true; return toast('Testimoni tidak ditemukan. Muat ulang halaman.'); }
    const nama = $('fNama').value.trim();
    const teks = $('fTeks').value.trim();
    const type = $('fMedia').value;
    if (!nama) return toast('Nama customer wajib diisi.');
    const keepsMedia = type === 'keep' && t && t.media_type !== 'none';
    if (!teks && type !== 'foto' && type !== 'video' && !keepsMedia) return toast('Isi teks testimoni atau tambahkan media.');
    const row = {
      nama_customer: nama, label: $('fLabel').value.trim() || null,
      rating: parseInt($('fRating').value, 10), teks: teks || null
    };
    if ($('fTgl').value) row.tanggal = $('fTgl').value;
    const btn = $('bSave');
    btn.disabled = true; btn.textContent = 'Menyimpan\u2026';
    let newPath = null, oldPath = null;
    try {
      if (type === 'foto') {
        const f = $('fFile').files[0];
        if (!f) throw new Error('Pilih foto dulu.');
        const c = await compress(f);
        const path = owner.id + '/' + crypto.randomUUID() + '.' + c.ext;
        await uploadImage(path, c);
        newPath = path;
        Object.assign(row, { media_type: 'foto', media_path: path, video_url: null });
        if (t) oldPath = t.media_path;
      } else if (type === 'video') {
        const u = $('fVideo').value.trim();
        if (!parseVideo(u)) throw new Error('Link video tidak valid.');
        Object.assign(row, { media_type: 'video', video_url: u, media_path: null });
        if (t) oldPath = t.media_path;
      } else if (type === 'none') {
        Object.assign(row, { media_type: 'none', media_path: null, video_url: null });
        if (t) oldPath = t.media_path;
      }
      let res;
      if (t) {
        res = await sb.from('testimonials').update(row).eq('id', t.id).select();
        if (!res.error && (!res.data || !res.data.length)) res = { error: { message: 'perubahan tidak tersimpan' } };
      } else {
        res = await sb.from('testimonials').insert(Object.assign({ owner_id: owner.id }, row));
      }
      if (res.error) {
        await removeFile(newPath);
        throw new Error('Gagal menyimpan: ' + res.error.message);
      }
      await removeFile(oldPath);
      $('modal').hidden = true;
      toast(t ? 'Perubahan disimpan.' : 'Testimoni disimpan.');
      await loadItems(); refreshQuota();
    } catch (err) {
      toast(err.message || 'Terjadi kesalahan.');
    } finally {
      btn.disabled = false; btn.textContent = 'Simpan';
    }
  }

  /* ===== PENGATURAN WEBSITE ===== */
  const fontLoaded = {};
  function loadFont(key) {
    if (fontLoaded[key] || !FONTS[key]) return;
    fontLoaded[key] = true;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + FONTS[key][1] + '&display=swap';
    document.head.appendChild(l);
  }
  function onColor(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '#fff';
    const n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? '#111' : '#fff';
  }
  function renderPreview() {
    const key = THEMES[$('sTema').value] ? $('sTema').value : 'wall';
    const pal = THEMES[key][$('sMode').value === 'gelap' ? 'gelap' : 'terang'];
    const fkey = FONTS[$('sFont').value] ? $('sFont').value : 'poppins';
    loadFont(fkey);
    const accent = $('sWarna').value;
    const pv = $('pv'), card = $('pvCard'), btn = $('pvBtn');
    pv.style.background = pal.bg;
    pv.style.color = pal.text;
    pv.style.fontFamily = FONTS[fkey][0];
    card.style.background = pal.surface;
    card.style.borderColor = pal.line;
    card.className = 'pvcard ' + $('sKartu').value;
    btn.style.background = accent;
    btn.style.color = onColor(accent);
  }
  function normalizeWa(v) {
    let s = String(v || '').replace(/\D/g, '');
    if (!s) return '';
    if (s[0] === '0') s = '62' + s.slice(1);
    return s.length >= 9 && s.length <= 15 ? s : null;
  }
  function showLogoPreview(src) {
    const i = $('sLogoPrev');
    if (src) { i.src = src; i.hidden = false; } else { i.hidden = true; }
    $('bLogoDel').hidden = !src;
  }
  async function openSettings() {
    if (!settings) {
      const { data, error } = await sb.from('settings').select('*').eq('owner_id', owner.id).maybeSingle();
      if (error || !data) return toast('Gagal memuat pengaturan. Coba lagi.');
      settings = data;
    }
    const s = settings;
    logoFile = null; logoRemove = false;
    $('sLogo').value = '';
    $('sBrand').value = s.brand_name || '';
    $('sJudul').value = s.judul || '';
    $('sDesk').value = s.deskripsi || '';
    $('sWa').value = s.wa_number || '';
    $('sTema').value = s.tema; $('sMode').value = s.mode;
    $('sWarna').value = s.warna_utama; $('sFont').value = s.font;
    $('sSusun').value = s.susunan; $('sKartu').value = s.gaya_kartu;
    showLogoPreview(s.logo_path ? pub(s.logo_path) : null);
    renderPreview();
    $('modalSet').hidden = false;
  }
  async function saveSettings(e) {
    e.preventDefault();
    const wa = normalizeWa($('sWa').value);
    if (wa === null) return toast('Nomor WhatsApp tidak valid. Contoh: 08123456789');
    const warna = $('sWarna').value;
    if (!/^#[0-9a-f]{6}$/i.test(warna)) return toast('Warna tidak valid.');
    const v = {
      brand_name: $('sBrand').value.trim() || null,
      judul: $('sJudul').value.trim() || null,
      deskripsi: $('sDesk').value.trim() || null,
      wa_number: wa || null,
      tema: $('sTema').value, mode: $('sMode').value, warna_utama: warna,
      font: $('sFont').value, susunan: $('sSusun').value, gaya_kartu: $('sKartu').value
    };
    const btn = $('sSave');
    btn.disabled = true; btn.textContent = 'Menyimpan\u2026';
    let newLogo = null, oldLogo = null;
    try {
      if (logoFile) {
        const c = await compress(logoFile, 400, 200 * 1024);
        const path = owner.id + '/logo-' + crypto.randomUUID() + '.' + c.ext;
        await uploadImage(path, c);
        newLogo = path; v.logo_path = path; oldLogo = settings.logo_path;
      } else if (logoRemove && settings.logo_path) {
        v.logo_path = null; oldLogo = settings.logo_path;
      }
      const { data, error } = await sb.from('settings').update(v).eq('owner_id', owner.id).select();
      if (error || !data || !data.length) {
        await removeFile(newLogo);
        throw new Error('Gagal menyimpan pengaturan.');
      }
      settings = data[0];
      await removeFile(oldLogo);
      $('modalSet').hidden = true;
      toast('Pengaturan disimpan. Muat ulang website untuk melihat hasilnya.');
      refreshQuota();
    } catch (err) {
      toast(err.message || 'Terjadi kesalahan.');
    } finally {
      btn.disabled = false; btn.textContent = 'Simpan';
    }
  }

  /* ===== LOGIN ===== */
  async function boot(session) {
    const uid = session.user.id;
    if (booted === uid) return;
    booted = uid;
    show('sLoad');
    const email = String(session.user.email || '').toLowerCase();
    const { data, error } = await sb.from('owners')
      .select('id,nama_toko,aktif,kuota_bytes,terpakai_bytes').eq('email', email).maybeSingle();
    if (error) return deny('Gagal memeriksa akun. Muat ulang halaman.');
    if (!data) return deny('Email ' + email + ' belum terdaftar. Hubungi admin untuk aktivasi.');
    if (!data.aktif) return deny('Akun ini sedang tidak aktif. Hubungi admin.');
    if (data.id !== C.OWNER_ID) return deny('Akun ini bukan pemilik website ini.');
    owner = data;
    $('brand').textContent = data.nama_toko;
    $('who').textContent = email;
    renderQuota();
    show('sApp');
    await loadItems();
  }
  async function logout() {
    await sb.auth.signOut();
    booted = null; owner = null; settings = null; items = [];
    show('sLogin');
  }

  $('bLogin').onclick = () => sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin + location.pathname }
  });
  $('bOut1').onclick = logout;
  $('bOut2').onclick = logout;
  $('bAdd').onclick = () => openForm(null);
  $('bExp').onclick = exportCsv;
  $('bSet').onclick = openSettings;
  $('bCancel').onclick = () => { $('modal').hidden = true; };
  $('bTest').onclick = testVideo;
  $('fMedia').onchange = syncMedia;
  $('form').onsubmit = submitForm;
  $('sCancel').onclick = () => { $('modalSet').hidden = true; };
  $('formSet').onsubmit = saveSettings;
  ['sTema', 'sMode', 'sWarna', 'sFont', 'sKartu'].forEach((id) => { $(id).onchange = renderPreview; $(id).oninput = renderPreview; });
  $('sLogo').onchange = () => {
    const f = $('sLogo').files[0];
    if (!f) return;
    logoFile = f; logoRemove = false;
    showLogoPreview(URL.createObjectURL(f));
  };
  $('bLogoDel').onclick = () => { logoFile = null; logoRemove = true; $('sLogo').value = ''; showLogoPreview(null); };

  sb.auth.onAuthStateChange((ev, session) => {
    if (session) boot(session);
    else { booted = null; show('sLogin'); }
  });
})();