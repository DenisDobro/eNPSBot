import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { config } from '../config';
import { applyBaseSchema } from '../database/schema';

let instance: Database.Database | null = null;

function ensureDirectory(filePath: string): void {
  const directory = path.dirname(filePath);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

function createDatabase(filePath: string): Database.Database {
  ensureDirectory(filePath);
  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  return db;
}

export function getDatabase(): Database.Database {
  if (!instance) {
    instance = createDatabase(config.databaseFile);
  }

  return instance;
}

export function initDatabase(): void {
  const db = getDatabase();
  applyBaseSchema(db);
}
