import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, type PoolClient, type PoolConfig, type QueryResultRow } from 'pg';

export type DatabaseRow = Record<string, unknown>;

export interface DatabasePool {
  query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: Row[]; rowCount: number | null }>;
  connect(): Promise<PoolClient>;
  end(): Promise<void>;
}

function postgresPlaceholders(sql: string): string {
  let parameterIndex = 0;
  return sql.replace(/\?/g, () => `$${++parameterIndex}`);
}

export class Database {
  private readonly transactionClient = new AsyncLocalStorage<PoolClient>();

  constructor(private readonly pool: DatabasePool) {}

  prepare(sql: string) {
    const text = postgresPlaceholders(sql);
    return {
      all: async (...parameters: unknown[]): Promise<DatabaseRow[]> =>
        (await this.query(text, parameters)).rows,
      get: async (...parameters: unknown[]): Promise<DatabaseRow | undefined> =>
        (await this.query(text, parameters)).rows[0],
      run: async (...parameters: unknown[]): Promise<{ changes: number }> => {
        const result = await this.query(text, parameters);
        return { changes: result.rowCount ?? 0 };
      },
    };
  }

  async exec(sql: string): Promise<void> {
    await this.query(sql);
  }

  async query<Row extends QueryResultRow = QueryResultRow>(
    sql: string,
    parameters: readonly unknown[] = [],
  ): Promise<{ rows: Row[]; rowCount: number | null }> {
    const transactionClient = this.transactionClient.getStore();
    const result = transactionClient
      ? await transactionClient.query<Row>(sql, [...parameters])
      : await this.pool.query<Row>(sql, [...parameters]);
    return { rows: result.rows, rowCount: result.rowCount };
  }

  async transaction<T>(action: () => Promise<T>): Promise<T> {
    const activeClient = this.transactionClient.getStore();
    if (activeClient) return action();

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await this.transactionClient.run(client, action);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export function createPool(config: PoolConfig): Database {
  const pool = new Pool(config);
  pool.on('error', (error: Error) => {
    console.error('Unexpected PostgreSQL pool error:', error);
  });
  return new Database(pool);
}
