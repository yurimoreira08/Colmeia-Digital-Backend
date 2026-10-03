import pg from 'pg';
import { migrations } from './migrations.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATABASE_FILE = process.env.DATABASE_PATH || path.join(__dirname, '../../colmeia_digital.db');

export interface DbConnection {
  all<T>(sql: string, params?: any[]): Promise<T>;
  get<T>(sql: string, params?: any[]): Promise<T | undefined>;
  run(sql: string, params?: any[]): Promise<{ lastID?: number; changes?: number }>;
  exec(sql: string): Promise<void>;
}

let dbInstance: DbConnection | null = null;
let pgPool: pg.Pool | null = null;
let isPostgres = false;

function convertSqlToPg(sql: string): string {
  let paramIndex = 1;
  return sql
    .replace(/\?/g, () => `$${paramIndex++}`)
    .replace(/datetime\(([^)]+)\)/g, '$1')
    .replace(/datetime\(([^)]+)\s*,\s*[^)]+\)/g, '$1');
}

function translateDdlToPg(statement: string): string {
  if (statement.toUpperCase().startsWith('PRAGMA')) {
    return '';
  }
  return statement
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
    .replace(/AUTOINCREMENT/gi, 'SERIAL')
    .replace(/datetime\(([^)]+)\)/g, '$1')
    .replace(/REAL/gi, 'DOUBLE PRECISION')
    .replace(/DATETIME/gi, 'TEXT');
}

class PostgresConnection implements DbConnection {
  private pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  async all<T>(sql: string, params: any[] = []): Promise<T> {
    const pgSql = convertSqlToPg(sql);
    const res = await this.pool.query(pgSql, params);
    return res.rows as unknown as T;
  }

  async get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
    const pgSql = convertSqlToPg(sql);
    const res = await this.pool.query(pgSql, params);
    return res.rows[0] as unknown as T;
  }

  async run(sql: string, params: any[] = []): Promise<{ lastID?: number; changes?: number }> {
    let pgSql = convertSqlToPg(sql).trim();
    if (pgSql.endsWith(';')) {
      pgSql = pgSql.slice(0, -1);
    }
    const isInsert = pgSql.toUpperCase().startsWith('INSERT');
    let hasId = true;
    if (isInsert) {
      const match = pgSql.match(/INSERT\s+INTO\s+(?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+)/i);
      if (match) {
        const tableName = match[1].toLowerCase();
        if (tableName === 'app_config') {
          hasId = false;
        }
      }
    }
    if (isInsert && hasId && !pgSql.toUpperCase().includes('RETURNING')) {
      pgSql += ' RETURNING id';
    }
    const res = await this.pool.query(pgSql, params);
    let lastID: number | undefined = undefined;
    if (isInsert && hasId && res.rows[0]) {
      lastID = res.rows[0].id;
    }
    return {
      lastID,
      changes: res.rowCount ?? 0
    };
  }

  async exec(sql: string): Promise<void> {
    const pgSql = convertSqlToPg(sql);
    await this.pool.query(pgSql);
  }
}

class SqliteConnection implements DbConnection {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  async all<T>(sql: string, params: any[] = []): Promise<T> {
    return this.db.all(sql, params);
  }

  async get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
    return this.db.get(sql, params);
  }

  async run(sql: string, params: any[] = []): Promise<{ lastID?: number; changes?: number }> {
    const res = await this.db.run(sql, params);
    return {
      lastID: res.lastID,
      changes: res.changes
    };
  }

  async exec(sql: string): Promise<void> {
    await this.db.exec(sql);
  }
}

export async function getDatabase(): Promise<DbConnection> {
  if (dbInstance) {
    return dbInstance;
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    console.log('[database] Connecting to Supabase/PostgreSQL...');
    pgPool = new pg.Pool({
      connectionString: databaseUrl,
      ssl: {
        rejectUnauthorized: false
      }
    });
    isPostgres = true;
    dbInstance = new PostgresConnection(pgPool);
  } else {
    console.log('[database] Connecting to local SQLite database: colmeia_digital.db');
    // @ts-ignore
    const sqlite3Module = await import('sqlite3');
    // @ts-ignore
    const { open } = await import('sqlite');

    const db = await open({
      filename: DATABASE_FILE,
      driver: sqlite3Module.default.Database
    });
    isPostgres = false;
    dbInstance = new SqliteConnection(db);
  }

  return dbInstance;
}

export async function initializeDatabase(): Promise<void> {
  const db = await getDatabase();

  if (isPostgres && pgPool) {
    const client = await pgPool.connect();
    try {
      // 1. Get current Postgres version
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_version (
          version INTEGER PRIMARY KEY
        );
      `);
      const res = await client.query('SELECT version FROM schema_version LIMIT 1;');
      let currentVersion = 0;
      if (res.rows.length === 0) {
        await client.query('INSERT INTO schema_version (version) VALUES (0);');
      } else {
        currentVersion = res.rows[0].version;
      }

      // 2. Run pending migrations
      for (let i = currentVersion; i < migrations.length; i += 1) {
        const statements = migrations[i];
        for (const statement of statements) {
          const pgStatement = translateDdlToPg(statement);
          if (pgStatement.trim()) {
            try {
              await client.query(pgStatement);
            } catch (err) {
              console.warn(`[database] Migration statement failed on Postgres: ${pgStatement}`, err);
            }
          }
        }
        currentVersion = i + 1;
        await client.query('UPDATE schema_version SET version = $1;', [currentVersion]);
      }
      console.log(`[database] Postgres initialized for Colmeia Digital. Schema Version: ${currentVersion}`);

      // Reset Postgres sequences
      const tablesWithSequences = [
        'users', 'sessions', 'notifications', 'apiaries', 'boxes',
        'review_reports', 'manejos'
      ];
      for (const table of tablesWithSequences) {
        try {
          await client.query(`
            SELECT setval(
              pg_get_serial_sequence('${table}', 'id'),
              COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1,
              false
            );
          `);
        } catch (seqErr) {
          // Ignore if table has no serial sequence
        }
      }

    } finally {
      client.release();
    }
  } else {
    // SQLite connection initialization
    const sqliteDb = (db as any).db;
    await sqliteDb.exec('PRAGMA foreign_keys = ON;');
    const row = (await sqliteDb.get('PRAGMA user_version;')) as { user_version: number } | undefined;
    let currentVersion = row?.user_version ?? 0;

    for (let i = currentVersion; i < migrations.length; i += 1) {
      const statements = migrations[i];
      for (const statement of statements) {
        try {
          await sqliteDb.exec(statement);
        } catch (err) {
          console.warn(`Migration statement failed on SQLite: ${statement}`, err);
        }
      }
      currentVersion = i + 1;
      await sqliteDb.exec(`PRAGMA user_version = ${currentVersion};`);
    }
    console.log(`[database] Colmeia Digital SQLite initialized. Schema Version: ${currentVersion}`);
  }
}
