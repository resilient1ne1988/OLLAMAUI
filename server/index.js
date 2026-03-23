const express = require('express');
const cors = require('cors');
const { exec, spawn } = require('child_process');
const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');

// ─── PHASE 1: SQLITE ROUTES ──────────────────────────────────────────────────
const workspacesRouter = require('./routes/workspaces');
const evidenceRouter   = require('./routes/evidence');
const memoryRouter     = require('./routes/memory');
const conflictsRouter  = require('./routes/conflicts');
const { scheduleCleanup } = require('./services/memory');
const { ensureDefaultWorkspace } = require('./services/workspace');

// ─── VERSION ─────────────────────────────────────────────────────────────────
const APP_VERSION = (() => { try { return require('../package.json').version; } catch { return '2.0.0'; } })();

const app = express();
const PORT = Number(process.env.PORT) || 3838;
const OLLAMA_BASE = 'http://127.0.0.1:11434';

// ─── PERSISTENCE SETUP ───────────────────────────────────────────────────────
const DATA_DIR = path.join(os.homedir(), '.ollamaui-data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const SIGNALS_FILE = path.join(DATA_DIR, 'signal-schedules.json');
const SIGNAL_RESULTS_FILE = path.join(DATA_DIR, 'signal-results.json');
const PROMPTS_FILE = path.join(DATA_DIR, 'prompts.json');
const INSIGHTS_FILE = path.join(DATA_DIR, 'insights.json');
const WORKFLOWS_FILE = path.join(DATA_DIR, 'workflows.json');
const WORKFLOW_RUNS_FILE = path.join(DATA_DIR, 'workflow-runs.json');

// ─── ASYNC MUTEX FOR HISTORY FILE ────────────────────────────────────────────
let historyLock = Promise.resolve();
function withHistoryLock(fn) {
  historyLock = historyLock.then(fn).catch(() => {});
  return historyLock;
}

// ─── MCP STATE ───────────────────────────────────────────────────────────────
const MCP_LOG_LIMIT = 300;
let mcpProcess = null;
const mcpState = {
  running: false, pid: null, command: '', args: [], cwd: process.cwd(),
  startedAt: null, exitedAt: null, exitCode: null, signal: null, lastError: null, logs: []
};

// ─── SSE CLIENT SETS ─────────────────────────────────────────────────────────
const mcpSseClients = new Set();
const signalSseClients = new Set();

function broadcastMcpEvent(type, payload) {
  const data = `data: ${JSON.stringify({ type, ...payload })}\n\n`;
  for (const client of mcpSseClients) {
    try { client.write(data); } catch { mcpSseClients.delete(client); }
  }
}

function broadcastSignalEvent(type, payload) {
  const data = `data: ${JSON.stringify({ type, ...payload })}\n\n`;
  for (const client of signalSseClients) {
    try { client.write(data); } catch { signalSseClients.delete(client); }
  }
}

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────
function readJSON(file, defaultVal) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return defaultVal; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function pushMcpLog(line) {
  if (!line) return;
  const entry = `[${new Date().toISOString()}] ${line}`;
  mcpState.logs.push(entry);
  if (mcpState.logs.length > MCP_LOG_LIMIT) mcpState.logs = mcpState.logs.slice(mcpState.logs.length - MCP_LOG_LIMIT);
  broadcastMcpEvent('log', { line: entry });
}

function getMcpCommandFromSettings() {
  const settings = readJSON(SETTINGS_FILE, {});
  return (settings.mcpServerCommand || '').trim();
}

// Tokenize command string safely (handles quoted args)
function tokenizeCommand(cmd) {
  const tokens = [];
  const re = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
  let m;
  while ((m = re.exec(cmd)) !== null) tokens.push(m[1] ?? m[2] ?? m[0]);
  return tokens;
}

function startMcpServer({ command, args = [], cwd, env = {} } = {}) {
  if (mcpProcess) throw new Error('MCP server is already running');
  const resolvedCommand = (command || getMcpCommandFromSettings() || '').trim();
  if (!resolvedCommand) throw new Error('No MCP server command configured');
  const resolvedCwd = cwd ? path.resolve(cwd) : process.cwd();
  const safeArgs = Array.isArray(args) ? args : [];
  const tokens = tokenizeCommand(resolvedCommand);
  const executable = tokens[0];
  const resolvedArgs = [...tokens.slice(1), ...safeArgs];
  mcpProcess = spawn(executable, resolvedArgs, {
    cwd: resolvedCwd, env: { ...process.env, ...env }, shell: false, windowsHide: true
  });
  mcpState.running = true; mcpState.pid = mcpProcess.pid; mcpState.command = resolvedCommand;
  mcpState.args = safeArgs; mcpState.cwd = resolvedCwd; mcpState.startedAt = Date.now();
  mcpState.exitedAt = null; mcpState.exitCode = null; mcpState.signal = null; mcpState.lastError = null;
  pushMcpLog(`MCP server started: ${resolvedCommand}`);
  broadcastMcpEvent('status', { running: true, pid: mcpProcess.pid, command: resolvedCommand });
  mcpProcess.stdout.on('data', (chunk) => pushMcpLog(`stdout: ${String(chunk).trimEnd()}`));
  mcpProcess.stderr.on('data', (chunk) => pushMcpLog(`stderr: ${String(chunk).trimEnd()}`));
  mcpProcess.on('error', (err) => {
    mcpState.lastError = err.message;
    pushMcpLog(`process error: ${err.message}`);
    broadcastMcpEvent('error', { error: err.message });
  });
  mcpProcess.on('exit', (code, signal) => {
    mcpState.running = false; mcpState.exitCode = code; mcpState.signal = signal; mcpState.exitedAt = Date.now();
    pushMcpLog(`MCP server exited (code=${code}, signal=${signal || 'none'})`);
    broadcastMcpEvent('status', { running: false, exitCode: code, signal });
    mcpProcess = null;
  });
}

function stopMcpServer() {
  if (!mcpProcess) return false;
  const pid = mcpProcess.pid;
  mcpProcess.kill();
  pushMcpLog(`Stop requested for MCP server pid=${pid}`);
  return true;
}

// ─── EXPRESS SETUP ───────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173', 'app://ollamaui'];
app.use(cors({
  origin: (origin, cb) => {
    // Allow Electron (no origin) and dev server; block everything else
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origin not allowed'));
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// ─── HEALTH ──────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', ollama: OLLAMA_BASE, uptime: process.uptime(), version: APP_VERSION });
});

// ─── OLLAMA PROXY HELPERS ────────────────────────────────────────────────────
function ollamaGet(endpoint, res) {
  http.get(`${OLLAMA_BASE}${endpoint}`, (oRes) => {
    let data = '';
    oRes.on('data', c => data += c);
    oRes.on('end', () => {
      try { res.json(JSON.parse(data)); }
      catch { res.status(500).json({ error: 'Parse error' }); }
    });
  }).on('error', () => res.status(503).json({ error: 'Ollama not reachable' }));
}

function ollamaStream(endpoint, body, res, req) {
  const bodyStr = JSON.stringify(body);
  const opts = {
    hostname: '127.0.0.1', port: 11434, path: endpoint, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }
  };
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  const oReq = http.request(opts, oRes => {
    req.on('close', () => { oReq.destroy(); oRes.destroy(); });
    oRes.on('data', chunk => { try { res.write(chunk); } catch {} });
    oRes.on('end', () => { try { res.end(); } catch {} });
  });
  oReq.on('error', () => { try { res.status(503).end(JSON.stringify({ error: 'Ollama not reachable' })); } catch {} });
  req.on('close', () => oReq.destroy());
  oReq.write(bodyStr);
  oReq.end();
}

// ─── OLLAMA ENDPOINTS ────────────────────────────────────────────────────────
app.get('/api/models', (req, res) => ollamaGet('/api/tags', res));
app.get('/api/ps', (req, res) => ollamaGet('/api/ps', res));
app.get('/api/ollama-version', (req, res) => ollamaGet('/api/version', res));

app.post('/api/chat', (req, res) => ollamaStream('/api/chat', req.body, res, req));
app.post('/api/generate', (req, res) => ollamaStream('/api/generate', req.body, res, req));

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

app.post('/api/pull', (req, res) => ollamaStream('/api/pull', req.body, res, req));
app.post('/api/create', (req, res) => ollamaStream('/api/create', req.body, res, req));

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

  const settings = readJSON(SETTINGS_FILE, {});
  const policy = settings.shellSafety || 'approval';

  if (policy === 'deny') {
    return res.status(403).json({
      error: 'Shell execution is blocked by Shell Safety policy.',
      detail: "Current policy is 'deny'. Go to Settings -> Shell Safety to change it.",
      policy
    });
  }

  if (policy === 'approval') {
    const addr = req.socket.remoteAddress;
    const fromLocalhost = addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
    const approved = req.headers['x-shell-approved'] === '1';
    if (!fromLocalhost && !approved) {
      return res.status(403).json({
        error: 'Shell approval required.',
        detail: 'Set X-Shell-Approved: 1 header or connect from localhost.',
        policy
      });
    }
  }

  const start = Date.now();
  exec(command, { shell: 'powershell.exe', timeout: 30000, maxBuffer: 2 * 1024 * 1024 }, (err, stdout, stderr) => {
    const entry = {
      command, stdout: stdout || '', stderr: stderr || '',
      exitCode: err ? (err.code || 1) : 0, duration: Date.now() - start, timestamp: Date.now()
    };
    withHistoryLock(async () => {
      const history = readJSON(HISTORY_FILE, []);
      history.unshift(entry);
      writeJSON(HISTORY_FILE, history.slice(0, 200));
    });
    res.json(entry);
  });
});

// ─── SHELL HISTORY ───────────────────────────────────────────────────────────
app.get('/api/shell-history', (req, res) => {
  const since = Number(req.query.since) || 0;
  const history = readJSON(HISTORY_FILE, []);
  const filtered = since > 0 ? history.filter(e => e.timestamp > since) : history;
  const newest = history[0]?.timestamp || 0;
  res.set('Last-Modified', new Date(newest).toUTCString());
  res.json(filtered);
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

app.get('/api/openclaw/agents', (req, res) => res.json({ agents: OPENCLAW_AGENTS }));

app.get('/api/openclaw/status', (req, res) => {
  const settings = readJSON(SETTINGS_FILE, {});
  const port = settings.openclawPort || 18789;
  http.get(`http://127.0.0.1:${port}/health`, () => {
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
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Transfer-Encoding', 'chunked');
    const oReq = http.request(opts, oRes => {
      req.on('close', () => { oReq.destroy(); oRes.destroy(); });
      oRes.on('data', chunk => { try { res.write(chunk); } catch {} });
      oRes.on('end', () => { try { res.end(); } catch {} });
    });
    oReq.on('error', () => { try { res.status(503).end(JSON.stringify({ error: 'OpenClaw not reachable on port ' + port })); } catch {} });
    req.on('close', () => oReq.destroy());
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

// ─── MCP SERVER MANAGEMENT ───────────────────────────────────────────────────
app.get('/api/mcp/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  mcpSseClients.add(res);
  res.write(`data: ${JSON.stringify({ type: 'status', ...mcpState })}\n\n`);
  const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch { clearInterval(ping); } }, 15000);
  req.on('close', () => { mcpSseClients.delete(res); clearInterval(ping); });
});

app.get('/api/mcp/status', (req, res) => {
  res.json({
    running: mcpState.running, pid: mcpState.pid, command: mcpState.command,
    args: mcpState.args, cwd: mcpState.cwd, startedAt: mcpState.startedAt,
    exitedAt: mcpState.exitedAt, exitCode: mcpState.exitCode, signal: mcpState.signal,
    lastError: mcpState.lastError
  });
});

app.get('/api/mcp/logs', (req, res) => {
  res.json({ logs: mcpState.logs.slice(-100) });
});

app.post('/api/mcp/start', (req, res) => {
  try {
    startMcpServer(req.body || {});
    res.json({ ok: true, status: { running: mcpState.running, pid: mcpState.pid, command: mcpState.command } });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.post('/api/mcp/stop', (req, res) => {
  const stopped = stopMcpServer();
  res.json({ ok: true, stopped });
});

// ─── PERSISTENCE ─────────────────────────────────────────────────────────────
app.get('/api/sessions', (req, res) => res.json(readJSON(SESSIONS_FILE, [])));

app.get('/api/sessions/:id', (req, res) => {
  const sessions = readJSON(SESSIONS_FILE, []);
  const session = sessions.find(s => s.id === req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

app.post('/api/sessions', (req, res) => {
  const sessions = readJSON(SESSIONS_FILE, []);
  const session = { ...req.body, id: req.body.id || Date.now().toString(), updatedAt: Date.now() };
  const idx = sessions.findIndex(s => s.id === session.id);
  if (idx >= 0) sessions[idx] = session; else sessions.unshift(session);
  writeJSON(SESSIONS_FILE, sessions.slice(0, 100));
  res.json(session);
});

app.delete('/api/sessions/:id', (req, res) => {
  writeJSON(SESSIONS_FILE, readJSON(SESSIONS_FILE, []).filter(s => s.id !== req.params.id));
  res.json({ ok: true });
});

app.get('/api/settings', (req, res) => res.json(readJSON(SETTINGS_FILE, {})));

app.post('/api/settings', (req, res) => {
  const VALID_KEYS = ['ollamaUrl', 'openclawPort', 'openclawToken', 'defaultModel', 'defaultPage',
    'shellSafety', 'legacyShellTags', 'mcpServerCommand', 'mcpServerCwd', 'mcpAutoStart'];
  const VALID_SHELL_SAFETY = ['approval', 'session', 'always', 'deny'];
  const body = req.body || {};
  const errors = [];
  if (body.shellSafety !== undefined && !VALID_SHELL_SAFETY.includes(body.shellSafety)) {
    errors.push(`shellSafety must be one of: ${VALID_SHELL_SAFETY.join(', ')}`);
  }
  if (body.openclawPort !== undefined) {
    const port = Number(body.openclawPort);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
      errors.push('openclawPort must be a number between 1024 and 65535');
    }
  }
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });
  const filtered = {};
  for (const key of VALID_KEYS) {
    if (body[key] !== undefined) filtered[key] = body[key];
  }
  const existing = readJSON(SETTINGS_FILE, {});
  const mergedSettings = { ...existing, ...filtered };
  writeJSON(SETTINGS_FILE, mergedSettings);
  res.json({ ok: true, settings: mergedSettings });
});

app.get('/api/app-info', (req, res) => {
  res.json({
    version: APP_VERSION,
    node: process.version,
    platform: process.platform,
    uptime: process.uptime(),
    dataDir: DATA_DIR
  });
});

// ─── SIGNAL WATCHER ──────────────────────────────────────────────────────────
const signalTimers = new Map();

async function runSignalSchedule(schedule) {
  const settings = readJSON(SETTINGS_FILE, {});
  const port = settings.openclawPort || 18789;
  const token = settings.openclawToken || '';
  const payload = { model: schedule.agentId, messages: [{ role: 'user', content: schedule.prompt }], stream: false };
  const body = JSON.stringify(payload);
  broadcastSignalEvent('run_start', { scheduleId: schedule.id, agentId: schedule.agentId });
  return new Promise((resolve) => {
    const opts = {
      hostname: '127.0.0.1', port, path: '/v1/chat/completions', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };
    let data = '';
    const oReq = http.request(opts, oRes => {
      oRes.on('data', c => data += c);
      oRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.message?.content || parsed.choices?.[0]?.delta?.content || '';
          const result = { id: Date.now().toString(), scheduleId: schedule.id, agentId: schedule.agentId, content, timestamp: Date.now() };
          const results = readJSON(SIGNAL_RESULTS_FILE, []);
          results.unshift(result);
          writeJSON(SIGNAL_RESULTS_FILE, results.slice(0, 500));
          broadcastSignalEvent('run_done', { scheduleId: schedule.id, result });
          resolve(result);
        } catch (e) { resolve({ error: e.message }); }
      });
    });
    oReq.on('error', () => resolve({ error: 'OpenClaw not reachable' }));
    oReq.write(body);
    oReq.end();
  });
}

function scheduleSignal(schedule) {
  if (signalTimers.has(schedule.id)) clearInterval(signalTimers.get(schedule.id));
  if (schedule.active && schedule.intervalMs > 0) {
    const timer = setInterval(() => runSignalSchedule(schedule), schedule.intervalMs);
    signalTimers.set(schedule.id, timer);
  }
}

function initSignalSchedules() {
  const schedules = readJSON(SIGNALS_FILE, []);
  schedules.filter(s => s.active).forEach(scheduleSignal);
}

app.get('/api/signals/schedules', (req, res) => res.json(readJSON(SIGNALS_FILE, [])));

app.post('/api/signals/schedules', (req, res) => {
  const schedules = readJSON(SIGNALS_FILE, []);
  const schedule = { ...req.body, id: req.body.id || Date.now().toString(), updatedAt: Date.now() };
  const idx = schedules.findIndex(s => s.id === schedule.id);
  if (idx >= 0) schedules[idx] = schedule; else schedules.unshift(schedule);
  writeJSON(SIGNALS_FILE, schedules);
  scheduleSignal(schedule);
  res.json(schedule);
});

app.delete('/api/signals/schedules/:id', (req, res) => {
  if (signalTimers.has(req.params.id)) { clearInterval(signalTimers.get(req.params.id)); signalTimers.delete(req.params.id); }
  writeJSON(SIGNALS_FILE, readJSON(SIGNALS_FILE, []).filter(s => s.id !== req.params.id));
  res.json({ ok: true });
});

app.post('/api/signals/schedules/:id/run-now', async (req, res) => {
  const schedule = readJSON(SIGNALS_FILE, []).find(s => s.id === req.params.id);
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
  const result = await runSignalSchedule(schedule);
  res.json(result);
});

app.get('/api/signals/results', (req, res) => res.json(readJSON(SIGNAL_RESULTS_FILE, [])));

app.get('/api/signals/feed', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  signalSseClients.add(res);
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
  const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch { clearInterval(ping); } }, 15000);
  req.on('close', () => { signalSseClients.delete(res); clearInterval(ping); });
});

// ─── MULTI-MODEL ARENA ───────────────────────────────────────────────────────
app.post('/api/arena/stream', (req, res) => {
  const { prompt, models = [] } = req.body;
  if (!models.length) return res.status(400).json({ error: 'No models specified' });
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  const send = (obj) => { try { res.write(`data: ${JSON.stringify(obj)}\n\n`); } catch {} };
  let completed = 0;
  models.forEach((modelName, idx) => {
    const start = Date.now();
    let ttft = null;
    let tokenCount = 0;
    const body = JSON.stringify({ model: modelName, messages: [{ role: 'user', content: prompt }], stream: true });
    const opts = {
      hostname: '127.0.0.1', port: 11434, path: '/api/chat', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    };
    const oReq = http.request(opts, oRes => {
      req.on('close', () => oReq.destroy());
      let buf = '';
      oRes.on('data', chunk => {
        buf += chunk.toString();
        const lines = buf.split('\n'); buf = lines.pop() || '';
        for (const line of lines) {
          try {
            const d = JSON.parse(line);
            const token = d.message?.content || d.response || '';
            if (token) {
              if (ttft === null) ttft = Date.now() - start;
              tokenCount++;
              send({ type: 'chunk', modelIndex: idx, model: modelName, chunk: token });
            }
            if (d.done) {
              send({ type: 'done', modelIndex: idx, model: modelName, metrics: { ttft, duration: Date.now() - start, tokenCount } });
              completed++;
              if (completed === models.length) { try { res.end(); } catch {} }
            }
          } catch {}
        }
      });
      oRes.on('end', () => {
        if (completed < models.length) {
          completed++;
          send({ type: 'done', modelIndex: idx, model: modelName, metrics: { ttft, duration: Date.now() - start, tokenCount } });
        }
        if (completed === models.length) { try { res.end(); } catch {} }
      });
    });
    oReq.on('error', () => send({ type: 'error', modelIndex: idx, model: modelName, error: 'Ollama not reachable' }));
    oReq.write(body);
    oReq.end();
  });
});

// ─── PROMPT ARSENAL ──────────────────────────────────────────────────────────
const DEFAULT_PROMPTS = [
  { id: 'btc-daily', title: 'BTC Daily Brief', category: 'BTC', template: 'Give me a comprehensive BTC market brief for {{DATE}}. Include price action, macro factors, and your opportunity score 1-10.', createdAt: Date.now(), updatedAt: Date.now(), useCount: 0 },
  { id: 'btc-opportunity', title: 'Opportunity Scanner', category: 'BTC', template: 'Today is {{DATE}}. Current BTC context: {{SESSION_CONTEXT}}. Rate the current BTC opportunity 1-10 with specific entry criteria.', createdAt: Date.now(), updatedAt: Date.now(), useCount: 0 },
  { id: 'shell-helper', title: 'PowerShell Helper', category: 'System', template: 'Write a PowerShell script to: {{TASK}}. Make it robust with error handling. My system info: {{SHELL:Get-ComputerInfo | Select-Object OsName,TotalPhysicalMemory | ConvertTo-Json}}', createdAt: Date.now(), updatedAt: Date.now(), useCount: 0 },
  { id: 'code-review', title: 'Code Review', category: 'Dev', template: 'Review this code for bugs, security issues, and improvements:\n\n{{CLIPBOARD}}', createdAt: Date.now(), updatedAt: Date.now(), useCount: 0 },
  { id: 'macro-analysis', title: 'Macro Analysis', category: 'BTC', template: 'Analyze current macro conditions for BTC as of {{DATE}}. Focus on Fed policy, dollar strength, and institutional flows.', createdAt: Date.now(), updatedAt: Date.now(), useCount: 0 },
];

function initPrompts() {
  if (!fs.existsSync(PROMPTS_FILE)) writeJSON(PROMPTS_FILE, DEFAULT_PROMPTS);
}

app.get('/api/prompts', (req, res) => res.json(readJSON(PROMPTS_FILE, [])));

app.get('/api/prompts/categories', (req, res) => {
  const cats = [...new Set(readJSON(PROMPTS_FILE, []).map(p => p.category))];
  res.json(cats);
});

app.post('/api/prompts', (req, res) => {
  const prompts = readJSON(PROMPTS_FILE, []);
  const prompt = { ...req.body, id: req.body.id || Date.now().toString(), updatedAt: Date.now() };
  if (!prompt.createdAt) prompt.createdAt = Date.now();
  const idx = prompts.findIndex(p => p.id === prompt.id);
  if (idx >= 0) prompts[idx] = prompt; else prompts.unshift(prompt);
  writeJSON(PROMPTS_FILE, prompts);
  res.json(prompt);
});

app.delete('/api/prompts/:id', (req, res) => {
  writeJSON(PROMPTS_FILE, readJSON(PROMPTS_FILE, []).filter(p => p.id !== req.params.id));
  res.json({ ok: true });
});

app.post('/api/prompts/resolve', async (req, res) => {
  const { template, context = {} } = req.body;
  if (!template) return res.status(400).json({ error: 'No template provided' });
  let resolved = template;
  resolved = resolved.replace(/\{\{DATE\}\}/g, new Date().toLocaleDateString());
  resolved = resolved.replace(/\{\{TIME\}\}/g, new Date().toLocaleTimeString());
  if (context.recentMessages) {
    const ctx = context.recentMessages.map(m => `${m.role}: ${m.content}`).join('\n');
    resolved = resolved.replace(/\{\{SESSION_CONTEXT\}\}/g, ctx);
  } else {
    resolved = resolved.replace(/\{\{SESSION_CONTEXT\}\}/g, '(no session context)');
  }
  if (context.clipboard) resolved = resolved.replace(/\{\{CLIPBOARD\}\}/g, context.clipboard);
  else resolved = resolved.replace(/\{\{CLIPBOARD\}\}/g, '(no clipboard content)');
  const shellMatches = [...resolved.matchAll(/\{\{SHELL:([^}]+)\}\}/g)];
  for (const match of shellMatches) {
    const cmd = match[1];
    try {
      const output = await new Promise((resolve, reject) => {
        exec(cmd, { shell: 'powershell.exe', timeout: 10000, maxBuffer: 512 * 1024 }, (err, stdout, stderr) => {
          if (err) reject(err); else resolve(stdout.trim() || stderr.trim());
        });
      });
      resolved = resolved.replace(match[0], output);
    } catch (e) { resolved = resolved.replace(match[0], `(shell error: ${e.message})`); }
  }
  res.json({ resolved });
});

// ─── CONVERSATION INTELLIGENCE ───────────────────────────────────────────────
app.get('/api/search', async (req, res) => {
  const { q = '', provider, dateFrom, dateTo, limit = 20, offset = 0 } = req.query;
  const sessions = readJSON(SESSIONS_FILE, []);
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const results = [];
  for (const session of sessions) {
    if (dateFrom && session.updatedAt < Number(dateFrom)) continue;
    if (dateTo && session.updatedAt > Number(dateTo)) continue;
    if (provider && session.provider !== provider) continue;
    for (const msg of (session.messages || [])) {
      const content = (msg.content || '').toLowerCase();
      if (terms.length && !terms.every(t => content.includes(t))) continue;
      const idx = terms.length ? content.indexOf(terms[0]) : 0;
      const pre = msg.content.substring(Math.max(0, idx - 50), idx);
      const matchText = msg.content.substring(idx, idx + (terms[0]?.length || 0));
      const post = msg.content.substring(idx + (terms[0]?.length || 0), idx + 150);
      results.push({ sessionId: session.id, sessionName: session.name, sessionDate: session.updatedAt, role: msg.role, snippet: { pre, match: matchText, post } });
      if (results.length >= Number(limit) + Number(offset)) break;
    }
    if (results.length >= Number(limit) + Number(offset)) break;
  }
  res.json(results.slice(Number(offset), Number(offset) + Number(limit)));
});

app.get('/api/intelligence/insights', (req, res) => res.json(readJSON(INSIGHTS_FILE, {})));

app.post('/api/intelligence/extract/:sessionId', async (req, res) => {
  const sessions = readJSON(SESSIONS_FILE, []);
  const session = sessions.find(s => s.id === req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  let smallestModel = 'llama3.2';
  try {
    const modelsData = await new Promise((resolve) => {
      http.get(`${OLLAMA_BASE}/api/tags`, oRes => {
        let d = ''; oRes.on('data', c => d += c);
        oRes.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
      }).on('error', () => resolve({}));
    });
    const models = modelsData.models || [];
    if (models.length) smallestModel = models.sort((a, b) => (a.size || 0) - (b.size || 0))[0].name;
  } catch {}
  const convo = (session.messages || []).map(m => `${m.role}: ${m.content}`).join('\n').slice(0, 3000);
  const extractPrompt = `Analyze this AI conversation and reply with ONLY valid JSON:\n${convo}\n\nJSON format: {"score":1-10,"sentiment":"bullish|neutral|bearish","keyPoints":["..."],"actionable":"..."}`;
  const body = JSON.stringify({ model: smallestModel, messages: [{ role: 'user', content: extractPrompt }], stream: false });
  const opts = {
    hostname: '127.0.0.1', port: 11434, path: '/api/chat', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  };
  let data = '';
  const oReq = http.request(opts, oRes => {
    oRes.on('data', c => data += c);
    oRes.on('end', () => {
      try {
        const resp = JSON.parse(data);
        const content = resp.message?.content || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const insight = jsonMatch ? JSON.parse(jsonMatch[0]) : { score: 5, sentiment: 'neutral', keyPoints: [], actionable: '' };
        insight.extractedAt = Date.now(); insight.sessionId = session.id; insight.modelUsed = smallestModel;
        const insights = readJSON(INSIGHTS_FILE, {});
        insights[session.id] = insight;
        writeJSON(INSIGHTS_FILE, insights);
        res.json(insight);
      } catch (e) { res.status(500).json({ error: e.message }); }
    });
  });
  oReq.on('error', () => res.status(503).json({ error: 'Ollama not reachable' }));
  oReq.write(body);
  oReq.end();
});

app.post('/api/intelligence/extract-batch', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  const sessions = readJSON(SESSIONS_FILE, []);
  const insights = readJSON(INSIGHTS_FILE, {});
  const pending = sessions.filter(s => !insights[s.id]);
  let done = 0;
  const total = pending.length;
  res.write(`data: ${JSON.stringify({ type: 'start', total })}\n\n`);
  (async () => {
    for (const session of pending) {
      try {
        await fetch(`http://127.0.0.1:${PORT}/api/intelligence/extract/${session.id}`, { method: 'POST' });
      } catch {}
      done++;
      try { res.write(`data: ${JSON.stringify({ type: 'progress', done, total, sessionId: session.id })}\n\n`); } catch { break; }
    }
    try { res.write(`data: ${JSON.stringify({ type: 'complete', done, total })}\n\n`); res.end(); } catch {}
  })();
});

// ─── WORKFLOW BUILDER ────────────────────────────────────────────────────────
const workflowAbortFlags = new Map();

const DEFAULT_WORKFLOWS = [{
  id: 'morning-btc-brief',
  name: 'Morning BTC Brief',
  description: 'Get date, ask btc-chief for brief, notify if bullish',
  steps: [
    { type: 'shell', command: 'Get-Date -Format "yyyy-MM-dd HH:mm"' },
    { type: 'ai', agentId: 'btc-chief', prompt: 'Given today is {{STEP_0_OUTPUT}}, give me a concise BTC market brief with an opportunity score 1-10.' },
    { type: 'condition', pattern: 'bullish|score: [7-9]|score: 10', branchTo: 3, elseBranchTo: 4 },
    { type: 'notify', title: 'BTC is BULLISH!', body: 'Signal: {{STEP_1_OUTPUT}}' },
    { type: 'notify', title: 'BTC Brief Done', body: 'Score below threshold. Check Intelligence tab.' }
  ],
  createdAt: Date.now(), updatedAt: Date.now()
}];

function initWorkflows() {
  if (!fs.existsSync(WORKFLOWS_FILE)) writeJSON(WORKFLOWS_FILE, DEFAULT_WORKFLOWS);
}

function resolveTokens(text, stepOutputs) {
  let out = text
    .replace(/\{\{DATE\}\}/g, new Date().toLocaleDateString())
    .replace(/\{\{TIME\}\}/g, new Date().toLocaleTimeString());
  if (stepOutputs.length > 0) out = out.replace(/\{\{PREV_OUTPUT\}\}/g, stepOutputs[stepOutputs.length - 1] || '');
  out = out.replace(/\{\{STEP_(\d+)_OUTPUT\}\}/g, (_, i) => stepOutputs[Number(i)] || '');
  return out;
}

app.get('/api/workflows', (req, res) => res.json(readJSON(WORKFLOWS_FILE, [])));

app.post('/api/workflows', (req, res) => {
  const workflows = readJSON(WORKFLOWS_FILE, []);
  const wf = { ...req.body, id: req.body.id || Date.now().toString(), updatedAt: Date.now() };
  if (!wf.createdAt) wf.createdAt = Date.now();
  const idx = workflows.findIndex(w => w.id === wf.id);
  if (idx >= 0) workflows[idx] = wf; else workflows.unshift(wf);
  writeJSON(WORKFLOWS_FILE, workflows);
  res.json(wf);
});

app.delete('/api/workflows/:id', (req, res) => {
  writeJSON(WORKFLOWS_FILE, readJSON(WORKFLOWS_FILE, []).filter(w => w.id !== req.params.id));
  res.json({ ok: true });
});

app.post('/api/workflows/:id/abort', (req, res) => {
  workflowAbortFlags.set(req.params.id, true);
  res.json({ ok: true });
});

app.post('/api/workflows/:id/run', (req, res) => {
  const workflows = readJSON(WORKFLOWS_FILE, []);
  const wf = workflows.find(w => w.id === req.params.id);
  if (!wf) return res.status(404).json({ error: 'Workflow not found' });
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  const send = (obj) => { try { res.write(`data: ${JSON.stringify(obj)}\n\n`); } catch {} };
  workflowAbortFlags.delete(wf.id);
  (async () => {
    const stepOutputs = [];
    let stepIndex = 0;
    const steps = wf.steps || [];
    while (stepIndex < steps.length) {
      if (workflowAbortFlags.get(wf.id)) { send({ type: 'aborted' }); break; }
      const step = steps[stepIndex];
      const stepStart = Date.now();
      send({ type: 'step_start', stepIndex });
      try {
        let output = '';
        if (step.type === 'shell') {
          const cmd = resolveTokens(step.command || '', stepOutputs);
          output = await new Promise((resolve) => {
            exec(cmd, { shell: 'powershell.exe', timeout: 30000, maxBuffer: 2 * 1024 * 1024 }, (err, stdout, stderr) => {
              resolve(stdout || stderr || `(exit: ${err?.code || 0})`);
            });
          });
          send({ type: 'step_chunk', stepIndex, chunk: output });
        } else if (step.type === 'ai') {
          const aiPrompt = resolveTokens(step.prompt || '', stepOutputs);
          const settings = readJSON(SETTINGS_FILE, {});
          const isOpenClaw = step.agentId && OPENCLAW_AGENTS.find(a => a.id === step.agentId);
          const endpoint = isOpenClaw
            ? { hostname: '127.0.0.1', port: settings.openclawPort || 18789, path: '/v1/chat/completions' }
            : { hostname: '127.0.0.1', port: 11434, path: '/api/chat' };
          const aiPayload = isOpenClaw
            ? { model: step.agentId, messages: [{ role: 'user', content: aiPrompt }], stream: false }
            : { model: step.model || 'llama3.2', messages: [{ role: 'user', content: aiPrompt }], stream: false };
          const body = JSON.stringify(aiPayload);
          output = await new Promise((resolve) => {
            const opts = { ...endpoint, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
            let d = '';
            const r = http.request(opts, oRes => {
              oRes.on('data', c => d += c);
              oRes.on('end', () => {
                try { const p = JSON.parse(d); resolve(p.message?.content || p.choices?.[0]?.message?.content || ''); }
                catch { resolve('(parse error)'); }
              });
            });
            r.on('error', () => resolve('(AI error)'));
            r.write(body); r.end();
          });
          send({ type: 'step_chunk', stepIndex, chunk: output });
        } else if (step.type === 'condition') {
          const prev = stepOutputs[stepOutputs.length - 1] || '';
          const matched = new RegExp(step.pattern || '').test(prev);
          output = matched ? 'true' : 'false';
          send({ type: 'step_chunk', stepIndex, chunk: `Condition: ${matched ? 'matched' : 'no match'}` });
          send({ type: 'step_done', stepIndex, output, duration: Date.now() - stepStart });
          stepOutputs.push(output);
          stepIndex = matched ? (step.branchTo ?? stepIndex + 1) : (step.elseBranchTo ?? stepIndex + 1);
          continue;
        } else if (step.type === 'notify') {
          const title = resolveTokens(step.title || 'Workflow Notification', stepOutputs);
          const body = resolveTokens(step.body || '', stepOutputs);
          output = `Notification sent: ${title}`;
          send({ type: 'step_chunk', stepIndex, chunk: output });
          send({ type: 'notify', title, body });
        }
        stepOutputs.push(output);
        send({ type: 'step_done', stepIndex, output, duration: Date.now() - stepStart });
        stepIndex++;
      } catch (e) {
        send({ type: 'step_error', stepIndex, error: e.message });
        stepOutputs.push('');
        stepIndex++;
      }
    }
    send({ type: 'workflow_done', totalDuration: Date.now() });
    const runs = readJSON(WORKFLOW_RUNS_FILE, []);
    runs.unshift({ workflowId: wf.id, stepOutputs, completedAt: Date.now() });
    writeJSON(WORKFLOW_RUNS_FILE, runs.slice(0, 100));
    try { res.end(); } catch {}
  })();
});

// ─── PHASE 1: SQLITE API ROUTES ──────────────────────────────────────────────
app.use('/api/workspaces', workspacesRouter);
app.use('/api', evidenceRouter);
app.use('/api/memory', memoryRouter);
app.use('/api/conflicts', conflictsRouter);

// ─── PHASE 5: ENTITY THREADING ───────────────────────────────────────────────
const entitiesRouter = require('./routes/entities');
app.use('/api/entities', entitiesRouter);

// ─── PHASE 3: CAPTURE DIRECTOR ───────────────────────────────────────────────
const captureRouter = require('./routes/capture');
app.use('/api/capture', captureRouter);

// ─── SPA FALLBACK ────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`BTCMACHINE server v${APP_VERSION} running at http://localhost:${PORT}`);
  console.log(`Data dir: ${DATA_DIR}`);
  const settings = readJSON(SETTINGS_FILE, {});
  if (settings.mcpAutoStart && settings.mcpServerCommand) {
    try {
      startMcpServer({ command: settings.mcpServerCommand, cwd: settings.mcpServerCwd || process.cwd() });
    } catch (e) {
      console.log(`MCP auto-start skipped: ${e.message}`);
    }
  }
  initSignalSchedules();
  initPrompts();
  initWorkflows();
  // Phase 1: SQLite init
  try { ensureDefaultWorkspace(); } catch (e) { console.error('Workspace init:', e.message); }
  scheduleCleanup();
});
