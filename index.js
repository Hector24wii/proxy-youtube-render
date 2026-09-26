const express = require('express');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 10000;

// Lista de servidores Piped e Invidious estables
const SERVIDORES = [
  'https://pipedapi.lunar.icu',
  'https://pipedapi.r33.moe',
  'https://inv.tux.pizza',
  'https://invidious.drgns.space'
];

app.get('/api', async (req, res) => {
  const ep = req.query.ep;
  if (!ep) return res.status(400).json({ error: 'Falta parametro ep' });

  for (const base of SERVIDORES) {
    try {
      const response = await fetch(base + ep, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });

      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
    } catch (e) {}
  }

  res.status(503).json({ error: 'No se pudo conectar a ningun servidor' });
});

app.listen(PORT, () => {
  console.log(`Proxy corriendo en puerto ${PORT}`);
});
