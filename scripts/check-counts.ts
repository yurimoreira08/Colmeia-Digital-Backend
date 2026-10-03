import { prisma } from '../src/data/prisma.js';

async function checkCounts() {
  try {
    const summary: Array<{ tabela: string; total: number }> = await prisma.$queryRawUnsafe(`
      SELECT 'users' as tabela, count(*)::int as total from users
      UNION ALL SELECT 'apiaries', count(*)::int from apiaries
      UNION ALL SELECT 'boxes', count(*)::int from boxes
      UNION ALL SELECT 'review_reports', count(*)::int from review_reports
      UNION ALL SELECT 'manejos', count(*)::int from manejos
      UNION ALL SELECT 'sessions', count(*)::int from sessions
      UNION ALL SELECT 'notifications', count(*)::int from notifications;
    `);

    console.log('\n=========================================');
    console.log('  1. CONTAGEM DAS TABELAS');
    console.log('=========================================');
    console.table(summary);

    console.log('\n=========================================');
    console.log('  2. APIÁRIOS NO BANCO');
    console.log('=========================================');
    const apiaries = await prisma.apiary.findMany({ orderBy: { id: 'asc' } });
    console.table(apiaries.map(a => ({
      id: a.id,
      user_id: a.user_id,
      name: a.name,
      box_count_config: a.box_count,
      location: a.location,
    })));

    console.log('\n=========================================');
    console.log('  3. TODAS AS 20 CAIXAS NO BANCO');
    console.log('=========================================');
    const boxes = await prisma.box.findMany({
      orderBy: [{ apiary_id: 'asc' }, { position: 'asc' }, { id: 'asc' }],
    });
    console.table(boxes.map(b => ({
      id: b.id,
      apiary_id: b.apiary_id,
      name: b.name,
      position: b.position,
      archived: b.archived,
      created_at: b.created_at.toISOString().replace('T', ' ').substring(0, 19),
    })));

    console.log('\n=========================================');
    console.log('  4. ANÁLISE DE DUPLICATAS POR APIÁRIO');
    console.log('=========================================');
    const duplicates: Array<{ apiary_id: number; name: string; ocorrencias: number }> = await prisma.$queryRawUnsafe(`
      SELECT apiary_id, name, count(*)::int as ocorrencias
      FROM boxes
      GROUP BY apiary_id, name
      HAVING count(*) > 1
      ORDER BY apiary_id, name;
    `);

    if (duplicates.length === 0) {
      console.log('Nenhuma duplicata exata de nome encontrada.');
    } else {
      console.table(duplicates);
    }
    console.log('=========================================\n');

  } catch (error) {
    console.error('Erro ao consultar tabelas:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCounts();
