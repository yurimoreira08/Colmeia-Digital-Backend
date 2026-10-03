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

export async function listRecentNotifications(limit = 50, userId?: number): Promise<NotificationRecord[]> {
  const where: any = {};
  if (userId !== undefined) {
    where.user_id = userId;
  }

  const rows = await prisma.notification.findMany({
    where,
    orderBy: [
      { created_at: 'desc' },
      { id: 'desc' },
    ],
    take: limit,
  });

  return rows.map(mapPrismaNotification);
}

export async function getNotificationById(id: number, userId?: number): Promise<NotificationRecord | null> {
  const where: any = { id };
  if (userId !== undefined) {
    where.user_id = userId;
  }

  const row = await prisma.notification.findFirst({
    where,
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
  const where: any = { id };
  if (userId !== undefined) {
    where.user_id = userId;
  }

  await prisma.notification.updateMany({
    where,
    data: { read: 1 },
  });
}

export async function markAllNotificationsAsRead(userId?: number): Promise<void> {
  const where: any = {};
  if (userId !== undefined) {
    where.user_id = userId;
  }

  await prisma.notification.updateMany({
    where,
    data: { read: 1 },
  });
}
