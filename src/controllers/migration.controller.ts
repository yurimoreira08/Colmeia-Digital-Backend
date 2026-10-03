import { getDatabase } from '../data/database.js';

export async function importMigrationController(req: any, res: any): Promise<void> {
  if (process.env.DATABASE_URL) {
    res.status(403).json({
      message: 'A importação de migração via API é proibida em ambiente de produção.',
    });
    return;
  }

  const db = await getDatabase();

  const {
    users = [],
    sessions = [],
    apiaries = [],
    boxes = [],
    review_reports = [],
    manejos = [],
    notifications = [],
    app_config = [],
  } = req.body;

  try {
    await db.run('BEGIN TRANSACTION;');

    // Limpar tabelas dos 5 módulos mantidos
    await db.exec('DELETE FROM review_reports;');
    await db.exec('DELETE FROM manejos;');
    await db.exec('DELETE FROM boxes;');
    await db.exec('DELETE FROM apiaries;');
    await db.exec('DELETE FROM notifications;');
    await db.exec('DELETE FROM sessions;');
    await db.exec('DELETE FROM users;');
    await db.exec('DELETE FROM app_config;');

    // Inserir usuários
    for (const u of users) {
      await db.run(
        'INSERT INTO users (id, name, email, password_hash, created_at, updated_at, photo) VALUES (?, ?, ?, ?, ?, ?, ?);',
        [u.id, u.name, u.email, u.password_hash, u.created_at, u.updated_at, u.photo ?? null]
      );
    }

    // Inserir sessões
    for (const s of sessions) {
      await db.run(
        'INSERT INTO sessions (id, user_id, created_at) VALUES (?, ?, ?);',
        [s.id, s.user_id, s.created_at]
      );
    }

    // Inserir apiários
    for (const a of apiaries) {
      await db.run(
        'INSERT INTO apiaries (id, name, location, box_count, description, created_at, updated_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?);',
        [a.id, a.name, a.location, a.box_count, a.description, a.created_at, a.updated_at, a.user_id ?? null]
      );
    }

    // Inserir caixas
    for (const b of boxes) {
      await db.run(
        'INSERT INTO boxes (id, apiary_id, name, position, created_at, updated_at, archived, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?);',
        [b.id, b.apiary_id, b.name, b.position, b.created_at, b.updated_at, b.archived ?? 0, b.user_id ?? null]
      );
    }

    // Inserir revisões
    for (const rr of review_reports) {
      await db.run(
        'INSERT INTO review_reports (id, caixa_id, caixa_name, apiary_id, apiary_name, tipo, checked_options, observacoes, indicacoes, created_at, archived, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
        [rr.id, rr.caixa_id, rr.caixa_name, rr.apiary_id, rr.apiary_name, 'apiario', rr.checked_options, rr.observacoes, rr.indicacoes, rr.created_at, rr.archived ?? 0, rr.user_id ?? null]
      );
    }

    // Inserir manejos
    for (const m of manejos) {
      await db.run(
        'INSERT INTO manejos (id, caixa_id, caixa_name, apiary_id, apiary_name, tipo, revisao_id, checked_options, observacoes, indicacoes, created_at, photo_uri, archived, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
        [m.id, m.caixa_id, m.caixa_name, m.apiary_id, m.apiary_name, 'apiario', m.revisao_id, m.checked_options, m.observacoes, m.indicacoes, m.created_at, m.photo_uri, m.archived ?? 0, m.user_id ?? null]
      );
    }

    // Inserir notificações
    for (const n of notifications) {
      await db.run(
        'INSERT INTO notifications (id, title, subtitle, created_at, read, user_id) VALUES (?, ?, ?, ?, ?, ?);',
        [n.id, n.title, n.subtitle, n.created_at, n.read ?? 0, n.user_id ?? null]
      );
    }

    // Inserir app_config
    for (const c of app_config) {
      await db.run(
        'INSERT INTO app_config (key, value) VALUES (?, ?);',
        [c.key, c.value]
      );
    }

    await db.run('COMMIT;');
    res.status(200).json({ success: true, message: 'Dados importados com sucesso para o Colmeia Digital.' });
  } catch (error: any) {
    await db.run('ROLLBACK;');
    res.status(500).json({ message: 'Falha ao importar dados.', error: error.message });
  }
}
