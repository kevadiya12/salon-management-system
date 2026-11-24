import { createDatabase } from './database/connection.js';
import { initializeReceptionSchema } from './database/reception-schema.js';
import { seedInitialOwner } from './services/auth.service.js';

const name = process.env.INITIAL_OWNER_NAME;
const email = process.env.INITIAL_OWNER_EMAIL;
const password = process.env.INITIAL_OWNER_PASSWORD;

if (!name || !email || !password) {
  throw new Error(
    'Set INITIAL_OWNER_NAME, INITIAL_OWNER_EMAIL, and INITIAL_OWNER_PASSWORD before running the owner seed.',
  );
}

const database = createDatabase();
try {
  await initializeReceptionSchema(database);
  await seedInitialOwner(database, { name, email, password });
  console.info('Initial owner account created.');
} finally {
  await database.close();
}
