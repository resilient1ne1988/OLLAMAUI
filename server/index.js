const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const http = require('http');

const app = express();
const PORT = 3838;
const OLLAMA_BASE = 'http://127.0.0.1:11434';

app.use(cors());
app.use(express.json());

// Serve built frontend
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', ollama: OLLAMA_BASE });
});

// List models from Ollama
app.get('/api/models', (req, res) => {
  http.get(`${OLLAMA_BASE}/api/tags`, (ollamaRes) => {
    let data = '';
    ollamaRes.on('data', chunk => data += chunk);
    ollamaRes.on('end', () => {
      try {
        res.json(JSON.parse(data));
      } catch (e) {
        res.status(500).json({ error: 'Failed to parse Ollama response' });
      }
    });
  }).on('error', () => {
    res.status(503).json({ error: 'Ollama not reachable', models: [] });
  });
});

// Streaming chat proxy to Ollama
app.post('/api/chat', (req, res) => {
  const body = JSON.stringify(req.body);
  const options = {
    hostname: '127.0.0.1',
    port: 11434,
    path: '/api/chat',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  };

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');

  const ollamaReq = http.request(options, ollamaRes => {
    ollamaRes.on('data', chunk => res.write(chunk));
    ollamaRes.on('end', () => res.end());
  });

  ollamaReq.on('error', () => {
    res.status(503).end('Ollama not reachable');
  });

  ollamaReq.write(body);
  ollamaReq.end();
});

// Execute shell commands on the local machine
app.post('/api/shell', (req, res) => {
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: 'No command provided' });

  exec(command, { shell: 'powershell.exe', timeout: 30000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
    res.json({
      stdout: stdout || '',
      stderr: stderr || '',
      exitCode: err ? (err.code || 1) : 0
    });
  });
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`OLLAMAUI server running at http://localhost:${PORT}`);
});
