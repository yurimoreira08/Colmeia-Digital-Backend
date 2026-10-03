import { prisma } from '../src/data/prisma.js';

async function inspect() {
  try {
    console.log('\n--- 1. APIÁRIOS NO BANCO ---');
    const apiaries = await prisma.apiary.findMany();
    console.table(apiaries);

    console.log('\n--- 2. TODAS AS 20 CAIXAS NO BANCO ---');
    const boxes = await prisma.box.findMany({
      orderBy: [{ apiary_id: 'asc' }, { position: 'asc' }, { id: 'asc' }],
    });
    console.table(boxes.map(b => ({
      id: b.id,
      apiary_id: b.apiary_id,
      name: b.name,
      position: b.position,
      archived: b.archived,
      created_at: b.created_at.toISOString(),
    })));

    console.log('\n--- 3. DUPLICATAS DE NOMES POR APIÁRIO ---');
    const duplicates = await prisma.$queryRawUnsafe(`
      SELECT apiary_id, name, count(*) as ocorrencias
      FROM boxes
      GROUP BY apiary_id, name
      HAVING count(*) > 1
      ORDER BY apiary_id, name;
    `);
    console.table(duplicates);

    console.log('\n--- 4. REVISÕES NO BANCO ---');
    const reviews = await prisma.reviewReport.findMany();
    console.table(reviews);

    console.log('\n--- 5. MANEJOS NO BANCO ---');
    const manejos = await prisma.manejo.findMany();
    console.table(manejos);

  } catch (err) {
    console.error('Erro na inspeção:', err);
  } finally {
    await prisma.$disconnect();
  }
}

inspect();
