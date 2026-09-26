const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Lista de respaldo con instancias que SÍ tienen la API pública activa actualmente
let dynamicInstances = [
  'https://invidious.f5.si',
  'https://invidious.projectsegfau.lt',
  'https://invidious.privacydev.net',
  'https://inv.privacy.com.de'
];

// Filtrar dinámicamente usando la API oficial
async function updateInstances() {
  try {
    const res = await fetch('https://api.invidious.io/instances.json?sort_by=type,users');
    if (res.ok) {
      const data = await res.json();
      // FILTRO CLAVE: Solo guardar dominios HTTPS que tengan api: true
      const online = data
        .filter(item => item[1] && item[1].type === 'https' && item[1].api === true)
        .map(item => item[1].uri.replace(/\/$/, ''));

      if (online.length > 0) {
        dynamicInstances = online;
        console.log(`[OK] ${dynamicInstances.length} instancias con API activa encontradas:`, dynamicInstances);
      }
    }
  } catch (err) {
    console.log('[WARN] Usando lista de respaldo local para Invidious.');
  }
}

// Ejecutar al iniciar y actualizar cada 10 minutos
updateInstances();
setInterval(updateInstances, 10 * 60 * 1000);

app.get('/api', async (req, res) => {
  const ep = req.query.ep;
  if (!ep) return res.status(400).json({ error: 'Falta el parámetro ep' });

  // Normalizar endpoint de Piped a Invidious
  let cleanEp = ep;
  if (cleanEp.startsWith('/streams/')) {
    const videoId = cleanEp.replace('/streams/', '');
    cleanEp = `/api/v1/videos/${videoId}`;
  } else if (!cleanEp.startsWith('/api/v1')) {
    cleanEp = `/api/v1${cleanEp.startsWith('/') ? '' : '/'}${cleanEp}`;
  }

  for (const base of dynamicInstances) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const targetUrl = base + cleanEp;

      const response = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
    } catch (e) {
      continue;
    }
  }

  res.status(503).json({ error: 'Sin respuesta de las APIs de Invidious activas.' });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Proxy Invidious con filtro API activo en puerto ${PORT}`));
