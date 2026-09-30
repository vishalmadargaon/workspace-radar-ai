import express from 'express';
import { createServer as createViteServer } from 'vite';
import { scrapeRealBusinessContacts } from './src/scraper';
import { runGeminiLeadDiscovery } from './src/geminiScraper';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: '10mb' }));

  // CORS middleware for safety
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Single business live scraper endpoint
  app.post('/api/scrape', async (req, res) => {
    try {
      const { url, name, city } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Business name is required' });
      }

      const result = await scrapeRealBusinessContacts(url || '', name, city || 'Mumbai');
      return res.json(result);
    } catch (err: any) {
      console.error('Scrape error:', err);
      return res.status(500).json({ error: err.message || 'Scrape failed' });
    }
  });

  // Batch live scraper endpoint with controlled concurrency
  app.post('/api/scrape-batch', async (req, res) => {
    try {
      const { leads, city } = req.body;
      if (!Array.isArray(leads) || leads.length === 0) {
        return res.status(400).json({ error: 'Leads array required' });
      }

      const results = [];
      const concurrency = 4;

      for (let i = 0; i < leads.length; i += concurrency) {
        const chunk = leads.slice(i, i + concurrency);
        const chunkResults = await Promise.all(
          chunk.map(lead => scrapeRealBusinessContacts(lead.website || '', lead.name, city || lead.city || 'Mumbai'))
        );
        results.push(...chunkResults);
      }

      return res.json({ results });
    } catch (err: any) {
      console.error('Batch scrape error:', err);
      return res.status(500).json({ error: err.message || 'Batch scrape failed' });
    }
  });

  // Gemini Brain Autonomous Lead Discovery & Scraping Endpoint
  app.post('/api/gemini/discover-leads', async (req, res) => {
    try {
      const { city, target, count } = req.body;
      const parsedCount = Math.max(1, Math.min(200, parseInt(count, 10) || 30));
      const result = await runGeminiLeadDiscovery(city || 'Mumbai', target || 'Potential coworking customers', parsedCount);
      return res.json(result);
    } catch (err: any) {
      console.error('Gemini discovery error:', err);
      return res.status(500).json({ error: err.message || 'Lead discovery failed' });
    }
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Mount Vite middleware in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
