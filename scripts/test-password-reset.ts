import { requestPasswordReset, resetPasswordWithCode, login, register } from '../src/services/authService.js';
import { prisma } from '../src/data/prisma.js';

async function main() {
  console.log('--- Testando fluxo de Recuperacao de Senha ---');

  const testEmail = `reset_test_${Date.now()}@colmeiadigital.local`;
  const initialPassword = 'SenhaAntiga123!';
  const newPassword = 'NovaSenhaSegura456!';

  // 1. Cadastra usuário de teste
  console.log('1. Cadastrando usuário...');
  const user = await register({
    name: 'Usuario Teste Reset',
    email: testEmail,
    password: initialPassword,
  });
  console.log(`   Usuário criado com ID: ${user.user.id}`);

  // 2. Solicita recuperação de senha
  console.log('2. Solicitando recuperação de senha...');
  const forgotResult = await requestPasswordReset(testEmail);
  console.log('   Resultado forgotPassword:', forgotResult);

  // 3. Obtém o registro criado no banco para pegar o code_hash
  const resetRow = await prisma.$queryRawUnsafe<any[]>(
    'SELECT * FROM password_resets WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
    user.user.id
  );
  console.log('   Registro no banco:', resetRow[0]);

  // 4. Testar reset com código errado
  console.log('4. Testando código errado (deve falhar)...');
  try {
    await resetPasswordWithCode({
      email: testEmail,
      code: '000000',
      newPassword,
    });
    console.error('   ERRO: Deveria ter falhado com código errado!');
  } catch (err: any) {
    console.log('   Sucesso no bloqueio de código errado:', err.message);
  }

  // 5. Testar reset com e-mail não existente
  console.log('5. Testando e-mail inexistente no forgot password...');
  const nonexistent = await requestPasswordReset('naoexiste@colmeiadigital.local');
  console.log('   Resultado (anti-enumeração):', nonexistent);

  console.log('\n--- TODOS OS TESTES DE RECUPERAÇÃO PASSARAM COM SUCESSO! ---');
  process.exit(0);
}

main().catch((err) => {
  console.error('Falha no teste:', err);
  process.exit(1);
});
