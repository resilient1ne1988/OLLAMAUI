const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')
const os = require('os')

const DATA_DIR = path.join(os.homedir(), '.ollamaui-data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

const DB_PATH = path.join(DATA_DIR, 'ollamaui.db')
const SCHEMA_PATH = path.join(__dirname, 'schema.sql')

let _db = null

function getDb() {
  if (_db) return _db
  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')
  _db.pragma('synchronous = NORMAL')
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8')
  _db.exec(schema)
  return _db
}

module.exports = { getDb, DB_PATH }
