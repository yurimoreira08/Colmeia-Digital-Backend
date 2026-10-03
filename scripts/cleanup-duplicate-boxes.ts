import { prisma } from '../src/data/prisma.js';

interface DuplicateCandidate {
  id: number;
  apiary_id: number;
  name: string;
  position: number;
  created_at: Date;
  review_count: number;
  manejo_count: number;
}

interface CleanupPlan {
  apiary_id: number;
  apiary_name: string;
  position: number;
  kept_box: DuplicateCandidate;
  removed_box: DuplicateCandidate;
  reason: string;
}

async function main() {
  const isExecuteMode = process.argv.includes('--execute') || process.argv.includes('--apply');

  console.log('===============================================================');
  if (isExecuteMode) {
    console.log('  ⚠️  EXECUTANDO LIMPEZA REAL DE CAIXAS DUPLICADAS');
    console.log('  (Modo Execução: As duplicatas serão removidas do banco)');
  } else {
    console.log('  RELATÓRIO DE DRY-RUN: LIMPEZA DE CAIXAS DUPLICADAS');
    console.log('  (Modo Simulação - Nenhuma alteração realizada no banco)');
  }
  console.log('===============================================================\n');

  try {
    const apiaries = await prisma.apiary.findMany({ orderBy: { id: 'asc' } });
    const plans: CleanupPlan[] = [];

    for (const apiary of apiaries) {
      const allBoxes = await prisma.box.findMany({
        where: { apiary_id: apiary.id },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
      });

      // Agrupar caixas por posição
      const positionMap = new Map<number, typeof allBoxes>();
      for (const box of allBoxes) {
        const list = positionMap.get(box.position) || [];
        list.push(box);
        positionMap.set(box.position, list);
      }

      for (const [position, boxesInPos] of positionMap.entries()) {
        if (boxesInPos.length > 1) {
          const enriched: DuplicateCandidate[] = await Promise.all(
            boxesInPos.map(async (b) => {
              const review_count = await prisma.reviewReport.count({
                where: { apiary_id: apiary.id, caixa_id: b.id },
              });
              const manejo_count = await prisma.manejo.count({
                where: { apiary_id: apiary.id, caixa_id: b.id },
              });
              return {
                id: b.id,
                apiary_id: b.apiary_id,
                name: b.name,
                position: b.position,
                created_at: b.created_at,
                review_count,
                manejo_count,
              };
            })
          );

          // Regra de desempate:
          // 1. Quem tem histórico (reviews + manejos) ganha
          // 2. Empate: quem é mais antigo ganha (created_at asc / id asc)
          enriched.sort((a, b) => {
            const totalA = a.review_count + a.manejo_count;
            const totalB = b.review_count + b.manejo_count;

            if (totalA !== totalB) {
              return totalB - totalA;
            }

            return a.created_at.getTime() - b.created_at.getTime() || a.id - b.id;
          });

          const kept = enriched[0];
          const removed = enriched.slice(1);

          for (const rem of removed) {
            let reason = '';
            const totalKept = kept.review_count + kept.manejo_count;
            const totalRem = rem.review_count + rem.manejo_count;

            if (totalKept > 0 && totalRem === 0) {
              reason = `Caixa ${kept.id} possui histórico (${kept.review_count} rev). Caixa ${rem.id} vazia.`;
            } else if (totalKept === 0 && totalRem === 0) {
              reason = `Empate (ambas vazias). Mantida a mais antiga (ID ${kept.id} vs ID ${rem.id}).`;
            } else {
              reason = `Mantida caixa com maior histórico.`;
            }

            plans.push({
              apiary_id: apiary.id,
              apiary_name: apiary.name,
              position,
              kept_box: kept,
              removed_box: rem,
              reason,
            });
          }
        }
      }
    }

    if (plans.length === 0) {
      console.log('✅ Nenhuma duplicidade encontrada nos apiários. O banco já está 100% limpo!');
      return;
    }

    console.log(`📋 Decisão para as ${plans.length} caixas duplicadas:\n`);

    console.table(
      plans.map((p, idx) => ({
        '#': idx + 1,
        Apiário: `${p.apiary_name} (ID: ${p.apiary_id})`,
        Pos: p.position,
        'MANTER': `${p.kept_box.name} [ID ${p.kept_box.id}]`,
        'REMOVER': `${p.removed_box.name} [ID ${p.removed_box.id}]`,
        'Histórico Mantido': `${p.kept_box.review_count} rev`,
        Critério: p.reason,
      }))
    );

    const idsToDelete = plans.map((p) => p.removed_box.id);

    if (isExecuteMode) {
      console.log('\n⏳ Excluindo as 10 caixas duplicadas do banco de dados...');
      const deleteResult = await prisma.box.deleteMany({
        where: {
          id: { in: idsToDelete },
        },
      });

      console.log(`\n===============================================================`);
      console.log(`✅ SUCESSO! ${deleteResult.count} caixas duplicadas foram excluídas.`);
      console.log(`===============================================================\n`);
    } else {
      console.log('\n---------------------------------------------------------------');
      console.log(`💡 Para executar esta limpeza de fato no banco, execute:`);
      console.log(`   npm run cleanup-db`);
      console.log('---------------------------------------------------------------\n');
    }

  } catch (error) {
    console.error('Erro na limpeza:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
