// ============================================
// Proxy Invidious - Vista de Video Tipo Youtube (Boceto)
// ============================================

const INITIAL_NODES = [
  'https://invidious.tiekoetter.com',
  'https://invidious.f5.si',
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://yt.chocolatemoo53.com',
  'https://invidious.privacydev.net'
];

const LOGO_SRC = 'https://raw.githubusercontent.com/Hector24wii/ASSETS-FOR-youtube.rec24.workers.dev/main/logo-big.png';
const USUARIOS_URL = 'https://raw.githubusercontent.com/Hector24wii/proxy-youtube-render/refs/heads/main/usuarios.json';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
  'Content-Type': 'application/json;charset=UTF-8'
};

const CSS = `
*{box-sizing:border-box}
body,html{background:#0f0f0f!important;color:#f1f1f1!important;font-family:Arial,sans-serif!important;margin:0}
header,nav,.navbar{background:#121212!important;border-bottom:1px solid #282828!important;padding:8px 12px!important;display:flex;align-items:center;justify-content:space-between}
input[type=text],input[type=search],input[type=password]{background:#121212!important;border:1px solid #333!important;color:#fff!important;border-radius:20px!important;padding:8px 12px!important;font-size:14px!important;max-width:320px;width:100%}
img{max-width:100%!important;height:auto!important}
.thumbnail img,.video-card img,.card img{border-radius:8px!important;max-height:140px!important;object-fit:cover!important;width:100%!important}
.video .title,h3,.card-title{color:#f1f1f1!important;font-size:13px!important;margin:6px 0 2px!important}
.author,.length,.card-author{color:#888!important;font-size:11px!important}
video{border-radius:8px!important;max-width:100%!important}
a{color:#f1f1f1!important;text-decoration:none!important}
button,.pure-button{background:#cc0000!important;color:#fff!important;border:none!important;border-radius:20px!important;padding:6px 14px!important;font-size:13px!important;font-weight:bold;cursor:pointer}
button.secondary{background:#272727!important}
*{animation:none!important;transition:none!important}
`;

function miniaturaLiviana(src) {
  if (!src) return src;
  return src
    .replace('maxresdefault', 'mqdefault')
    .replace('hqdefault', 'mqdefault')
    .replace('sddefault', 'mqdefault')
    .replace('hq720', 'mqdefault');
}

async function servirImagen(rawUrl, request) {
  try {
    let targetUrl = miniaturaLiviana(rawUrl);
    const dest = new URL(targetUrl);

    const res = await fetch(dest.toString(), {
      headers: {
        'Accept': 'image/webp,image/avif,image/*,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) Chrome/122.0.0.0 Mobile'
      },
      cf: { cacheTtl: 86400, cacheEverything: true }
    });

    if (!res.ok) return new Response('', { status: res.status });

    const h = new Headers(res.headers);
    const ct = res.headers.get('content-type') || 'image/jpeg';
    h.set('Content-Type', ct);
    h.set('Cache-Control', 'public, max-age=86400, immutable');
    h.set('Access-Control-Allow-Origin', '*');
    return new Response(res.body, { status: 200, headers: h });
  } catch {
    return new Response('', { status: 502 });
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (path === '/logo.png' || path === '/logo') {
      return servirImagen(LOGO_SRC, request);
    }

    if (path === '/img') {
      const u = url.searchParams.get('u');
      if (!u) return new Response('Falta parámetro u', { status: 400 });
      return servirImagen(u, request);
    }

    if (path === '/login') {
      const email = url.searchParams.get('email');
      const pass = url.searchParams.get('pass');

      if (!email || email.toLowerCase() === 'invitado') {
        return new Response(JSON.stringify({ 
          status: "success", 
          user: { id: "invitado", admin: false } 
        }), { headers: CORS_HEADERS });
      }

      try {
        const resUsers = await fetch(USUARIOS_URL, { cf: { cacheTtl: 300 } });
        if (!resUsers.ok) throw new Error("Error obteniendo usuarios");
        
        const usuarios = await resUsers.json();
        const usuarioEncontrado = usuarios.find(u => 
          (u.email?.toLowerCase() === email.toLowerCase() || u.id?.toLowerCase() === email.toLowerCase()) && 
          u.password_hash === pass
        );

        if (usuarioEncontrado) {
          return new Response(JSON.stringify({
            status: "success",
            user: {
              id: usuarioEncontrado.id,
              email: usuarioEncontrado.email,
              admin: usuarioEncontrado.admin || false
            }
          }), { headers: CORS_HEADERS });
        } else {
          return new Response(JSON.stringify({
            status: "error",
            message: "Credenciales incorrectas"
          }), { status: 401, headers: CORS_HEADERS });
        }
      } catch (e) {
        return new Response(JSON.stringify({
          status: "error",
          message: "Error al validar el usuario"
        }), { status: 500, headers: CORS_HEADERS });
      }
    }

    if (path === '/api') {
      const ep = url.searchParams.get('ep');
      if (!ep) {
        return new Response(JSON.stringify({ error: 'Falta el parámetro ep' }), {
          status: 400,
          headers: CORS_HEADERS
        });
      }

      let cleanEp = ep.startsWith('/api/v1') ? ep : `/api/v1${ep.startsWith('/') ? '' : '/'}${ep}`;

      for (const base of INITIAL_NODES) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);

          const apiRes = await fetch(base + cleanEp, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Linux; Android 10) Chrome/122.0.0.0 Mobile',
              'Accept': 'application/json'
            },
            cf: { cacheTtl: 600, cacheEverything: true }
          });
          clearTimeout(timeout);

          if (apiRes.ok) {
            const data = await apiRes.json();
            return new Response(JSON.stringify(data), {
              headers: { ...CORS_HEADERS, 'Cache-Control': 'public, max-age=600' }
            });
          }
        } catch (_) {}
      }

      return new Response(
        JSON.stringify({ error: 'Servidores no disponibles de momento' }),
        { status: 503, headers: CORS_HEADERS }
      );
    }

    if (path === '/' || path === '') {
      return new Response(renderYouTubeRecPage(LOGO_SRC), {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
    }

    return new Response('Ruta no encontrada', { status: 404 });
  }
};

function renderYouTubeRecPage(logoSrc) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>YouTube Proxy</title>
  <style>
    ${CSS}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f0f0f; color: #fff; }
    
    header { display: flex; gap: 12px; padding: 10px 16px; background: #121212; border-bottom: 1px solid #282828; align-items: center; justify-content: space-between; height: 56px; }
    
    .logo-container { display: flex; align-items: center; gap: 8px; cursor: pointer; flex-shrink: 0; }
    .logo-text { font-size: 1rem; font-weight: bold; white-space: nowrap; }

    .logo-nav img {
      height: 70px !important;
      width: auto !important;
      max-height: 120px !important;
      object-fit: contain !important;
    }

    .logo-login img {
      height: 100px !important;
      width: auto !important;
      max-height: 120px !important;
      object-fit: contain !important;
    }

    .search-box { display: flex; flex: 1; max-width: 450px; gap: 6px; }
    input[type="text"], input[type="password"] { flex: 1; padding: 6px 12px; border-radius: 20px; border: 1px solid #3d3d3d; background: #000; color: #fff; outline: none; font-size: 13px; }
    button { padding: 6px 14px; border-radius: 20px; border: none; background: #cc0000; color: #fff; font-weight: bold; cursor: pointer; font-size: 13px; flex-shrink: 0; }
    .btn-secondary { background: #282828; }
    
    /* VISTA DE GRID EN INICIO / BÚSQUEDA */
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; padding: 20px; }
    .card { background: #181818; border-radius: 10px; overflow: hidden; cursor: pointer; }
    .card img { width: 100%; aspect-ratio: 16/9; object-fit: cover; background: #222; }
    .card-body { padding: 10px; }
    .card-title { font-size: 0.85rem; font-weight: bold; line-height: 1.3; margin-bottom: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .card-author { font-size: 0.75rem; color: #aaa; }
    
    /* INTERFAZ DE REPRODUCCIÓN (SEGUN EL BOCETO) */
    .watch-layout { display: grid; grid-template-columns: 1fr 340px; gap: 20px; padding: 20px; max-width: 1400px; margin: 0 auto; }
    .main-video-container { width: 100%; aspect-ratio: 16/9; background: #000; border-radius: 12px; overflow: hidden; }
    .main-video-container iframe { width: 100%; height: 100%; border: none; }
    .sidebar-videos { display: flex; flex-direction: column; gap: 12px; }
    .side-card { display: flex; gap: 10px; background: #181818; border-radius: 8px; overflow: hidden; cursor: pointer; height: 90px; }
    .side-card img { width: 120px; height: 100%; object-fit: cover; background: #222; flex-shrink: 0; }
    .side-card-body { padding: 8px; display: flex; flex-direction: column; justify-content: center; }
    
    #login-overlay { position: fixed; inset: 0; background: #0f0f0f; display: flex; justify-content: center; align-items: center; z-index: 2000; }
    .login-card { background: #181818; padding: 25px; border-radius: 12px; width: 90%; max-width: 320px; text-align: center; border: 1px solid #282828; }
    .login-card .logo-container { justify-content: center; margin-bottom: 15px; }
    .login-card input { width: 100%; margin-bottom: 10px; }
    .login-card button { width: 100%; margin-bottom: 8px; }

    @media (max-width: 900px) {
      .watch-layout { grid-template-columns: 1fr; }
    }

    @media (max-width: 600px) {
      header { padding: 8px 10px; gap: 8px; height: 50px; }
      .logo-nav img { height: 20px !important; }
      .logo-text { font-size: 0.85rem; }
      .search-box { max-width: 100%; }
      input[type="text"] { font-size: 12px; padding: 5px 10px; }
      button { padding: 5px 10px; font-size: 12px; }
      .grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; padding: 10px; }
    }
  </style>
</head>
<body>

  <!-- MODAL DE AUTENTICACIÓN -->
  <div id="login-overlay">
    <div class="login-card">
      <div class="logo-container logo-login">
        <img src="${logoSrc}" alt="Logo">
        <span class="logo-text"></span>
      </div>
      <input type="text" id="loginUser" placeholder="Correo o usuario">
      <input type="password" id="loginPass" placeholder="Contraseña">
      <button onclick="iniciarSesion()">Iniciar Sesión</button>
      <button class="btn-secondary" onclick="entrarInvitado()">Entrar como Invitado</button>
      <div id="loginMsg" style="color: #ff5555; font-size: 0.8rem; margin-top: 8px;"></div>
    </div>
  </div>

  <!-- BARRA DE NAVEGACIÓN -->
  <header>
    <div class="logo-container logo-nav" onclick="cargar('/trending')">
      <img src="${logoSrc}" alt="Logo">
      <span class="logo-text"></span>
    </div>
    <div class="search-box">
      <input type="text" id="searchInput" placeholder="Buscar..." onkeyup="if(event.key==='Enter') buscar()">
      <button onclick="buscar()">Buscar</button>
    </div>
    <button class="btn-secondary" style="font-size: 0.8rem;" onclick="cerrarSesion()">Salir</button>
  </header>

  <main id="main-content">
    <div class="grid" id="grid">Cargando datos...</div>
  </main>

  <script>
    let cachedVideos = [];

    async function iniciarSesion() {
      const email = document.getElementById('loginUser').value.trim();
      const pass = document.getElementById('loginPass').value.trim();
      const msg = document.getElementById('loginMsg');

      if (!email || !pass) {
        msg.innerText = 'Ingresa usuario y contraseña';
        return;
      }

      msg.innerText = 'Validando...';
      try {
        const res = await fetch('/login?email=' + encodeURIComponent(email) + '&pass=' + encodeURIComponent(pass));
        const data = await res.json();

        if (data.status === 'success') {
          document.getElementById('login-overlay').style.display = 'none';
          cargar('/trending');
        } else {
          msg.innerText = data.message || 'Credenciales incorrectas';
        }
      } catch (e) {
        msg.innerText = 'Error de conexión';
      }
    }

    function entrarInvitado() {
      document.getElementById('login-overlay').style.display = 'none';
      cargar('/trending');
    }

    function cerrarSesion() {
      document.getElementById('login-overlay').style.display = 'flex';
      document.getElementById('loginUser').value = '';
      document.getElementById('loginPass').value = '';
      document.getElementById('loginMsg').innerText = '';
    }

    async function cargar(ep = '/trending') {
      const main = document.getElementById('main-content');
      main.innerHTML = '<div class="grid"><div style="grid-column: 1/-1; text-align:center;">Cargando contenido...</div></div>';

      try {
        const res = await fetch('/api?ep=' + encodeURIComponent(ep));
        const data = await res.json();
        
        if (!data || data.error || !Array.isArray(data)) {
          main.innerHTML = '<div class="grid"><div style="grid-column: 1/-1; text-align:center;">Error al cargar vídeos. Intenta de nuevo.</div></div>';
          return;
        }

        cachedVideos = data;
        main.innerHTML = '<div class="grid" id="grid"></div>';
        const grid = document.getElementById('grid');

        data.forEach(item => {
          if (!item.videoId) return;

          const thumbUrl = 'https://i.ytimg.com/vi/' + item.videoId + '/mqdefault.jpg';

          const card = document.createElement('div');
          card.className = 'card';
          card.onclick = () => verVideo(item.videoId);
          card.innerHTML = \`
            <img 
              src="/img?u=\${encodeURIComponent(thumbUrl)}" 
              alt="thumb" 
              loading="lazy"
            >
            <div class="card-body">
              <div class="card-title">\${item.title || 'Sin título'}</div>
              <div class="card-author">\${item.author || ''}</div>
            </div>
          \`;
          grid.appendChild(card);
        });
      } catch (e) {
        main.innerHTML = '<div class="grid"><div style="grid-column: 1/-1; text-align:center;">Error de conexión con la API.</div></div>';
      }
    }

    function buscar() {
      const q = document.getElementById('searchInput').value.trim();
      if (q) cargar('/search?q=' + encodeURIComponent(q));
    }

    function verVideo(id) {
      const main = document.getElementById('main-content');
      
      // Filtramos la lista lateral para no repetir el video actual
      const rels = cachedVideos.filter(v => v.videoId && v.videoId !== id);

      let sideHtml = '';
      rels.forEach(item => {
        const thumbUrl = 'https://i.ytimg.com/vi/' + item.videoId + '/mqdefault.jpg';
        sideHtml += \`
          <div class="side-card" onclick="verVideo('\${item.videoId}')">
            <img src="/img?u=\${encodeURIComponent(thumbUrl)}" alt="thumb">
            <div class="side-card-body">
              <div class="card-title">\${item.title || 'Sin título'}</div>
              <div class="card-author">\${item.author || ''}</div>
            </div>
          </div>
        \`;
      });

      // Construye la interfaz exactamente como en el boceto
      main.innerHTML = \`
        <div class="watch-layout">
          <div class="main-video-container">
            <iframe src="https://invidious.tiekoetter.com/embed/\${id}?autoplay=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>
          </div>
          <div class="sidebar-videos">
            \${sideHtml}
          </div>
        </div>
      \`;
    }
  </script>
</body>
</html>`;
}
