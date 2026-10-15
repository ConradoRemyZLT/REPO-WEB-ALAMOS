/* ════════════════════════════════════════════════════════════
   Álamos de Añelo · capa de interacción
   (misma lógica que ZLT-WEB-V2, adaptada a cuatro páginas)
   ════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var RM = matchMedia('(prefers-reduced-motion:reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || document).querySelectorAll(s)); };
  var CFG = window.ALAMOS || {};

  /* ── pantalla de carga: se queda hasta que TODO está listo en máxima calidad:
        todas las fotos decodificadas (también las de más abajo), la tipografía
        y el video del banner con datos suficientes para reproducirse de corrido.
        Sin tope de tiempo: sólo un resguardo largo por si un archivo falla sin avisar. ── */
  var PRE = { done: function () { } };
  (function () {
    var pre = $('#pre'), bar = $('#pre .pbar i');
    if (!pre) { document.body.classList.add('ready'); return; }
    var imgs = $$('img'), vids = $$('[data-video],[data-yt]');
    var total = imgs.length + vids.length + 1, n = 0, ended = false;
    function step() { n++; if (bar) bar.style.width = Math.min(100, n / total * 100) + '%'; if (n >= total) finish(); }
    function finish() {
      if (ended) return; ended = true; if (bar) bar.style.width = '100%';
      // el video arranca desde el primer cuadro cuando se levanta la pantalla
      $$('[data-video] video, .vhero video, .phero video').forEach(function (v) { try { v.currentTime = 0; } catch (e) { } });
      (window.__ytPlayers || []).forEach(function (pl) { try { pl.seekTo(0, true); pl.playVideo(); } catch (e) { } });
      setTimeout(function () { document.body.classList.add('ready'); }, 350);
    }
    PRE.done = step;                       // lo llama cada video del banner cuando está listo
    imgs.forEach(function (i) {
      if (i.loading === 'lazy') i.loading = 'eager';   // todas, no sólo las visibles
      var ok = false, fin = function () { if (!ok) { ok = true; step(); } };
      var dec = function () { (i.decode ? i.decode() : Promise.resolve()).then(fin, fin); };
      if (i.complete) dec(); else { i.addEventListener('load', dec); i.addEventListener('error', fin); }
    });
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(step, step);
    setTimeout(finish, 60000);             // resguardo ante un archivo dañado
  })();

  /* ── reveals ── */
  var rio = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('revealed'); rio.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -7% 0px' });
  $$('[data-reveal],.hline,.prog').forEach(function (el) { rio.observe(el); });

  /* ── header ── */
  var hdr = $('#hdr'), last = 0;
  function onScroll() {
    var y = scrollY;
    hdr.classList.toggle('scrolled', y > 40);
    if (!document.body.classList.contains('mopen')) hdr.classList.toggle('hide', y > 480 && y > last + 6);
    last = y;
    var t = $('#top'); if (t) t.classList.toggle('on', y > innerHeight * 0.8);
    var p = $('#prog'), h = document.documentElement.scrollHeight - innerHeight;
    if (p) p.style.transform = 'scaleX(' + (h > 0 ? y / h : 0) + ')';
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  var top = $('#top'); if (top) top.addEventListener('click', function () { scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' }); });

  /* ── parallax suave del banner de página ── */
  var pbg = $('.phero .pbg');
  if (pbg && !RM) addEventListener('scroll', function () {
    var y = scrollY; if (y < innerHeight * 1.2) pbg.style.transform = 'translate3d(0,' + (y * 0.22) + 'px,0)';
  }, { passive: true });

  /* ── contadores ── */
  function animCount(el) {
    var raw = el.dataset.count, m = raw.match(/(\D*)(\d[\d.,]*)(\D*)/);
    if (!m || RM) { el.textContent = raw; return; }
    var pre = m[1], end = parseFloat(m[2].replace(/[.,]/g, '')), post = m[3], t0 = null, dur = 1500;
    (function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3);
      el.textContent = pre + Math.round(end * e).toLocaleString('es-AR') + post;
      if (p < 1) requestAnimationFrame(step); else el.textContent = raw;
    })(performance.now());
  }
  var cio = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { animCount(e.target); cio.unobserve(e.target); } });
  }, { threshold: 0.6 });
  $$('[data-count]').forEach(function (el) { cio.observe(el); });

  /* ── video del banner: el MP4 viaja embebido; se pasa a Blob para
        que Safari lo reproduzca sin problemas con data URIs largos ── */
  $$('[data-video]').forEach(function (hero) {
    var v = $('video', hero), src = hero.getAttribute('data-video'), srcM = hero.getAttribute('data-video-m'), webm = null;
    if (!v || !src) return;
    // en celulares (pantalla vertical) va la versión 9:16 del video
    if (srcM && matchMedia('(orientation:portrait) and (max-width:900px)').matches) src = srcM;
    hero.removeAttribute('data-video'); hero.removeAttribute('data-video-m');
    var started = false;
    function tryPlay() {
      var pr = v.play();
      if (pr && pr.catch) pr.catch(function () {
        // reproducción automática bloqueada: se muestra el botón y arranca con la primera interacción
        hero.classList.add('paused');
        if (v.readyState >= 3) listo(); else v.addEventListener('loadeddata', listo);
        var retry = function () {
          ['pointerdown', 'keydown', 'touchstart', 'scroll', 'wheel'].forEach(function (ev) { removeEventListener(ev, retry); });
          v.play().catch(function () { });
        };
        ['pointerdown', 'keydown', 'touchstart', 'scroll', 'wheel'].forEach(function (ev) { addEventListener(ev, retry, { passive: true }); });
      });
    }
    function go(url) {
      if (started) return; started = true;
      v.muted = true; v.defaultMuted = true; v.playsInline = true; v.autoplay = true; v.loop = true;
      v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.preload = 'auto';
      v.src = url; v.load(); tryPlay();
    }
    var avisado = false, listo = function () { if (!avisado) { avisado = true; PRE.done(); } };
    v.addEventListener('canplaythrough', listo);
    v.addEventListener('playing', function () { hero.classList.add('playing'); hero.classList.remove('paused'); if (v.readyState >= 4) listo(); });
    v.addEventListener('progress', function () { if (v.readyState >= 4) listo(); });
    v.addEventListener('canplay', function () { if (v.paused && !hero.classList.contains('user-paused')) tryPlay(); });
    // si el Blob falla o el navegador rechaza el formato, se prueba con el archivo directo y luego con el otro formato
    v.addEventListener('error', function () {
      if (v.src.indexOf('blob:') === 0) { started = false; go(src); }
      else if (webm && src !== webm && v.src !== webm) { started = false; src = webm; go(webm); }
      else listo();
    });
    // El video es parte central del banner: se reproduce siempre (sin sonido, en bucle),
    // también con "reducir movimiento" activado en el sistema; el botón permite pausarlo.
    try {
      var done = false, once = function (u) { if (!done) { done = true; go(u); } };
      setTimeout(function () { once(src); }, 2500);   // si el Blob tarda, va directo
      fetch(src).then(function (r) { return r.blob(); })
        .then(function (b) { once(URL.createObjectURL(b)); })
        .catch(function () { once(src); });
    } catch (e) { go(src); }
    // botón de sonido: el video arranca sin sonido (autoplay) y se puede activar el audio
    var btn = $('.js-mute', hero);
    if (btn) btn.addEventListener('click', function () {
      if (!started) go(src);
      var on = v.muted;                      // estaba en silencio → activar sonido
      v.muted = !on ? true : false; v.defaultMuted = v.muted;
      if (on) { v.volume = 1; v.play().catch(function () { }); }
      hero.classList.toggle('sound', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-label', on ? 'Silenciar el video' : 'Activar el sonido del video');
    });
    // pausa fuera de pantalla: no gasta batería
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (!v.src) return; if (e.isIntersecting) { if (!hero.classList.contains('user-paused')) v.play().catch(function () { }); } else v.pause(); });
    }, { threshold: 0.2 }).observe(hero);
  });


  /* ── header con video de YouTube (Home): horizontal en compu, short vertical en celular.
        Sin subtítulos, sin sonido al inicio, en bucle y a la mayor calidad que entregue YouTube.
        La pantalla de carga espera a que esté reproduciendo en HD. ── */
  $$('[data-yt]').forEach(function (hero) {
    var id = hero.getAttribute('data-yt'), idM = hero.getAttribute('data-yt-m');
    var vertical = !!idM && matchMedia('(orientation:portrait) and (max-width:900px)').matches;
    if (vertical) id = idM;
    var ratio = vertical ? 9 / 16 : 16 / 9, box = $('.yt-frame', hero), player = null, done = false, made = false;
    function ready() { if (!done) { done = true; PRE.done(); } }
    function fail() { hero.classList.add('yt-fail'); ready(); }
    function size() {
      var f = $('iframe', hero) || box, w = hero.clientWidth, h = hero.clientHeight, W, H;
      if (w / h > ratio) { W = w; H = w / ratio; } else { H = h; W = h * ratio; }
      f.style.width = Math.ceil(W * 1.12) + 'px'; f.style.height = Math.ceil(H * 1.12) + 'px';   // 12% extra: oculta los bordes de YouTube
    }
    size(); addEventListener('resize', size);
    if (location.protocol === 'file:') { fail(); return; }   // YouTube no reproduce desde un archivo abierto en la compu: va la foto
    function noCC() {
      try { player.unloadModule('captions'); } catch (e) { }
      try { player.unloadModule('cc'); } catch (e) { }
      try { player.setOption('captions', 'track', {}); } catch (e) { }
    }
    function waitHD() {
      var t0 = Date.now();
      (function chk() {
        var q = ''; try { q = player.getPlaybackQuality(); } catch (e) { }
        if (/hd720|hd1080|hd1440|hd2160|highres/.test(q) || Date.now() - t0 > 9000) { hero.classList.add('playing'); ready(); }
        else setTimeout(chk, 250);
      })();
    }
    function make() {
      if (made) return; made = true;
      player = new YT.Player(box, {
        videoId: id, host: 'https://www.youtube-nocookie.com',
        playerVars: { autoplay: 1, mute: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, playsinline: 1, rel: 0, cc_load_policy: 0, loop: 1, playlist: id, origin: location.origin, enablejsapi: 1 },
        events: {
          onReady: function (e) { e.target.mute(); noCC(); try { e.target.setPlaybackQuality('highres'); } catch (_) { } e.target.playVideo(); size(); },
          onApiChange: noCC,
          onStateChange: function (e) {
            if (e.data === 1) { noCC(); waitHD(); }
            if (e.data === 0) { e.target.seekTo(0, true); e.target.playVideo(); }
          },
          onError: fail
        }
      });
      (window.__ytPlayers = window.__ytPlayers || []).push(player);
    }
    if (window.YT && window.YT.Player) make();
    else {
      (window.__ytQueue = window.__ytQueue || []).push(make);
      if (!window.__ytLoading) {
        window.__ytLoading = true;
        var prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = function () { if (prev) prev(); (window.__ytQueue || []).forEach(function (f) { f(); }); };
        var sc = document.createElement('script'); sc.src = 'https://www.youtube.com/iframe_api'; sc.async = true; sc.onerror = fail; document.head.appendChild(sc);
      }
    }
    setTimeout(function () { if (!done) fail(); }, 30000);   // resguardo si YouTube no responde
    var btn = $('.js-mute', hero);
    if (btn) btn.addEventListener('click', function () {
      if (!player || !player.isMuted) return;
      var on = player.isMuted();
      if (on) { player.unMute(); player.setVolume(100); player.playVideo(); } else player.mute();
      hero.classList.toggle('sound', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-label', on ? 'Silenciar el video' : 'Activar el sonido del video');
    });
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (!player || !player.playVideo) return; try { if (e.isIntersecting) player.playVideo(); else player.pauseVideo(); } catch (_) { } });
    }, { threshold: 0.2 }).observe(hero);
  });

  /* ── desplegables (etapas y preguntas) ── */
  $$('.ac').forEach(function (ac) {
    var h = $('.ac-h', ac);
    h.setAttribute('aria-expanded', ac.classList.contains('open') ? 'true' : 'false');
    h.addEventListener('click', function () {
      var group = ac.parentElement, open = !ac.classList.contains('open');
      if (group && group.hasAttribute('data-single')) $$('.ac', group).forEach(function (o) { o.classList.remove('open'); $('.ac-h', o).setAttribute('aria-expanded', 'false'); });
      ac.classList.toggle('open', open); h.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });

  /* ── galerías: scroll-snap + arrastre + barra + puntos + lightbox ── */
  var LB = { list: [], i: 0 };
  $$('[data-gallery]').forEach(function (g) {
    var vp = $('.gviewport', g), slides = $$('.gslide', g);
    var cur = $('.gc-cur', g), line = $('.gline i', g), dots = $$('.gdot', g);
    var prev = $('.gprev', g), next = $('.gnext', g), n = slides.length;
    if (!vp || !n) return;
    function index() {
      var c = vp.scrollLeft + vp.clientWidth / 2, best = 0, bd = 1e9;
      slides.forEach(function (s, k) { var d = Math.abs(s.offsetLeft + s.offsetWidth / 2 - c); if (d < bd) { bd = d; best = k; } });
      return best;
    }
    function sync() {
      var i = index();
      slides.forEach(function (s, k) { s.classList.toggle('active', k === i); });
      dots.forEach(function (d, k) { d.classList.toggle('on', k === i); });
      if (cur) cur.textContent = i + 1;
      if (line) { line.style.width = (100 / n) + '%'; line.style.transform = 'translateX(' + (i * 100) + '%)'; }
      if (prev) prev.disabled = i === 0;
      if (next) next.disabled = i === n - 1;
    }
    function go(k) { k = Math.max(0, Math.min(n - 1, k)); vp.scrollTo({ left: slides[k].offsetLeft - (vp.clientWidth - slides[k].offsetWidth) / 2, behavior: RM ? 'auto' : 'smooth' }); }
    if (prev) prev.addEventListener('click', function () { go(index() - 1); });
    if (next) next.addEventListener('click', function () { go(index() + 1); });
    dots.forEach(function (d, k) { d.addEventListener('click', function () { go(k); }); });
    var raf; vp.addEventListener('scroll', function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(sync); }, { passive: true });
    var down = false, sx = 0, sl = 0, moved = 0;
    vp.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch') return; down = true; moved = 0; sx = e.clientX; sl = vp.scrollLeft; vp.classList.add('dragging'); });
    vp.addEventListener('pointermove', function (e) { if (!down) return; var d = e.clientX - sx; moved = Math.abs(d); vp.scrollLeft = sl - d; });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) {
      vp.addEventListener(ev, function () { if (!down) return; down = false; vp.classList.remove('dragging'); requestAnimationFrame(function () { go(index()); }); });
    });
    var imgs = slides.map(function (s) { return $('img', s); });
    slides.forEach(function (s, k) { s.addEventListener('click', function () { if (moved > 6) { moved = 0; return; } LB.list = imgs; LB.i = k; openLB(); }); });
    sync(); addEventListener('resize', sync, { passive: true });
  });
  // imágenes sueltas ampliables (agrupadas por contenedor)
  $$('[data-zoom]').forEach(function (grp) {
    var imgs = $$('img', grp);
    imgs.forEach(function (im, k) { (im.closest('figure') || im).addEventListener('click', function () { LB.list = imgs; LB.i = k; openLB(); }); });
  });
  var lb = $('#lb'), lbImg = lb && $('img', lb), lbC = lb && $('.lbc', lb);
  function paintLB() { var s = LB.list[LB.i]; lbImg.src = s.currentSrc || s.src; lbImg.alt = s.alt || ''; if (lbC) lbC.textContent = (LB.i + 1) + ' / ' + LB.list.length; }
  function openLB() { if (!lb) return; paintLB(); lb.classList.add('on'); document.body.style.overflow = 'hidden'; }
  function closeLB() { lb.classList.remove('on'); document.body.style.overflow = ''; }
  function stepLB(d) { LB.i = (LB.i + d + LB.list.length) % LB.list.length; paintLB(); }
  if (lb) {
    $('.lbx', lb).addEventListener('click', closeLB);
    $('.lbn', lb).addEventListener('click', function (e) { e.stopPropagation(); stepLB(1); });
    $('.lbp', lb).addEventListener('click', function (e) { e.stopPropagation(); stepLB(-1); });
    lb.addEventListener('click', function (e) { if (e.target === lb || e.target === lbImg) closeLB(); });
    addEventListener('keydown', function (e) {
      if (!lb.classList.contains('on')) return;
      if (e.key === 'Escape') closeLB(); if (e.key === 'ArrowRight') stepLB(1); if (e.key === 'ArrowLeft') stepLB(-1);
    });
  }

  /* ── videos de YouTube: fachada; se embebe al hacer clic ── */
  function canEmbed() { try { return window.self === window.top || !!window.top.location.href; } catch (e) { return false; } }
  $$('a[data-embed]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (!canEmbed()) return;
      e.preventDefault();
      var f = document.createElement('iframe');
      f.src = a.getAttribute('data-embed'); f.className = 'ytframe';
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; f.setAttribute('allowfullscreen', '');
      f.title = a.getAttribute('aria-label') || 'Video';
      a.parentElement.replaceChild(f, a);
    });
  });

  /* ── menú móvil ── */
  var mbtn = $('#mbtn');
  if (mbtn) mbtn.addEventListener('click', function () {
    var o = document.body.classList.toggle('mopen'); mbtn.setAttribute('aria-expanded', o ? 'true' : 'false');
  });
  $$('.mov a').forEach(function (a, k) { a.style.transitionDelay = (0.08 + k * 0.035) + 's'; a.addEventListener('click', function () { document.body.classList.remove('mopen'); }); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape') document.body.classList.remove('mopen'); });

  /* ── idioma ── */
  function setLang(l) {
    document.body.classList.toggle('en', l === 'en');
    document.documentElement.lang = l === 'en' ? 'en' : 'es';
    try { localStorage.setItem('alamos-lang', l); } catch (e) { }
    var ls = $('#langsel'); if (ls) ls.classList.remove('open');
    $$('[data-ph-es]').forEach(function (el) { el.placeholder = el.getAttribute(l === 'en' ? 'data-ph-en' : 'data-ph-es'); });
    $$('option[data-en]').forEach(function (o) { if (!o.dataset.es) o.dataset.es = o.textContent; o.textContent = l === 'en' ? o.dataset.en : o.dataset.es; });
  }
  var lb2 = $('#langbtn');
  if (lb2) {
    lb2.addEventListener('click', function (e) { e.stopPropagation(); $('#langsel').classList.toggle('open'); });
    $$('.lang-menu button').forEach(function (b) { b.addEventListener('click', function () { setLang(b.dataset.lang); }); });
    document.addEventListener('click', function (e) { if (!e.target.closest('#langsel')) $('#langsel').classList.remove('open'); });
  }
  try { var q = new URLSearchParams(location.search).get('lang'); var sv = q || localStorage.getItem('alamos-lang'); if (sv === 'en') setLang('en'); } catch (e) { }

  /* ── formularios: arman el mensaje y lo abren en WhatsApp o en el mail ── */
  $$('.ftabs').forEach(function (tabs) {
    var form = tabs.closest('form');
    $$('.ftab', tabs).forEach(function (t) {
      t.addEventListener('click', function () {
        $$('.ftab', tabs).forEach(function (o) { o.classList.toggle('on', o === t); o.setAttribute('aria-selected', o === t ? 'true' : 'false'); });
        $$('.fpane', form).forEach(function (p) { var on = p.dataset.pane === t.dataset.pane; p.hidden = !on; $$('input,select,textarea', p).forEach(function (f) { f.disabled = !on; }); });
        form.dataset.tipo = t.dataset.pane;
      });
    });
    var d = form.dataset.default, dt = d && $('.ftab[data-pane="' + d + '"]', tabs);
    if (dt && !dt.classList.contains('on')) dt.click();
  });
  $$('form.cform').forEach(function (form) {
    $$('.fpane[hidden] input,.fpane[hidden] select,.fpane[hidden] textarea', form).forEach(function (f) { f.disabled = true; });
    function valid() {
      var ok = true;
      $$('[required]', form).forEach(function (f) {
        if (f.disabled) return;
        var bad = !f.value.trim() || (f.type === 'email' && !/^\S+@\S+\.\S+$/.test(f.value.trim()));
        f.closest('.fld').classList.toggle('bad', bad); if (bad) ok = false;
      });
      if (!ok) { var b = $('.fld.bad input,.fld.bad select,.fld.bad textarea', form); if (b) b.focus(); }
      return ok;
    }
    $$('input,select,textarea', form).forEach(function (f) { f.addEventListener('input', function () { var c = f.closest('.fld'); if (c) c.classList.remove('bad'); }); });
    function texto() {
      var en = document.body.classList.contains('en');
      var tipo = form.dataset.tipo || 'consulta';
      var titulo = { inversor: 'Consulta de inversor', empresa: 'Consulta de empresa (alojamiento)', club: 'Consulta sobre Álamos Club', consulta: 'Consulta' }[tipo] || 'Consulta';
      var lines = ['*Álamos de Añelo · ' + titulo + '*', ''];
      $$('.fld', form).forEach(function (c) {
        var f = $('input,select,textarea', c); if (!f || f.disabled || !f.value.trim() || f.classList.contains('hp')) return;
        var lab = (c.querySelector('label .l-es') || c.querySelector('label')).textContent.replace('*', '').trim();
        lines.push(lab + ': ' + f.value.trim());
      });
      lines.push('', 'Enviado desde la web' + (en ? ' (EN)' : ''));
      return { titulo: titulo, cuerpo: lines.join('\n') };
    }
    $$('.fsend', form).forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        if (!valid()) return;
        var t = texto();
        if (b.classList.contains('wa')) {
          window.open('https://wa.me/' + CFG.wa + '?text=' + encodeURIComponent(t.cuerpo), '_blank', 'noopener');
        } else {
          location.href = 'mailto:' + CFG.mail + '?subject=' + encodeURIComponent('Álamos de Añelo · ' + t.titulo) + '&body=' + encodeURIComponent(t.cuerpo.replace(/\*/g, ''));
        }
      });
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); });
  });

  /* ── mapa de ubicación · MapLibre + OpenFreeMap (OpenStreetMap)
        Uso comercial gratuito, sin clave ni límite de vistas; exige atribución
        (se muestra en el control del mapa). https://openfreemap.org ── */
  (function () {
    var el = $('#amap'); if (!el) return;
    var P = CFG.mapa || [];
    function fallback() {
      el.innerHTML = '<div class="map-fallback"><a href="https://www.google.com/maps/search/?api=1&query=' + P[0][0] + ',' + P[0][1] + '" target="_blank" rel="noopener">Ver la ubicación en Google Maps</a></div>';
    }
    if (typeof maplibregl === 'undefined' || !P.length) { fallback(); return; }
    var map;
    try {
      map = new maplibregl.Map({
        container: el, style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [P[0][1], P[0][0]], zoom: 12, scrollZoom: false, dragRotate: false, pitchWithRotate: false,
        attributionControl: { compact: true }, cooperativeGestures: false
      });
    } catch (e) { fallback(); return; }
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    var b = new maplibregl.LngLatBounds();
    var narrow = el.clientWidth < 560;   // celular: etiquetas reacomodadas para que no se pisen
    if (narrow) el.classList.add('narrow');
    P.forEach(function (p) {
      var d = document.createElement('div');
      d.className = 'apin ' + (p[3] || '') + ' lab-' + ((narrow && p[5]) || p[4] || 'right');
      d.innerHTML = '<span></span><em class="alabel">' + p[2] + '</em>';
      new maplibregl.Marker({ element: d, anchor: 'center' }).setLngLat([p[1], p[0]]).addTo(map);
      b.extend([p[1], p[0]]);
    });
    function fit() { map.resize(); map.fitBounds(b, { padding: narrow ? { top: 95, bottom: 70, left: 34, right: 34 } : { top: 70, bottom: 60, left: 70, right: 70 }, maxZoom: 14, duration: 0 }); }
    map.on('load', fit); fit();
    addEventListener('resize', function () { map.resize(); });
    new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) map.resize(); }); }).observe(el);
    window.__amap = map;
  })();

  /* ── masterplan interactivo: cada área abre su tarjeta ── */
  $$('[data-mplan]').forEach(function (mp) {
    var svg = $('.mp-svg', mp), hint = $('.mp-hint', mp), cur = null;
    function show(k) {
      cur = k;
      $$('.mp-a,.mp-chip', mp).forEach(function (e) { e.classList.toggle('on', e.dataset.k === k); });
      $$('.mp-info', mp).forEach(function (c) { c.hidden = c.dataset.k !== k; });
      if (hint) hint.hidden = !!k;
      svg.classList.toggle('active', !!k);
    }
    $$('.mp-a,.mp-chip', mp).forEach(function (e) {
      e.addEventListener('click', function () { show(cur === e.dataset.k && e.classList.contains('mp-a') ? null : e.dataset.k); });
      e.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); show(e.dataset.k); } });
      if (e.classList.contains('mp-a')) e.addEventListener('mouseenter', function () { if (matchMedia('(hover:hover)').matches) show(e.dataset.k); });
    });
  });
})();
