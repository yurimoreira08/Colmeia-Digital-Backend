import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de dados conhecidos para testes...');

  const testEmail = 'teste@colmeiadigital.com';
  const testPassword = 'Senha123!';
  const passwordHash = bcrypt.hashSync(testPassword, 10);

  // 1. Usuário fixo de teste
  const user = await prisma.user.upsert({
    where: { email: testEmail },
    update: {
      name: 'Apicultor Teste',
      password_hash: passwordHash,
    },
    create: {
      email: testEmail,
      name: 'Apicultor Teste',
      password_hash: passwordHash,
    },
  });

  console.log(`👤 Usuário de teste pronto: ${user.email} (ID: ${user.id}) | Senha: ${testPassword}`);

  // 2. Apiários de teste vinculados ao usuário
  // Limpar dados anteriores do usuário de teste para garantir estado 100% previsível
  await prisma.reviewReport.deleteMany({ where: { user_id: user.id } });
  await prisma.manejo.deleteMany({ where: { user_id: user.id } });
  await prisma.box.deleteMany({ where: { user_id: user.id } });
  await prisma.apiary.deleteMany({ where: { user_id: user.id } });

  const apiary1 = await prisma.apiary.create({
    data: {
      user_id: user.id,
      name: 'Apiário Vale das Flores',
      location: 'Setor Norte - Sítio São Bento',
      description: 'Apiário principal para produção de mel silvestre',
      box_count: 2,
    },
  });

  const apiary2 = await prisma.apiary.create({
    data: {
      user_id: user.id,
      name: 'Apiário Morro do Sol',
      location: 'Setor Sul - Mata Nativa',
      description: 'Apiário secundário focado em multiplicação de enxames',
      box_count: 1,
    },
  });

  console.log(`🏡 Apiários criados: "${apiary1.name}" (ID: ${apiary1.id}) e "${apiary2.name}" (ID: ${apiary2.id})`);

  // 3. Caixas conhecidas
  const box1 = await prisma.box.create({
    data: {
      apiary_id: apiary1.id,
      user_id: user.id,
      name: 'Caixa 01 - Rainha Alfa',
      position: 1,
      archived: 0,
    },
  });

  const box2 = await prisma.box.create({
    data: {
      apiary_id: apiary1.id,
      user_id: user.id,
      name: 'Caixa 02 - Núcleo Jovem',
      position: 2,
      archived: 0,
    },
  });

  const box3 = await prisma.box.create({
    data: {
      apiary_id: apiary2.id,
      user_id: user.id,
      name: 'Caixa 03 - Forte',
      position: 1,
      archived: 0,
    },
  });

  console.log(`📦 Caixas criadas: 3 caixas distribuídas nos apiários`);

  // 4. Revisão de teste
  const revisao = await prisma.reviewReport.create({
    data: {
      user_id: user.id,
      apiary_id: apiary1.id,
      apiary_name: apiary1.name,
      caixa_id: box1.id,
      caixa_name: box1.name,
      tipo: 'Completa',
      checked_options: JSON.stringify([
        'Postura regular',
        'Presença de ovos do dia',
        'Espaço adequado no ninho',
        'Sem sinais de doenças',
      ]),
      observacoes: 'Enxame muito ativo e populoso, produção de própolis intensa.',
      indicacoes: 'Adicionar melgueira na próxima semana.',
      archived: 0,
    },
  });

  console.log(`📋 Revisão criada (ID: ${revisao.id}) para "${box1.name}"`);

  // 5. Manejo de teste
  const manejo = await prisma.manejo.create({
    data: {
      user_id: user.id,
      apiary_id: apiary1.id,
      apiary_name: apiary1.name,
      caixa_id: box1.id,
      caixa_name: box1.name,
      tipo: 'Alimentação',
      revisao_id: revisao.id,
      checked_options: JSON.stringify([
        'Xarope 1:1 fornecido',
        'Alimentador tipo Boardman limpo',
      ]),
      observacoes: 'Fornecido 500ml de xarope energético.',
      indicacoes: 'Monitorar consumo em 48 horas.',
      archived: 0,
    },
  });

  console.log(`🛠️ Manejo criado (ID: ${manejo.id}) vinculado à revisão ${revisao.id}`);

  // 6. Notificação de teste
  await prisma.notification.create({
    data: {
      user_id: user.id,
      title: 'Bem-vindo ao Colmeia Digital',
      subtitle: 'Seu ambiente de testes está configurado e pronto para uso.',
      read: 0,
    },
  });

  console.log('✅ Seed finalizado com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro durante a execução do seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
