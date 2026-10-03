import dotenv from 'dotenv';
import pg from 'pg';
// @ts-ignore
import sqlite3 from 'sqlite3';
// @ts-ignore
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATABASE_FILE = path.join(__dirname, '../colmeia_digital.db');
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is missing in .env!');
  process.exit(1);
}

const pgPool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log('Starting data recovery script from local SQLite to Supabase (Colmeia Digital)...');
  
  let sqliteDb;
  try {
    sqliteDb = await open({
      filename: DATABASE_FILE,
      driver: sqlite3.Database
    });
    console.log('Successfully opened local sqlite database:', DATABASE_FILE);
  } catch (err) {
    console.error('Failed to open local sqlite database:', err);
    process.exit(1);
  }

  const pgClient = await pgPool.connect();
  try {
    const getTableRows = async (tableName: string): Promise<any[]> => {
      try {
        const tableCheck = await sqliteDb.get<{ name: string }>(
          `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}';`
        );
        if (!tableCheck) return [];
        return await sqliteDb.all(`SELECT * FROM ${tableName};`);
      } catch (err) {
        console.warn(`Failed to read sqlite table ${tableName}:`, err);
        return [];
      }
    };

    const users = await getTableRows('users');
    const sessions = await getTableRows('sessions');
    const apiaries = await getTableRows('apiaries');
    const boxes = await getTableRows('boxes');
    const review_reports = await getTableRows('review_reports');
    const manejos = await getTableRows('manejos');
    const notifications = await getTableRows('notifications');
    const app_config = await getTableRows('app_config');

    console.log(`Read counts from SQLite:
      users: ${users.length}
      sessions: ${sessions.length}
      apiaries: ${apiaries.length}
      boxes: ${boxes.length}
      revisions: ${review_reports.length}
      manejos: ${manejos.length}
      notifications: ${notifications.length}
      app_config: ${app_config.length}
    `);

    await pgClient.query('BEGIN;');

    // Users
    for (const u of users) {
      await pgClient.query(
        'INSERT INTO users (id, name, email, password_hash, created_at, updated_at, photo) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO UPDATE SET name=excluded.name, email=excluded.email, password_hash=excluded.password_hash, updated_at=excluded.updated_at, photo=excluded.photo;',
        [u.id, u.name, u.email, u.password_hash, u.created_at, u.updated_at, u.photo ?? null]
      );
    }
    // Sessions
    for (const s of sessions) {
      await pgClient.query(
        'INSERT INTO sessions (id, user_id, created_at) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING;',
        [s.id, s.user_id, s.created_at]
      );
    }
    // Apiaries
    for (const a of apiaries) {
      await pgClient.query(
        'INSERT INTO apiaries (id, name, location, box_count, description, created_at, updated_at, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO UPDATE SET name=excluded.name, location=excluded.location, box_count=excluded.box_count, description=excluded.description, updated_at=excluded.updated_at, user_id=excluded.user_id;',
        [a.id, a.name, a.location, a.box_count, a.description, a.created_at, a.updated_at, a.user_id ?? null]
      );
    }
    // Boxes
    for (const b of boxes) {
      await pgClient.query(
        'INSERT INTO boxes (id, apiary_id, name, position, created_at, updated_at, archived, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO UPDATE SET apiary_id=excluded.apiary_id, name=excluded.name, position=excluded.position, updated_at=excluded.updated_at, archived=excluded.archived, user_id=excluded.user_id;',
        [b.id, b.apiary_id, b.name, b.position, b.created_at, b.updated_at, b.archived ?? 0, b.user_id ?? null]
      );
    }
    // Review Reports
    for (const rr of review_reports) {
      await pgClient.query(
        'INSERT INTO review_reports (id, caixa_id, caixa_name, apiary_id, apiary_name, tipo, checked_options, observacoes, indicacoes, created_at, archived, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (id) DO UPDATE SET caixa_id=excluded.caixa_id, caixa_name=excluded.caixa_name, apiary_id=excluded.apiary_id, apiary_name=excluded.apiary_name, tipo=excluded.tipo, checked_options=excluded.checked_options, observacoes=excluded.observacoes, indicacoes=excluded.indicacoes, archived=excluded.archived, user_id=excluded.user_id;',
        [rr.id, rr.caixa_id, rr.caixa_name, rr.apiary_id, rr.apiary_name, rr.tipo, rr.checked_options, rr.observacoes, rr.indicacoes, rr.created_at, rr.archived ?? 0, rr.user_id ?? null]
      );
    }
    // Manejos
    for (const m of manejos) {
      await pgClient.query(
        'INSERT INTO manejos (id, caixa_id, caixa_name, apiary_id, apiary_name, tipo, revisao_id, checked_options, observacoes, indicacoes, created_at, photo_uri, archived, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) ON CONFLICT (id) DO UPDATE SET caixa_id=excluded.caixa_id, caixa_name=excluded.caixa_name, apiary_id=excluded.apiary_id, apiary_name=excluded.apiary_name, tipo=excluded.tipo, revisao_id=excluded.revisao_id, checked_options=excluded.checked_options, observacoes=excluded.observacoes, indicacoes=excluded.indicacoes, photo_uri=excluded.photo_uri, archived=excluded.archived, user_id=excluded.user_id;',
        [m.id, m.caixa_id, m.caixa_name, m.apiary_id, m.apiary_name, m.tipo, m.revisao_id, m.checked_options, m.observacoes, m.indicacoes, m.created_at, m.photo_uri, m.archived ?? 0, m.user_id ?? null]
      );
    }
    // Notifications
    for (const nt of notifications) {
      await pgClient.query(
        'INSERT INTO notifications (id, title, subtitle, created_at, read, user_id) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET title=excluded.title, subtitle=excluded.subtitle, read=excluded.read, user_id=excluded.user_id;',
        [nt.id, nt.title, nt.subtitle, nt.created_at, nt.read, nt.user_id ?? null]
      );
    }
    // App Config
    for (const c of app_config) {
      await pgClient.query(
        'INSERT INTO app_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value=excluded.value;',
        [c.key, c.value]
      );
    }

    await pgClient.query('COMMIT;');
    console.log('Data migration and recovery to Supabase completed successfully!');

    const tablesWithSequences = [
      'users', 'sessions', 'notifications', 'apiaries', 'boxes',
      'review_reports', 'manejos'
    ];
    for (const table of tablesWithSequences) {
      try {
        await pgClient.query(`
          SELECT setval(
            pg_get_serial_sequence('${table}', 'id'),
            COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1,
            false
          );
        `);
        console.log(`Reset sequence for table "${table}" successfully.`);
      } catch (seqErr) {
        console.warn(`Failed to reset sequence for table ${table}:`, seqErr);
      }
    }

  } catch (err) {
    await pgClient.query('ROLLBACK;');
    console.error('Failed to restore database to Supabase:', err);
  } finally {
    pgClient.release();
    await sqliteDb.close();
    await pgPool.end();
  }
}

run();
