const express = require('express');
const cors = require('cors');
const { exec, spawn } = require('child_process');
const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = 3838;
const OLLAMA_BASE = 'http://127.0.0.1:11434';

// Persistence setup
const DATA_DIR = path.join(os.homedir(), '.ollamaui-data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

function readJSON(file, defaultVal) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return defaultVal; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// ─── HEALTH ───────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', ollama: OLLAMA_BASE, uptime: process.uptime(), version: '2.0.0' });
});

// ─── OLLAMA PROXY HELPERS ─────────────────────────────────────────────────────
function ollamaGet(path, res) {
  http.get(`${OLLAMA_BASE}${path}`, (oRes) => {
    let data = '';
    oRes.on('data', c => data += c);
    oRes.on('end', () => {
      try { res.json(JSON.parse(data)); }
      catch { res.status(500).json({ error: 'Parse error' }); }
    });
  }).on('error', () => res.status(503).json({ error: 'Ollama not reachable' }));
}

function ollamaStream(endpoint, body, res) {
  const bodyStr = JSON.stringify(body);
  const opts = {
    hostname: '127.0.0.1', port: 11434, path: endpoint, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }
  };
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  const req = http.request(opts, oRes => {
    oRes.on('data', chunk => res.write(chunk));
    oRes.on('end', () => res.end());
  });
  req.on('error', () => res.status(503).end(JSON.stringify({ error: 'Ollama not reachable' })));
  req.write(bodyStr);
  req.end();
}

// ─── OLLAMA ENDPOINTS ─────────────────────────────────────────────────────────
app.get('/api/models', (req, res) => ollamaGet('/api/tags', res));
app.get('/api/ps', (req, res) => ollamaGet('/api/ps', res));
app.get('/api/ollama-version', (req, res) => ollamaGet('/api/version', res));

app.post('/api/chat', (req, res) => ollamaStream('/api/chat', req.body, res));
app.post('/api/generate', (req, res) => ollamaStream('/api/generate', req.body, res));

app.post('/api/embed', (req, res) => {
  const body = JSON.stringify(req.body);
  const opts = {
    hostname: '127.0.0.1', port: 11434, path: '/api/embed', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  };
  let data = '';
  const oReq = http.request(opts, oRes => {
    oRes.on('data', c => data += c);
    oRes.on('end', () => {
      try { res.json(JSON.parse(data)); }
      catch { res.status(500).json({ error: 'Parse error' }); }
    });
  });
  oReq.on('error', () => res.status(503).json({ error: 'Ollama not reachable' }));
  oReq.write(body);
  oReq.end();
});

app.post('/api/show', (req, res) => {
  const body = JSON.stringify(req.body);
  const opts = {
    hostname: '127.0.0.1', port: 11434, path: '/api/show', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  };
  let data = '';
  const oReq = http.request(opts, oRes => {
    oRes.on('data', c => data += c);
    oRes.on('end', () => {
      try { res.json(JSON.parse(data)); }
      catch { res.status(500).json({ error: 'Parse error' }); }
    });
  });
  oReq.on('error', () => res.status(503).json({ error: 'Ollama not reachable' }));
  oReq.write(body);
  oReq.end();
});

app.post('/api/pull', (req, res) => ollamaStream('/api/pull', req.body, res));
app.post('/api/create', (req, res) => ollamaStream('/api/create', req.body, res));

app.post('/api/delete', (req, res) => {
  const body = JSON.stringify(req.body);
  const opts = {
    hostname: '127.0.0.1', port: 11434, path: '/api/delete', method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  };
  let data = '';
  const oReq = http.request(opts, oRes => {
    oRes.on('data', c => data += c);
    oRes.on('end', () => {
      try { res.status(oRes.statusCode).json(data ? JSON.parse(data) : { ok: true }); }
      catch { res.status(oRes.statusCode).json({ ok: true }); }
    });
  });
  oReq.on('error', () => res.status(503).json({ error: 'Ollama not reachable' }));
  oReq.write(body);
  oReq.end();
});

app.post('/api/copy', (req, res) => {
  const body = JSON.stringify(req.body);
  const opts = {
    hostname: '127.0.0.1', port: 11434, path: '/api/copy', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  };
  let data = '';
  const oReq = http.request(opts, oRes => {
    oRes.on('data', c => data += c);
    oRes.on('end', () => {
      try { res.status(oRes.statusCode).json(data ? JSON.parse(data) : { ok: true }); }
      catch { res.status(oRes.statusCode).json({ ok: true }); }
    });
  });
  oReq.on('error', () => res.status(503).json({ error: 'Ollama not reachable' }));
  oReq.write(body);
  oReq.end();
});

// ─── SHELL EXECUTION ─────────────────────────────────────────────────────────
app.post('/api/shell', (req, res) => {
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: 'No command provided' });
  const start = Date.now();
  exec(command, { shell: 'powershell.exe', timeout: 30000, maxBuffer: 2 * 1024 * 1024 }, (err, stdout, stderr) => {
    const entry = { command, stdout: stdout || '', stderr: stderr || '', exitCode: err ? (err.code || 1) : 0, duration: Date.now() - start, timestamp: Date.now() };
    // Save to history
    const history = readJSON(HISTORY_FILE, []);
    history.unshift(entry);
    writeJSON(HISTORY_FILE, history.slice(0, 200));
    res.json(entry);
  });
});

app.get('/api/shell-history', (req, res) => {
  res.json(readJSON(HISTORY_FILE, []));
});

// ─── OPENCLAW PROXY ──────────────────────────────────────────────────────────
const OPENCLAW_AGENTS = [
  { id: 'main', name: 'main', description: 'General purpose agent' },
  { id: 'btc-chief', name: 'btc-chief', description: 'BTC Chief Decision Agent' },
  { id: 'btc-price-desk', name: 'btc-price-desk', description: 'BTC Price Analysis' },
  { id: 'btc-catalyst-desk', name: 'btc-catalyst-desk', description: 'BTC Catalyst Analysis' },
  { id: 'btc-macro-desk', name: 'btc-macro-desk', description: 'BTC Macro Analysis' },
  { id: 'btc-flow-desk', name: 'btc-flow-desk', description: 'BTC Flow Analysis' },
  { id: 'btc-bookmaker-desk', name: 'btc-bookmaker-desk', description: 'BTC Market Bookmaker' },
  { id: 'btc-site-monitor-desk', name: 'btc-site-monitor-desk', description: 'BTC Site Monitor' },
  { id: 'btc-market-intelligence-desk', name: 'btc-market-intelligence-desk', description: 'BTC Market Intelligence' },
  { id: 'btc-opportunity-ranker-desk', name: 'btc-opportunity-ranker-desk', description: 'BTC Opportunity Ranker' },
  { id: 'btc-question-lab-desk', name: 'btc-question-lab-desk', description: 'BTC Question Lab' }
];

app.get('/api/openclaw/agents', (req, res) => {
  res.json({ agents: OPENCLAW_AGENTS });
});

app.get('/api/openclaw/status', (req, res) => {
  const settings = readJSON(SETTINGS_FILE, {});
  const port = settings.openclawPort || 18789;
  http.get(`http://127.0.0.1:${port}/health`, (oRes) => {
    res.json({ reachable: true, port });
  }).on('error', () => {
    res.json({ reachable: false, port, message: 'OpenClaw gateway not reachable' });
  });
});

app.post('/api/openclaw/chat', (req, res) => {
  const settings = readJSON(SETTINGS_FILE, {});
  const port = settings.openclawPort || 18789;
  const token = settings.openclawToken || req.headers['x-openclaw-token'] || '';
  const agentId = req.body.agentId || 'main';
  
  // OpenClaw uses OpenAI-compatible API
  const payload = {
    model: agentId,
    messages: req.body.messages || [],
    stream: req.body.stream !== false
  };
  const body = JSON.stringify(payload);
  const opts = {
    hostname: '127.0.0.1', port, path: '/v1/chat/completions', method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
  };
  
  if (payload.stream) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    const oReq = http.request(opts, oRes => {
      oRes.on('data', chunk => res.write(chunk));
      oRes.on('end', () => res.end());
    });
    oReq.on('error', () => res.status(503).end(JSON.stringify({ error: 'OpenClaw not reachable on port ' + port })));
    oReq.write(body);
    oReq.end();
  } else {
    let data = '';
    const oReq = http.request(opts, oRes => {
      oRes.on('data', c => data += c);
      oRes.on('end', () => {
        try { res.json(JSON.parse(data)); }
        catch { res.status(500).json({ error: 'Parse error' }); }
      });
    });
    oReq.on('error', () => res.status(503).json({ error: 'OpenClaw not reachable on port ' + port }));
    oReq.write(body);
    oReq.end();
  }
});

// ─── PERSISTENCE ─────────────────────────────────────────────────────────────
app.get('/api/sessions', (req, res) => res.json(readJSON(SESSIONS_FILE, [])));
app.post('/api/sessions', (req, res) => {
  const sessions = readJSON(SESSIONS_FILE, []);
  const session = { ...req.body, id: req.body.id || Date.now().toString(), updatedAt: Date.now() };
  const idx = sessions.findIndex(s => s.id === session.id);
  if (idx >= 0) sessions[idx] = session; else sessions.unshift(session);
  writeJSON(SESSIONS_FILE, sessions.slice(0, 100));
  res.json(session);
});
app.delete('/api/sessions/:id', (req, res) => {
  const sessions = readJSON(SESSIONS_FILE, []).filter(s => s.id !== req.params.id);
  writeJSON(SESSIONS_FILE, sessions);
  res.json({ ok: true });
});

app.get('/api/settings', (req, res) => res.json(readJSON(SETTINGS_FILE, {})));
app.post('/api/settings', (req, res) => {
  writeJSON(SETTINGS_FILE, req.body);
  res.json({ ok: true });
});

// App info
app.get('/api/app-info', (req, res) => {
  res.json({
    version: '2.0.0',
    node: process.version,
    platform: process.platform,
    uptime: process.uptime(),
    dataDir: DATA_DIR
  });
});

// ─── SPA FALLBACK ────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`BTCMACHINE server v2.0 running at http://localhost:${PORT}`);
  console.log(`Data dir: ${DATA_DIR}`);
});
