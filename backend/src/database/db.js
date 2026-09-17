const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const isTestRun = Boolean(
  process.env.NODE_ENV === 'test'
  || process.env.npm_lifecycle_event === 'test'
  || process.argv.includes('--test')
  || process.argv.some((arg) => arg.includes('node:test'))
  || process.argv.some((arg) => /test/i.test(arg))
  || process.env.MEDSLOT_DB_PATH?.includes('test')
);

const configuredPath = process.env.MEDSLOT_DB_PATH || (isTestRun ? 'medslot.test.db' : 'medslot.db');
const dbPath = path.isAbsolute(configuredPath)
  ? configuredPath
  : path.join(__dirname, '../../', configuredPath);

if (isTestRun) {
  const dbFiles = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, path.join(__dirname, '../../', 'medslot.db'), path.join(__dirname, '../../', 'medslot.db-wal'), path.join(__dirname, '../../', 'medslot.db-shm')];
  dbFiles.forEach((filePath) => fs.rmSync(filePath, { force: true }));
}

const db = new Database(dbPath);

db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

console.log(`✅ SQLite database connected: ${dbPath}`);

module.exports = db;