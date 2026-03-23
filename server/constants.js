const { version } = (() => { try { return require('../package.json'); } catch { return { version: '2.0.0' }; } })();

module.exports = {
  PORT: Number(process.env.PORT) || 3838,
  OLLAMA_BASE: 'http://127.0.0.1:11434',
  APP_VERSION: version,
  MCP_LOG_LIMIT: 300,
  HISTORY_LIMIT: 200,
  SESSION_LIMIT: 100,
};
