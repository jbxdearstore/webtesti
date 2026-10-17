(function () {
  var C = window.APP_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };

  /* ===== TEMA (5 preset, masing-masing terang & gelap) ===== */
  var THEMES = {
    wall:  { terang: { bg: '#FBF3E4', surface: '#FFFDF8', text: '#2B2118', muted: '#7A6A58', line: '#EADBC2' },
             gelap:  { bg: '#1F1913', surface: '#2A221A', text: '#F6EBDD', muted: '#B7A48D', line: '#3B3126' } },
    fresh: { terang: { bg: '#F3FBF8', surface: '#FFFFFF', text: '#12302A', muted: '#5B7F77', line: '#D5EEE6' },
             gelap:  { bg: '#0F1F1C', surface: '#162B26', text: '#E6F7F2', muted: '#8DB5AA', line: '#244139' } },
    pop:   { terang: { bg: '#FFF6B8', surface: '#FFFFFF', text: '#111111', muted: '#444444', line: '#111111' },
             gelap:  { bg: '#18181B', surface: '#27272A', text: '#FAFAFA', muted: '#A1A1AA', line: '#FAFAFA' } },
    ocean: { terang: { bg: '#EEF5FF', surface: '#FFFFFF', text: '#0F2A4A', muted: '#58729A', line: '#D3E2F7' },
             gelap:  { bg: '#0B1626', surface: '#122340', text: '#E5EEFB', muted: '#8CA6CC', line: '#1F3860' } },
    noir:  { terang: { bg: '#F4F4F2', surface: '#FFFFFF', text: '#161616', muted: '#6B6B6B', line: '#E2E2DE' },
             gelap:  { bg: '#0E0E0E', surface: '#1A1A1A', text: '#F2F2F2', muted: '#9A9A9A', line: '#2C2C2C' } }
  };
  var FONTS = {
    poppins:  ["'Poppins',sans-serif", 'Poppins:wght@400;600;800'],
    inter:    ["'Inter',sans-serif", 'Inter:wght@400;600;800'],
    nunito:   ["'Nunito',sans-serif", 'Nunito:wght@400;600;800'],
    playfair: ["'Playfair Display',serif", 'Playfair+Display:wght@400;600;800'],
    space:    ["'Space Grotesk',sans-serif", 'Space+Grotesk:wght@400;600;700']
  };
  var KARTU = ['bulat', 'kotak', 'polaroid'];
  var SUSUNAN = ['grid', 'masonry', 'slider'];

  /* ===== UTIL ===== */
  function h(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function api(path) {
    return fetch(C.SUPABASE_URL + '/rest/v1/' + path, {
      headers: { apikey: C.SUPABASE_KEY, Authorization: 'Bearer ' + C.SUPABASE_KEY }
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function pub(p) {
    return C.SUPABASE_URL + '/storage/v1/object/public/testimoni/' +
      String(p).split('/').map(encodeURIComponent).join('/');
  }
  function onColor(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '#fff';
    var n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? '#111' : '#fff';
  }
  function fmtDate(d) {
    if (!d) return '';
    var x = new Date(d + 'T00:00:00');
    return isNaN(x) ? '' : x.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function waLink(num, brand) {
    var n = String(num || '').replace(/\D/g, '');
    if (!n) return null;
    if (n[0] === '0') n = '62' + n.slice(1);
    return 'https://wa.me/' + n + '?text=' + encodeURIComponent('Halo ' + brand + ', saya mau order');
  }

  /* ===== TERAPKAN TEMA ===== */
  function applyTheme(s) {
    var key = THEMES[s.tema] ? s.tema : 'wall';
    var pal = THEMES[key][s.mode === 'gelap' ? 'gelap' : 'terang'];
    var root = document.documentElement.style;
    for (var k in pal) root.setProperty('--' + k, pal[k]);
    var accent = /^#[0-9a-f]{6}$/i.test(s.warna_utama || '') ? s.warna_utama : '#E8590C';
    root.setProperty('--accent', accent);
    root.setProperty('--on-accent', onColor(accent));
    var f = FONTS[s.font] || FONTS.poppins;
    root.setProperty('--font', f[0]);
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + f[1] + '&display=swap';
    document.head.appendChild(l);
    document.body.dataset.tema = key;
    document.body.dataset.kartu = KARTU.indexOf(s.gaya_kartu) > -1 ? s.gaya_kartu : 'bulat';
    $('list').dataset.susunan = SUSUNAN.indexOf(s.susunan) > -1 ? s.susunan : 'grid';
    document.querySelector('meta[name=theme-color]').content = pal.bg;
  }

  /* ===== VIDEO ===== */
  function parseVideo(u) {
    u = String(u || '').trim();
    var m;
    if ((m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/))) return { k: 'yt', id: m[1] };
    if ((m = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/))) return { k: 'drive', id: m[1] };
    if ((m = u.match(/drive\.google\.com\/open\?(?:.*&)?id=([\w-]+)/))) return { k: 'drive', id: m[1] };
    if (/^https?:\/\//i.test(u)) return { k: 'mp4', url: u };
    return null;
  }
  function videoNode(v) {
    var e;
    if (v.k === 'yt' || v.k === 'drive') {
      e = h('iframe');
      e.src = v.k === 'yt'
        ? 'https://www.youtube-nocookie.com/embed/' + v.id + '?autoplay=1&rel=0'
        : 'https://drive.google.com/file/d/' + v.id + '/preview';
      e.allow = 'autoplay; encrypted-media; picture-in-picture';
      e.allowFullscreen = true;
      return e;
    }
    e = h('video');
    e.src = v.url;
    e.controls = true;
    e.autoplay = true;
    e.playsInline = true;
    return e;
  }

  /* ===== LIGHTBOX ===== */
  function openLB(node) { $('lbbox').replaceChildren(node); $('lb').classList.add('open'); }
  function closeLB() { $('lb').classList.remove('open'); $('lbbox').replaceChildren(); }

  /* ===== KARTU ===== */
  function mediaEl(t) {
    var w, i;
    if (t.media_type === 'foto' && t.media_path) {
      w = h('div', 'media');
      i = h('img');
      i.loading = 'lazy';
      i.alt = 'Testimoni dari ' + t.nama_customer;
      i.src = pub(t.media_path);
      w.appendChild(i);
      w.onclick = function () { var x = h('img'); x.src = i.src; x.alt = i.alt; openLB(x); };
      return w;
    }
    if (t.media_type === 'video' && t.video_url) {
      var v = parseVideo(t.video_url);
      if (!v) return null;
      w = h('div', 'media vid');
      if (v.k === 'yt') {
        i = h('img');
        i.loading = 'lazy';
        i.alt = 'Video testimoni';
        i.src = 'https://img.youtube.com/vi/' + v.id + '/hqdefault.jpg';
        w.appendChild(i);
      } else if (v.k === 'mp4') {
        var e = h('video');
        e.src = v.url + '#t=0.5';
        e.preload = 'metadata';
        e.muted = true;
        e.playsInline = true;
        w.appendChild(e);
      }
      w.appendChild(h('span', 'play', '\u25B6'));
      w.onclick = function () { openLB(videoNode(v)); };
      return w;
    }
    return null;
  }
  function card(t) {
    var c = h('article', 'card');
    var m = mediaEl(t);
    if (m) c.appendChild(m);
    var b = h('div', 'body');
    var r = Math.max(0, Math.min(5, parseInt(t.rating, 10) || 0));
    b.appendChild(h('div', 'stars', '\u2605'.repeat(r) + '\u2606'.repeat(5 - r)));
    if (t.teks) b.appendChild(h('p', 'text', t.teks));
    var who = h('div', 'who');
    var l = h('div');
    l.appendChild(h('div', 'name', t.nama_customer));
    if (t.label) l.appendChild(h('div', 'tag', t.label));
    who.appendChild(l);
    who.appendChild(h('div', 'date', fmtDate(t.tanggal)));
    b.appendChild(who);
    c.appendChild(b);
    return c;
  }

  /* ===== RENDER ===== */
  function render(s, list) {
    var brand = s.brand_name || 'Testimoni';
    document.title = s.judul || brand;
    if (s.logo_path) { var lg = $('logo'); lg.src = pub(s.logo_path); lg.alt = brand; lg.hidden = false; }
    $('title').textContent = s.judul || ('Testimoni ' + brand);
    $('desc').textContent = s.deskripsi || '';
    $('desc').hidden = !s.deskripsi;
    var n = list.length;
    var avg = n ? list.reduce(function (a, t) { return a + (t.rating || 0); }, 0) / n : 0;
    $('stats').replaceChildren(h('div', 'stat', n + ' Testimoni'));
    if (n) $('stats').appendChild(h('div', 'stat', '\u2605 ' + avg.toFixed(1)));
    var wa = waLink(s.wa_number, brand);
    if (wa) ['wabtn', 'wafloat'].forEach(function (id) { $(id).href = wa; $(id).hidden = false; });
    $('hero').hidden = false;
    $('list').replaceChildren.apply($('list'), list.map(card));
    if (n) { $('state').hidden = true; } else { $('state').textContent = 'Belum ada testimoni.'; }
    $('fbrand').textContent = brand;
    $('yr').textContent = new Date().getFullYear();
  }

  function main() {
    var st = $('state');
    if (!C.SUPABASE_URL || !C.OWNER_ID) { st.textContent = 'Konfigurasi website belum lengkap.'; return; }
    Promise.all([
      api('settings?select=*&owner_id=eq.' + encodeURIComponent(C.OWNER_ID)),
      api('testimonials?select=*&owner_id=eq.' + encodeURIComponent(C.OWNER_ID) + '&order=urutan.asc,tanggal.desc,dibuat.desc')
    ]).then(function (res) {
      var s = res[0][0];
      if (!s) { st.textContent = 'Layanan ini sedang tidak aktif.'; return; }
      applyTheme(s);
      render(s, res[1]);
    }).catch(function () {
      st.textContent = 'Gagal memuat testimoni. Coba muat ulang halaman.';
    });
  }

  $('lb').addEventListener('click', function (e) {
    if (e.target === $('lb') || e.target.classList.contains('x')) closeLB();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLB(); });
  main();
})();