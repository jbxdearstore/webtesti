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

  let owner = null, items = [], booted = null;

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
  async function compress(file) {
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
    const sc = Math.min(1, 1080 / img.naturalWidth);
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(img.naturalWidth * sc));
    cv.height = Math.max(1, Math.round(img.naturalHeight * sc));
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    const types = [['image/webp', 'webp'], ['image/jpeg', 'jpg']];
    for (const [type, ext] of types) {
      for (const q of [0.8, 0.65, 0.5, 0.35]) {
        const b = await toBlob(cv, type, q);
        if (!b || b.type !== type) break;
        if (b.size <= 900 * 1024) return { blob: b, ext, type };
      }
    }
    throw new Error('Foto terlalu besar. Coba foto yang lebih kecil.');
  }

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
  function rowEl(t) {
    const r = h('div', 'item' + (t.tampil ? '' : ' off'));
    r.appendChild(thumbEl(t));
    const m = h('div', 'meta');
    m.appendChild(h('div', 'nm', t.nama_customer));
    m.appendChild(h('div', 'muted small', '\u2605'.repeat(t.rating) + ' \u00B7 ' + (t.label || 'tanpa label') + ' \u00B7 ' + (t.tampil ? 'Tampil' : 'Disembunyikan')));
    if (t.teks) m.appendChild(h('div', 'snip', t.teks.length > 90 ? t.teks.slice(0, 90) + '\u2026' : t.teks));
    r.appendChild(m);
    const a = h('div', 'acts');
    const b1 = h('button', 'btn ghost sm', t.tampil ? 'Sembunyikan' : 'Tampilkan');
    b1.onclick = () => toggle(t);
    const b2 = h('button', 'btn danger sm', 'Hapus');
    b2.onclick = () => del(t);
    a.appendChild(b1); a.appendChild(b2);
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
    if (t.media_path) await sb.storage.from(BUCKET).remove([t.media_path]);
    items = items.filter((x) => x.id !== t.id);
    renderRows(); refreshQuota(); toast('Testimoni dihapus.');
  }

  /* ===== FORM TAMBAH ===== */
  const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  function syncMedia() {
    const v = $('fMedia').value;
    $('boxFoto').hidden = v !== 'foto';
    $('boxVideo').hidden = v !== 'video';
  }
  function openForm() {
    $('form').reset();
    $('fTgl').value = today();
    $('vstat').textContent = '';
    syncMedia();
    $('modal').hidden = false;
  }
  async function submitForm(e) {
    e.preventDefault();
    const nama = $('fNama').value.trim();
    const teks = $('fTeks').value.trim();
    const type = $('fMedia').value;
    if (!nama) return toast('Nama customer wajib diisi.');
    if (!teks && type === 'none') return toast('Isi teks testimoni atau tambahkan media.');
    const row = {
      owner_id: owner.id, nama_customer: nama, label: $('fLabel').value.trim() || null,
      rating: parseInt($('fRating').value, 10), teks: teks || null, media_type: 'none'
    };
    if ($('fTgl').value) row.tanggal = $('fTgl').value;
    const btn = $('bSave');
    btn.disabled = true; btn.textContent = 'Menyimpan\u2026';
    let path = null;
    try {
      if (type === 'foto') {
        const f = $('fFile').files[0];
        if (!f) throw new Error('Pilih foto dulu.');
        const c = await compress(f);
        path = owner.id + '/' + crypto.randomUUID() + '.' + c.ext;
        const up = await sb.storage.from(BUCKET).upload(path, c.blob, { contentType: c.type, cacheControl: '31536000' });
        if (up.error) {
          path = null;
          throw new Error(/kuota/i.test(up.error.message) ? 'Kuota penyimpanan penuh. Hapus foto lama dulu.' : 'Gagal mengunggah foto: ' + up.error.message);
        }
        row.media_type = 'foto'; row.media_path = path;
      } else if (type === 'video') {
        const u = $('fVideo').value.trim();
        if (!parseVideo(u)) throw new Error('Link video tidak valid.');
        row.media_type = 'video'; row.video_url = u;
      }
      const ins = await sb.from('testimonials').insert(row);
      if (ins.error) {
        if (path) await sb.storage.from(BUCKET).remove([path]);
        throw new Error('Gagal menyimpan: ' + ins.error.message);
      }
      $('modal').hidden = true;
      toast('Testimoni disimpan.');
      await loadItems(); refreshQuota();
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
    booted = null; owner = null;
    show('sLogin');
  }

  $('bLogin').onclick = () => sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin + location.pathname }
  });
  $('bOut1').onclick = logout;
  $('bOut2').onclick = logout;
  $('bAdd').onclick = openForm;
  $('bCancel').onclick = () => { $('modal').hidden = true; };
  $('bTest').onclick = testVideo;
  $('fMedia').onchange = syncMedia;
  $('form').onsubmit = submitForm;

  sb.auth.onAuthStateChange((ev, session) => {
    if (session) boot(session);
    else { booted = null; show('sLogin'); }
  });
})();