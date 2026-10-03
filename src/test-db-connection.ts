import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
console.log('DATABASE_URL from .env:', DATABASE_URL ? 'FOUND (starts with ' + DATABASE_URL.substring(0, 20) + '...)' : 'NOT FOUND');

if (!DATABASE_URL) {
  console.error('DATABASE_URL is missing in env!');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const client = await pool.connect();
    console.log('Successfully connected to PostgreSQL/Supabase!');
    
    // Check if tables exist
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `);
    console.log('Tables in database:', tablesRes.rows.map(r => r.table_name));

    // Count rows in main tables
    const tables = ['users', 'apiaries', 'boxes', 'review_reports', 'manejos', 'notifications', 'app_config'];
    for (const table of tables) {
      try {
        const countRes = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`Table "${table}" has ${countRes.rows[0].count} records.`);
      } catch (err: any) {
        console.log(`Table "${table}" error: ${err.message}`);
      }
    }

    client.release();
  } catch (err: any) {
    console.error('Database connection test failed:', err);
  } finally {
    await pool.end();
  }
}

run();
