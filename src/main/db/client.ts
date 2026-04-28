import { app } from 'electron'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { dirname, join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import * as schema from './schema'

let database: Database.Database | null = null
let dbInstance: ReturnType<typeof drizzle> | null = null

function ensureDbDir(filePath: string): void {
  const dbDir = dirname(filePath)
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }
}

export function initDatabase(): void {
  const dbPath = join(app.getPath('userData'), 'astian.db')
  ensureDbDir(dbPath)

  if (!database) {
    database = new Database(dbPath)
    database.pragma('journal_mode = WAL')
    applyMigrations(database)
    dbInstance = drizzle(database, { schema })
  }
}

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return dbInstance as ReturnType<typeof drizzle<typeof schema>>
}

function applyMigrations(db: Database.Database): void {
  // Base tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS spaces (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      visited_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS extensions (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      name TEXT NOT NULL,
      version TEXT NOT NULL,
      path TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      installed_at INTEGER NOT NULL
    );
  `)

  // Additive migrations — safe to run multiple times
  const addColumnIfNotExists = (table: string, column: string, definition: string): void => {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
    } catch {
      // Column already exists — ignore
    }
  }

  addColumnIfNotExists('bookmarks', 'profile_id', "TEXT NOT NULL DEFAULT 'default'")
  addColumnIfNotExists('history', 'profile_id', "TEXT NOT NULL DEFAULT 'default'")

  // Indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_history_profile ON history(profile_id, visited_at DESC);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_profile ON bookmarks(profile_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_extensions_profile ON extensions(profile_id);
    CREATE INDEX IF NOT EXISTS idx_spaces_profile ON spaces(profile_id);
  `)
}
