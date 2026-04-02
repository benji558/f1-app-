const path = require('path');
const os = require('os');
const express = require('express');

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

function lanV4Urls(port) {
  const urls = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      const v4 = net.family === 'IPv4' || net.family === 4;
      if (v4 && !net.internal) urls.push(`http://${net.address}:${port}`);
    }
  }
  return urls;
}

/**
 * @param {{ rootDir?: string, envPath?: string, port?: number, host?: string, quiet?: boolean }} opts
 * @returns {Promise<{ port: number, close: () => Promise<void> }>}
 */
function startServer(opts = {}) {
  const rootDir = path.resolve(opts.rootDir || __dirname);
  const envPath = opts.envPath
    ? path.resolve(opts.envPath)
    : path.join(rootDir, '.env');
  require('dotenv').config({ path: envPath, override: true });

  const PORT = Number(opts.port ?? process.env.PORT) || 3456;
  const HOST = opts.host ?? (process.env.HOST || '0.0.0.0');
  const quiet = Boolean(opts.quiet);

  const ex = express();
  ex.use(express.json({ limit: '200kb' }));
  ex.use(express.static(rootDir));

  ex.get('/', (_req, res) => {
    res.sendFile(path.join(rootDir, 'f1_setup_manager.html'));
  });

  ex.post('/api/ai-setup', async (req, res) => {
    const bodyIn = req.body || {};
    const apiKey = typeof bodyIn.apiKey === 'string' ? bodyIn.apiKey.trim() : '';
    if (!apiKey) {
      return res.status(401).json({
        error:
          'No API key. Add your Anthropic key in the app (🔑 API KEY). The server does not supply a shared key.',
      });
    }

    const { system, message, model, max_tokens: maxTok } = bodyIn;
    if (typeof system !== 'string' || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Body must include string fields: system, message' });
    }

    const maxTokens = Number(maxTok);
    const max_tokens = Number.isFinite(maxTokens) ? Math.min(4096, Math.max(256, Math.floor(maxTokens))) : 1000;

    const body = {
      model: typeof model === 'string' && model.trim() ? model.trim() : 'claude-sonnet-4-20250514',
      max_tokens,
      system,
      messages: [{ role: 'user', content: message }],
    };

    try {
      const r = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey.trim(),
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      const data = await r.json();
      if (!r.ok) {
        const msg =
          data?.error?.message ||
          (typeof data?.error === 'string' ? data.error : null) ||
          `Anthropic HTTP ${r.status}`;
        return res.status(r.status >= 400 && r.status < 600 ? r.status : 502).json({ error: msg, detail: data });
      }

      return res.json(data);
    } catch (e) {
      console.error(e);
      return res.status(502).json({ error: e.message || 'Upstream request failed' });
    }
  });

  return new Promise((resolve, reject) => {
    const srv = ex.listen(PORT, HOST, () => {
      if (!quiet) {
        console.log(`F1 Setup Manager: http://localhost:${PORT}`);
        const lan = lanV4Urls(PORT);
        if (lan.length) console.log('Phone (same Wi‑Fi): open one of →', lan.join('  |  '));
        console.log(`Loading .env from: ${envPath}`);
      }
      resolve({
        port: PORT,
        close: () =>
          new Promise((res, rej) => {
            srv.close((err) => (err ? rej(err) : res()));
          }),
      });
    });
    srv.on('error', reject);
  });
}

if (require.main === module) {
  startServer({ rootDir: __dirname, envPath: path.join(__dirname, '.env') }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { startServer, lanV4Urls };
