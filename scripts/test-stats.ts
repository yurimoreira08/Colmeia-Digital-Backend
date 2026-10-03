import { prisma } from '../src/data/prisma.js';
import { getReportsStats } from '../src/services/reports.service.js';
import { createApiary } from '../src/data/repositories/apiaryRepository.js';

async function testTimezoneDiscrepancy() {
  try {
    console.log('===============================================================');
    console.log('  PROVA DA CAUSA RAIZ: DISCREPÂNCIA DE FUSO HORÁRIO NO TESTE');
    console.log('===============================================================\n');

    // 1. Criar usuário e apiário agora
    const user = await prisma.user.create({
      data: {
        email: `tz_test_${Date.now()}@colmeiadigital.local`,
        name: 'Usuário Teste TZ',
        password_hash: 'hash',
      }
    });

    const apiary = await createApiary({
      name: 'Apiário Fuso Horário',
      location: 'Local TZ',
      boxCount: 2,
      description: 'Desc',
    }, user.id);

    console.log(`1. Apiário criado no Supabase: ID ${apiary.id}`);
    console.log(`   Data createdAt gravada no Supabase (UTC): "${apiary.createdAt}"`);
    console.log(`   Data fatiada (extractDateOnly): "${apiary.createdAt.slice(0, 10)}" (Dia 30 em UTC!)\n`);

    // 2. Simular exatamente o que o PowerShell no Windows gerou:
    // No Windows às 23:45 (GMT-3), (Get-Date) é dia 29!
    const powershellLocalTodayIso = '2026-09-29T23:45:00.000Z'; // O que (Get-Date) gerou no Windows
    const powershellLocalPastIso = '2026-08-30T23:45:00.000Z';

    console.log(`2. Parâmetros enviados pelo PowerShell no Windows (Horário Local de Brasília):`);
    console.log(`   fromIso: "${powershellLocalPastIso}"`);
    console.log(`   toIso:   "${powershellLocalTodayIso}" (Dia 29!)\n`);

    // 3. Executar getReportsStats com esses parâmetros
    const statsComDataLocal = await getReportsStats({
      fromIso: powershellLocalPastIso,
      toIso: powershellLocalTodayIso,
      chartFilter: 'revisoes',
    }, user.id);

    console.log('3. Resultado com os parâmetros do PowerShell:');
    console.log(`   totalApiaries retornado: ${statsComDataLocal.metrics.totalApiaries}`);
    console.log(`   Motivo do descarte: "${apiary.createdAt.slice(0, 10)}" > "${powershellLocalTodayIso.slice(0, 10)}" ("2026-09-30" > "2026-09-29") -> Descartado por parecer estar no futuro!\n`);

    // 4. Agora executar com toIso em UTC real ou com o dia seguinte
    const utcTodayIso = new Date().toISOString();
    const statsComDataUtc = await getReportsStats({
      fromIso: powershellLocalPastIso,
      toIso: utcTodayIso,
      chartFilter: 'revisoes',
    }, user.id);

    console.log('4. Resultado se toIso for em UTC real ou amanhã:');
    console.log(`   toIso UTC: "${utcTodayIso}"`);
    console.log(`   totalApiaries retornado: ${statsComDataUtc.metrics.totalApiaries}`);

    // Limpar
    await prisma.apiary.deleteMany({ where: { id: apiary.id } });
    await prisma.user.deleteMany({ where: { id: user.id } });

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testTimezoneDiscrepancy();
