const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Lista inicial de instancias
let activeNodes = [
  'https://invidious.f5.si',
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://yt.chocolatemoo53.com',
  'https://invidious.privacydev.net'
];

// Actualizar lista de nodos desde api.invidious.io periódicamente
async function updateNodes() {
  try {
    const res = await fetch('https://api.invidious.io/instances.json?sort_by=type,health');
    if (res.ok) {
      const data = await res.json();
      const onlineNodes = data
        .filter(item => item[1] && item[1].type === 'https' && item[1].monitor && !item[1].monitor.down)
        .map(item => item[1].uri);

      if (onlineNodes.length > 0) {
        activeNodes = Array.from(new Set([...onlineNodes, ...activeNodes]));
      }
    }
  } catch (e) {
    // Mantener la lista estática si falla la consulta
  }
}

// Ejecutar actualización al iniciar y cada 15 minutos
updateNodes();
setInterval(updateNodes, 15 * 60 * 1000);

// Extraer datos del video directamente desde la página HTML
async function scrapeVideoData(baseUrl, videoId) {
  const url = `${baseUrl}/watch?v=${videoId}`;
  const response = await fetch(url, {
    headers: { 
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36' 
    }
  });

  if (!response.ok) throw new Error('Error al obtener el HTML');
  const html = await response.text();
  const $ = cheerio.load(html);

  let title = $('meta[property="og:title"]').attr('content');
  if (!title) title = $('#searchbox').val();
  if (!title) title = '';

  const description = $('#description').text().trim();

  const formatStreams = [];
  $('video source').each((i, el) => {
    const src = $(el).attr('src');
    const type = $(el).attr('type');
    if (src) {
      const fullSrc = src.startsWith('http') ? src : `${baseUrl}${src}`;
      const streamType = type ? type : 'video/mp4';
      const quality = $(el).attr('title') ?$(el).attr('title') : '720p';

      formatStreams.push({
        url: fullSrc,
        mimeType: streamType,
        qualityLabel: quality
      });
    }
  });

  return {
    title,
    description,
    videoId,
    formatStreams
  };
}

// ENDPOINT DE INSTANCIAS: Soporta GET /instances.json y /api/v1/instances
app.get(['/instances.json', '/api/v1/instances'], (req, res) => {
  const instancesFormatted = activeNodes.map(uri => {
    const domain = uri.replace('https://', '').replace('http://', '');
    return [
      domain,
      {
        uri: uri,
        type: 'https',
        api: true,
        cors: true
      }
    ];
  });
  res.json(instancesFormatted);
});

// ENDPOINT PRINCIPAL PROXY: /api?ep=...
app.get('/api', async (req, res) => {
  const ep = req.query.ep;
  if (!ep) return res.status(400).json({ error: 'Falta el parámetro ep' });

  let videoId = null;
  if (ep.includes('/videos/')) {
    videoId = ep.split('/videos/')[1];
  } else if (ep.includes('/streams/')) {
    videoId = ep.replace('/streams/', '');
  }

  let cleanEp = ep.startsWith('/streams/') ? `/api/v1/videos/${videoId}` : ep;
  if (!cleanEp.startsWith('/api/v1')) {
    cleanEp = `/api/v1${cleanEp.startsWith('/') ? '' : '/'}${cleanEp}`;
  }

  // 1. Intentar llamadas mediante API
  for (const base of activeNodes) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);

      const response = await fetch(base + cleanEp, {
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

  // 2. Fallback mediante scraping directo del HTML
  if (videoId) {
    for (const base of activeNodes) {
      try {
        const data = await scrapeVideoData(base, videoId);
        if (data.formatStreams.length > 0) {
          return res.json(data);
        }
      } catch (e) {
        continue;
      }
    }
  }

  res.status(503).json({ error: 'No se pudo obtener información del video en ninguna instancia.' });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
