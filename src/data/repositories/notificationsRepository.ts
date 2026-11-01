import { prisma } from '../prisma.js';

export type NotificationRecord = {
  id: number;
  title: string;
  subtitle: string;
  createdAt: string;
  read: boolean;
};

function mapPrismaNotification(n: any): NotificationRecord {
  return {
    id: n.id,
    title: n.title,
    subtitle: n.subtitle,
    createdAt: n.created_at instanceof Date ? n.created_at.toISOString() : String(n.created_at),
    read: n.read === 1,
  };
}

export async function listRecentNotifications(userId: number, limit = 50): Promise<NotificationRecord[]> {
  if (!userId || typeof userId !== 'number') {
    return [];
  }

  const rows = await prisma.notification.findMany({
    where: {
      user_id: userId,
    },
    orderBy: [
      { created_at: 'desc' },
      { id: 'desc' },
    ],
    take: limit,
  });

  return rows.map(mapPrismaNotification);
}

export async function getNotificationById(id: number, userId?: number): Promise<NotificationRecord | null> {
  if (!userId) return null;
  const row = await prisma.notification.findFirst({
    where: { id, user_id: userId },
  });

  return row ? mapPrismaNotification(row) : null;
}

export async function createNotification(
  params: {
    title: string;
    subtitle: string;
  },
  userId?: number,
): Promise<NotificationRecord> {
  const row = await prisma.notification.create({
    data: {
      title: params.title.trim(),
      subtitle: params.subtitle.trim(),
      read: 0,
      user_id: userId ?? null,
    },
  });

  return mapPrismaNotification(row);
}

export async function markNotificationAsRead(id: number, userId?: number): Promise<void> {
  if (!userId) return;
  await prisma.notification.updateMany({
    where: { id, user_id: userId },
    data: { read: 1 },
  });
}

export async function markAllNotificationsAsRead(userId?: number): Promise<void> {
  if (!userId) return;
  await prisma.notification.updateMany({
    where: { user_id: userId },
    data: { read: 1 },
  });
}
