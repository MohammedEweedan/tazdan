import { PrismaClient, type Prisma } from '@prisma/client';

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

const client =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: { db: { url: buildDbUrl() } },
  });

// Some Prisma/database combinations can resolve the callback's return value
// even when a deferred constraint rejects COMMIT. Force pending constraints
// while query errors are still observable, before returning financial success.
// Keep constraints deferred throughout the user's callback so multi-leg
// journals can still be written one leg at a time.
const guarded = Symbol.for('tazdan.prisma.constraints-guarded');
if (!(client as any)[guarded]) {
  const transact = client.$transaction.bind(client) as any;
  (client as any).$transaction = (operation: any, options?: any) => {
    if (typeof operation === 'function') {
      return transact(async (tx: Prisma.TransactionClient) => {
        const result = await operation(tx);
        await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
        return result;
      }, options);
    }
    return transact([...operation, client.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE')], options)
      .then((results: unknown[]) => results.slice(0, -1));
  };
  (client as any)[guarded] = true;
}

export const prisma = client;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
