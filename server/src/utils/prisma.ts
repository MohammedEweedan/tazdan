import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Append connection_limit to DATABASE_URL so Prisma's pool is large enough
// for concurrent load (default = num_cpus*2+1 ≈ 9–17, too small for load tests).
function buildDbUrl(): string {
  const base = process.env.DATABASE_URL ?? '';
  if (!base || base.includes('connection_limit')) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}connection_limit=50&pool_timeout=30`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: { db: { url: buildDbUrl() } },
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
