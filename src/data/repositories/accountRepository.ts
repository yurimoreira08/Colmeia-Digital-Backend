import { prisma } from '../prisma.js';

/**
 * Apaga a conta e tudo o que é dela, numa transação, dos filhos para o pai.
 * As FKs do Postgres já fazem a cascata; apagar explicitamente deixa a regra
 * visível aqui e não depende só do schema.
 */
export async function deleteUserAndData(userId: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const apiaryIds = (await tx.apiary.findMany({ where: { user_id: userId }, select: { id: true } })).map((a) => a.id);
    const ofUser = { OR: [{ user_id: userId }, { apiary_id: { in: apiaryIds } }] };

    await tx.manejo.deleteMany({ where: ofUser });
    await tx.reviewReport.deleteMany({ where: ofUser });
    await tx.box.deleteMany({ where: { apiary_id: { in: apiaryIds } } });
    await tx.apiary.deleteMany({ where: { user_id: userId } });
    await tx.notification.deleteMany({ where: { user_id: userId } });
    await tx.deletedRecord.deleteMany({ where: { user_id: userId } });
    await tx.passwordReset.deleteMany({ where: { user_id: userId } });
    await tx.session.deleteMany({ where: { user_id: userId } });
    await tx.user.deleteMany({ where: { id: userId } });
  });
}
