import { getDatabase, initializeDatabase } from './database.js';

export async function seedDatabase(): Promise<void> {
  await initializeDatabase();
  const db = await getDatabase();

  console.log('[seeds] Seeding mock data for Colmeia Digital...');

  // 1. User
  const existingUser = await db.get<any>('SELECT * FROM users WHERE email = ?', ['apicultor@colmeiadigital.com']);
  let userId = existingUser?.id;

  if (!userId) {
    const res = await db.run(
      `INSERT INTO users (name, email, password_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?);`,
      [
        'Apicultor Modelo',
        'apicultor@colmeiadigital.com',
        'c4ca4238a0b923820dcc509a6f75849b', // demo hash
        new Date().toISOString(),
        new Date().toISOString(),
      ]
    );
    userId = res.lastID;
  }

  // 2. Apiary 1
  const apiary1Res = await db.run(
    `INSERT INTO apiaries (user_id, name, location, box_count, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      userId,
      'Apiário Vale das Flores',
      'Setor Norte - Fazenda Primavera',
      4,
      'Unidade principal com florada de eucalipto e silvestre.',
      new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
      new Date().toISOString(),
    ]
  );
  const apiary1Id = apiary1Res.lastID!;

  // 3. Apiary 2
  const apiary2Res = await db.run(
    `INSERT INTO apiaries (user_id, name, location, box_count, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      userId,
      'Apiário Serra Verde',
      'Encosta da Serra - Km 14',
      3,
      'Unidade de altitude com foco em própolis verde.',
      new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
      new Date().toISOString(),
    ]
  );
  const apiary2Id = apiary2Res.lastID!;

  // 4. Boxes for Apiary 1
  const box1Res = await db.run(
    `INSERT INTO boxes (apiary_id, user_id, name, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?);`,
    [apiary1Id, userId, 'Colmeia 01 - Matriz', 1, new Date(Date.now() - 28 * 24 * 3600 * 1000).toISOString(), new Date().toISOString()]
  );
  const box2Res = await db.run(
    `INSERT INTO boxes (apiary_id, user_id, name, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?);`,
    [apiary1Id, userId, 'Colmeia 02', 2, new Date(Date.now() - 28 * 24 * 3600 * 1000).toISOString(), new Date().toISOString()]
  );
  const box3Res = await db.run(
    `INSERT INTO boxes (apiary_id, user_id, name, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?);`,
    [apiary1Id, userId, 'Colmeia 03', 3, new Date(Date.now() - 28 * 24 * 3600 * 1000).toISOString(), new Date().toISOString()]
  );
  const box4Res = await db.run(
    `INSERT INTO boxes (apiary_id, user_id, name, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?);`,
    [apiary1Id, userId, 'Colmeia 04', 4, new Date(Date.now() - 28 * 24 * 3600 * 1000).toISOString(), new Date().toISOString()]
  );

  // Boxes for Apiary 2
  await db.run(
    `INSERT INTO boxes (apiary_id, user_id, name, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?);`,
    [apiary2Id, userId, 'Colmeia S1', 1, new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(), new Date().toISOString()]
  );
  await db.run(
    `INSERT INTO boxes (apiary_id, user_id, name, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?);`,
    [apiary2Id, userId, 'Colmeia S2', 2, new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(), new Date().toISOString()]
  );
  await db.run(
    `INSERT INTO boxes (apiary_id, user_id, name, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?);`,
    [apiary2Id, userId, 'Colmeia S3', 3, new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(), new Date().toISOString()]
  );

  // 5. Revisions
  const rev1Res = await db.run(
    `INSERT INTO review_reports (user_id, caixa_id, caixa_name, apiary_id, apiary_name, tipo, checked_options, observacoes, indicacoes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      userId,
      box1Res.lastID,
      'Colmeia 01 - Matriz',
      apiary1Id,
      'Apiário Vale das Flores',
      'apiario',
      JSON.stringify(['rainha', 'cria-fechada', 'cria-nova-3-dias', 'mel', 'polen', 'forca-boa']),
      'Colônia forte com postura regular em padrão uniforme. Boa reserva de alimento.',
      'Adicionar sobrecaixa na próxima semana para expansão.',
      new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
    ]
  );

  await db.run(
    `INSERT INTO review_reports (user_id, caixa_id, caixa_name, apiary_id, apiary_name, tipo, checked_options, observacoes, indicacoes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      userId,
      box2Res.lastID,
      'Colmeia 02',
      apiary1Id,
      'Apiário Vale das Flores',
      'apiario',
      JSON.stringify(['rainha', 'cria-aberta', 'sem-espaco', 'forca-boa']),
      'Quadro de ninho completo, enxame com alta taxa de operárias.',
      'Realizar divisão ou acrescentar sobreninho com urgência.',
      new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString(),
    ]
  );

  // 6. Manejos
  await db.run(
    `INSERT INTO manejos (user_id, caixa_id, caixa_name, apiary_id, apiary_name, tipo, revisao_id, checked_options, observacoes, indicacoes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      userId,
      box1Res.lastID,
      'Colmeia 01 - Matriz',
      apiary1Id,
      'Apiário Vale das Flores',
      'apiario',
      rev1Res.lastID,
      JSON.stringify([{ id: 'colocacao-sobrecaixa', obs: '1 sobrecaixa com cera alveolada colocada', ind: 'Verificar puxada em 10 dias' }]),
      'Manejo preventivo para florada principal.',
      'Acompanhar temperatura e fluxo de entrada.',
      new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    ]
  );

  // 7. Notifications
  await db.run(
    `INSERT INTO notifications (user_id, title, subtitle, read, created_at)
     VALUES (?, ?, ?, ?, ?);`,
    [
      userId,
      'Bem-vindo ao Colmeia Digital',
      'Seu sistema de gestão e monitoramento de caixas está pronto.',
      0,
      new Date().toISOString(),
    ]
  );

  console.log('[seeds] Mock data seeded successfully!');
}
