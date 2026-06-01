import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const isProduction = process.env.NODE_ENV === 'production';

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Keep each app process's Prisma pool deliberately small. Managed Postgres
// plans often have low connection caps; a large per-process pool plus PM2 or
// cluster workers can starve the database and take the whole API down.
function buildDbUrl(): string {
  const base = process.env.DATABASE_URL ?? '';
  if (!base || base.includes('connection_limit')) return base;
  const sep = base.includes('?') ? '&' : '?';
  const connectionLimit = parsePositiveInt(
    process.env.DB_CONNECTION_LIMIT,
    isProduction ? 3 : 10,
  );
  const poolTimeout = parsePositiveInt(process.env.DB_POOL_TIMEOUT, 20);
  return `${base}${sep}connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: { db: { url: buildDbUrl() } },
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
