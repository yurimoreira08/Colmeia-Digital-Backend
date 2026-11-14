import { prisma } from '../prisma.js';
import type { User } from '../../types/mobile-models.js';

function mapPrismaUser(u: any): User {
  const termsAt = u.terms_accepted_at instanceof Date ? u.terms_accepted_at.toISOString() : u.terms_accepted_at ? String(u.terms_accepted_at) : null;
  const termsVer = u.terms_version || u.terms_accepted_version || null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    passwordHash: u.password_hash,
    photo: u.photo || null,
    terms_accepted_at: termsAt,
    terms_version: termsVer,
    termsAcceptedAt: termsAt || undefined,
    termsAcceptedVersion: termsVer || undefined,
    createdAt: u.created_at instanceof Date ? u.created_at.toISOString() : String(u.created_at),
    updatedAt: u.updated_at instanceof Date ? u.updated_at.toISOString() : String(u.updated_at),
  };
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalized },
  });
  return user ? mapPrismaUser(user) : null;
}

export async function findUserById(id: number): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { id },
  });
  return user ? mapPrismaUser(user) : null;
}

export async function createUser(params: {
  name: string;
  email: string;
  passwordHash: string;
  termsAcceptedVersion?: string;
}): Promise<User> {
  const normalizedEmail = params.email.trim().toLowerCase();
  const version = params.termsAcceptedVersion || 'v1';
  const user = await prisma.user.create({
    data: {
      name: params.name.trim(),
      email: normalizedEmail,
      password_hash: params.passwordHash,
      terms_accepted_at: new Date(),
      terms_version: version,
      terms_accepted_version: version,
    },
  });
  return mapPrismaUser(user);
}

export async function acceptUserTerms(
  id: number,
  version: string = 'v1'
): Promise<{ success: boolean; terms_accepted_at: string; terms_version: string; user: User }> {
  const now = new Date();
  const updated = await prisma.user.update({
    where: { id },
    data: {
      terms_accepted_at: now,
      terms_version: version,
      terms_accepted_version: version,
    },
  });
  return {
    success: true,
    terms_accepted_at: now.toISOString(),
    terms_version: version,
    user: mapPrismaUser(updated),
  };
}

export async function updateUser(
  id: number,
  params: { name?: string; email?: string; photo?: string | null; termsAcceptedVersion?: string }
): Promise<User> {
  const data: any = {};
  if (params.name) data.name = params.name.trim();
  if (params.email) data.email = params.email.trim().toLowerCase();
  if (Object.hasOwn(params, 'photo')) {
    data.photo = params.photo || null;
  }
  if (params.termsAcceptedVersion) {
    data.terms_accepted_at = new Date();
    data.terms_version = params.termsAcceptedVersion;
    data.terms_accepted_version = params.termsAcceptedVersion;
  }

  const user = await prisma.user.update({
    where: { id },
    data,
  });
  return mapPrismaUser(user);
}

export async function findUserByName(name: string): Promise<User | null> {
  const user = await prisma.user.findFirst({
    where: {
      name: {
        equals: name.trim(),
        mode: 'insensitive',
      },
    },
  });
  return user ? mapPrismaUser(user) : null;
}

export async function updateUserPassword(
  id: number,
  passwordHash: string
): Promise<User> {
  const user = await prisma.user.update({
    where: { id },
    data: {
      password_hash: passwordHash,
    },
  });
  return mapPrismaUser(user);
}
