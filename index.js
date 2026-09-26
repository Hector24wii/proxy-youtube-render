const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Lista de instancias activas de Invidious (Sin inv.tux.pizza)
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net/api/v1',
  'https://invidious.nerdvpn.de/api/v1',
  'https://invidious.flokinet.to/api/v1',
  'https://invidious.privacydev.net/api/v1',
  'https://invidious.tiekoetter.com/api/v1',
  'https://invidious.projectsegfau.lt/api/v1'
];

app.get('/api', async (req, res) => {
  const ep = req.query.ep;
  if (!ep) return res.status(400).json({ error: 'Falta el parámetro ep' });

  // Normalizar el endpoint para asegurar la ruta de Invidious
  let cleanEp = ep;
  if (cleanEp.startsWith('/api/v1')) {
    cleanEp = cleanEp.replace('/api/v1', '');
  }

  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const controller = new AbortController();
      // Si la instancia no responde en 2s, salta inmediatamente a la siguiente
      const timeout = setTimeout(() => controller.abort(), 2000);

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
      // Si la instancia actual falla o da timeout, continúa con la siguiente
      continue;
    }
  }

  res.status(503).json({ error: 'Todas las instancias de Invidious están ocupadas' });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Proxy Invidious corriendo en puerto ${PORT}`));
