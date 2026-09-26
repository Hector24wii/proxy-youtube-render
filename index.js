const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

let activeNodes = [
  'https://invidious.f5.si',
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://invidious.privacydev.net',
  'https://yt.chocolatemoo53.com'
];

async function scrapeVideoData(baseUrl, videoId) {
  const url = `${baseUrl}/watch?v=${videoId}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36' }
  });
  
  if (!response.ok) throw new Error('Error al acceder al HTML');
  const html = await response.text();
  const $ = cheerio.load(html);

  // Extraer el título evitando el operador || para prevenir errores de codificación
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

  res.status(503).json({ error: 'Servidores de Invidious ocupados. Reintente en unos segundos.' });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Proxy Híbrido (API + Scraping) activo en puerto ${PORT}`));
