import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config/env.js';

export function createDatabase(): DatabaseSync {
  mkdirSync(dirname(config.databasePath), { recursive: true });

  const database = new DatabaseSync(config.databasePath);
  database.exec('PRAGMA journal_mode = WAL;');

  return database;
}
