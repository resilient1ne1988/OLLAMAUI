'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { getDb } = require('../db/db');
const { analyzeSources } = require('../services/captureDirector');

const router = express.Router();

const DATA_DIR = path.join(os.homedir(), '.ollamaui-data');
const DISMISSED_FILE = path.join(DATA_DIR, 'capture-dismissed.json');

function readDismissed() {
  try { return JSON.parse(fs.readFileSync(DISMISSED_FILE, 'utf8')); } catch { return {}; }
}

function writeDismissed(data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DISMISSED_FILE, JSON.stringify(data, null, 2));
}

// POST /api/capture/analyze
router.post('/analyze', (req, res) => {
  try {
    const { workspaceId, messageText } = req.body || {};
    if (!workspaceId) return res.status(400).json({ ok: false, error: 'workspaceId required' });

    const db = getDb();
    const rows = db.prepare('SELECT * FROM sources WHERE workspace_id = ?').all(workspaceId);

    // Map DB rows to the shape analyzeSources expects
    const sources = rows.map(r => ({
      id: r.id,
      workspaceId: r.workspace_id,
      name: r.name,
      modality: r.modality,
      extractionStatus: r.extraction_status,
    }));

    const dismissed = readDismissed();
    let suggestions = analyzeSources(sources, messageText || '');
    // Attach workspaceId and filter out already-dismissed suggestions
    suggestions = suggestions
      .map(s => ({ ...s, workspaceId }))
      .filter(s => !dismissed[s.id]);

    res.json({ ok: true, data: suggestions });
  } catch (err) {
    console.error('[capture/analyze]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/capture/dismiss
router.post('/dismiss', (req, res) => {
  try {
    const { suggestionId } = req.body || {};
    if (!suggestionId) return res.status(400).json({ ok: false, error: 'suggestionId required' });

    const dismissed = readDismissed();
    dismissed[suggestionId] = true;
    writeDismissed(dismissed);

    res.json({ ok: true });
  } catch (err) {
    console.error('[capture/dismiss]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
