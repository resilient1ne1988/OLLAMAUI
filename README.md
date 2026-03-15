# Ollama UI

A local Ollama chat UI that runs as both a **Windows desktop app** (via Electron) and in a **browser window**.

## Features

- 🦙 Chat with any locally running Ollama model
- ⚡ Real-time streaming responses
- ⌨️ Built-in Terminal panel — run PowerShell commands directly
- 🤖 AI-driven shell execution: ask the AI to run commands and it will
- 🌙 Dark theme UI
- 📦 Packages as a Windows `.exe` installer via electron-builder

## Requirements

- **Node.js 18+**
- **Ollama** running locally on `http://localhost:11434`
  - Install from https://ollama.com
  - Pull at least one model: `ollama pull llama3`

## Quick Start

```bash
# Install dependencies
npm install

# Development mode (Vite dev server + Express server)
npm run dev

# Open in browser at http://localhost:5173
```

The Express backend runs on **port 3838**. In dev mode, Vite proxies are not used — the frontend talks directly to the Express server when running the built version.

## Running the Built Version

```bash
# Build the frontend
npm run build

# Run the Express server (serves built frontend at http://localhost:3838)
npm run server
```

Then open http://localhost:3838 in your browser.

## Electron Desktop App (Development)

```bash
npm run build       # build frontend first
npm run electron    # launch Electron window
```

## Build Windows Installer

```bash
npm run dist
```

This builds the frontend and packages everything into a Windows NSIS `.exe` installer in `release/`.

> ⚠️ Requires an `src/icon.ico` file. You can add any 256×256 `.ico` file there, or remove the `"icon"` line from `package.json` `build.win` to skip it.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/models` | List Ollama models |
| `POST` | `/api/chat` | Streaming chat (proxy to Ollama) |
| `POST` | `/api/shell` | Execute shell command on local machine |

### `/api/shell` example

```json
POST /api/shell
{ "command": "Get-Date" }

Response:
{ "stdout": "Thursday, ...", "stderr": "", "exitCode": 0 }
```

## Security Warning

The `/api/shell` endpoint executes **arbitrary PowerShell commands** on your local machine. This server is intended for **local use only** and should **never be exposed to the internet or untrusted networks**.

## Project Structure

```
OLLAMAUI/
├── electron-main.js     # Electron entry point
├── server/
│   └── index.js         # Express server (CommonJS)
├── src/
│   ├── App.jsx          # Main React component
│   ├── App.css          # Dark theme styles
│   └── main.jsx         # React entry point
├── index.html           # Vite HTML entry (at root)
├── vite.config.js       # Vite configuration
└── package.json
```
