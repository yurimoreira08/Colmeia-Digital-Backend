import { prisma } from '../prisma.js';

export async function getConfig(key: string): Promise<string | null> {
  const row = await prisma.appConfig.findUnique({
    where: { key },
  });
  return row?.value ?? null;
}

export async function setConfig(key: string, value: string): Promise<void> {
  await prisma.appConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}
