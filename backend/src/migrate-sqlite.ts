import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { createDatabase } from './database/connection.js';
import { initializeReceptionSchema } from './database/reception-schema.js';

const tables = [
  'customers',
  'salon_services',
  'reception_settings',
  'reception_barbers',
  'users',
  'reception_bookings',
  'booking_services',
  'service_records',
  'daily_queue_information',
] as const;

const sqlitePath = process.env.SQLITE_SOURCE;
if (!sqlitePath?.trim()) {
  throw new Error('Set SQLITE_SOURCE to the existing SQLite database file.');
}

const source = new DatabaseSync(resolve(sqlitePath));
const target = createDatabase();

try {
  const sourceTables = new Set(
    source
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => String(row['name'])),
  );
  const missingTables = tables.filter((table) => !sourceTables.has(table));
  if (missingTables.length > 0) {
    throw new Error(
      `The SQLite database is missing required tables: ${missingTables.join(', ')}.`,
    );
  }

  await initializeReceptionSchema(target);
  const existing = await target.query<{ has_business_data: boolean }>(`
    SELECT
      EXISTS (SELECT 1 FROM users) OR
      EXISTS (SELECT 1 FROM customers) OR
      EXISTS (SELECT 1 FROM reception_barbers) OR
      EXISTS (SELECT 1 FROM reception_bookings) AS has_business_data
  `);
  if (existing.rows[0]?.has_business_data) {
    throw new Error(
      'The PostgreSQL target already contains business data; SQLite import was not started.',
    );
  }

  await target.transaction(async () => {
    await target.exec('DELETE FROM reception_settings; DELETE FROM salon_services;');
    let rowsImported = 0;

    for (const table of tables) {
      const columns = source
        .prepare(`PRAGMA table_info("${table}")`)
        .all()
        .map((row) => String(row['name']));
      const columnList = columns.map((column) => `"${column}"`).join(', ');
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
      const insert = await target.prepare(
        `INSERT INTO "${table}" (${columnList})
         VALUES (${placeholders})
         ON CONFLICT DO NOTHING`,
      );
      const rows = source.prepare(`SELECT * FROM "${table}"`).all();

      for (const row of rows) {
        await insert.run(...columns.map((column) => row[column]));
        rowsImported += 1;
      }
    }

    await target.exec(`
      SELECT setval(
        pg_get_serial_sequence('reception_bookings', 'queue_order'),
        COALESCE((SELECT MAX(queue_order) + 1 FROM reception_bookings), 1),
        false
      )
    `);
    console.info(`Imported ${rowsImported} SQLite rows into PostgreSQL.`);
  });
} finally {
  source.close();
  await target.close();
}
