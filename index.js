const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());

// Instancias de Invidious (incluyendo invidious.tiekoetter.com)
const INVIDIOUS_INSTANCES = [
  'https://invidious.tiekoetter.com/api/v1',
  'https://inv.nadeko.net/api/v1',
  'https://invidious.flokinet.to/api/v1',
  'https://invidious.drgns.space/api/v1'
];

app.get('/api', async (req, res) => {
  const ep = req.query.ep;
  if (!ep) return res.status(400).json({ error: 'Falta el parámetro ep' });

  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000); // Límite de espera de 4s

      const response = await fetch(instance + ep, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
    } catch (e) {
      // Si tiekoetter o la instancia actual fallan, salta automáticamente a la siguiente
      continue;
    }
  }

  res.status(503).json({ error: 'No se pudo conectar a ninguna instancia' });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Proxy corriendo en puerto ${PORT}`));
