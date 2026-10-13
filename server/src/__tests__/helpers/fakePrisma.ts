/**
 * Minimal in-memory Prisma stand-in for identity tests (no Postgres needed).
 *
 * Every call yields once (like a DB round trip) and then runs synchronously,
 * so each statement is atomic while parallel requests interleave between
 * statements — the same place races happen against a real database. A
 * conditional `updateMany` therefore behaves like Postgres' row-locked
 * UPDATE … WHERE: the condition is evaluated against the current row.
 */
type Row = Record<string, any>;

const isPlainObject = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v);

const norm = (v: any) => (v instanceof Date ? v.getTime() : v);

function cmp(a: any, b: any): number {
  const x = norm(a); const y = norm(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

function matchField(value: any, cond: any): boolean {
  if (cond === undefined) return true;
  if (cond === null) return value === null || value === undefined;
  if (!isPlainObject(cond)) return norm(value) === norm(cond);
  const insensitive = cond.mode === 'insensitive';
  const ci = (s: any) => (insensitive && typeof s === 'string' ? s.toLowerCase() : s);
  for (const [op, arg] of Object.entries(cond)) {
    switch (op) {
      case 'mode': break;
      case 'equals': if (arg === null ? !(value === null || value === undefined) : ci(norm(value)) !== ci(norm(arg))) return false; break;
      case 'not': if (isPlainObject(arg) ? matchField(value, arg) : (arg === null ? (value === null || value === undefined) : norm(value) === norm(arg))) return false; break;
      case 'in': if (!(arg as any[]).map(norm).includes(norm(value))) return false; break;
      case 'notIn': if ((arg as any[]).map(norm).includes(norm(value))) return false; break;
      case 'gt': if (value === null || value === undefined || cmp(value, arg) <= 0) return false; break;
      case 'gte': if (value === null || value === undefined || cmp(value, arg) < 0) return false; break;
      case 'lt': if (value === null || value === undefined || cmp(value, arg) >= 0) return false; break;
      case 'lte': if (value === null || value === undefined || cmp(value, arg) > 0) return false; break;
      case 'startsWith': if (typeof value !== 'string' || !ci(value).startsWith(ci(arg))) return false; break;
      default: throw new Error(`fakePrisma: unsupported operator ${op}`);
    }
  }
  return true;
}

export function matches(row: Row, where: Row | undefined): boolean {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (key === 'OR') { if (!(cond as Row[]).some((w) => matches(row, w))) return false; continue; }
    if (key === 'AND') { if (!(cond as Row[]).every((w) => matches(row, w))) return false; continue; }
    if (key === 'NOT') { if ((Array.isArray(cond) ? cond : [cond]).some((w: Row) => matches(row, w))) return false; continue; }
    // Compound unique, e.g. userId_fingerprint: { userId, fingerprint }
    if (key.includes('_') && isPlainObject(cond) && Object.keys(cond).every((k) => key.split('_').includes(k))) {
      if (!matches(row, cond)) return false;
      continue;
    }
    if (!matchField(row[key], cond)) return false;
  }
  return true;
}

function applyData(row: Row, data: Row): void {
  for (const [key, val] of Object.entries(data)) {
    if (val === undefined) continue;
    if (isPlainObject(val)) {
      if ('increment' in val) { row[key] = (row[key] ?? 0) + val.increment; continue; }
      if ('decrement' in val) { row[key] = (row[key] ?? 0) - val.decrement; continue; }
      if ('set' in val) { row[key] = val.set; continue; }
      if ('create' in val || 'connect' in val) continue; // nested relations are not modelled
    }
    row[key] = val instanceof Date ? new Date(val.getTime()) : val;
  }
}

function project(row: Row | undefined, select?: Row): any {
  if (!row) return null;
  if (!select) return { ...row };
  const out: Row = {};
  for (const [k, v] of Object.entries(select)) if (v) out[k] = row[k];
  return out;
}

function order(rows: Row[], orderBy?: Row | Row[]): Row[] {
  const specs = orderBy ? (Array.isArray(orderBy) ? orderBy : [orderBy]) : [];
  return [...rows].sort((a, b) => {
    for (const s of specs) {
      const [k, dir] = Object.entries(s)[0];
      const c = cmp(a[k], b[k]);
      if (c) return dir === 'desc' ? -c : c;
    }
    return 0;
  });
}

let seq = 0;
export const fakeId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

const tick = () => new Promise<void>((r) => setImmediate(r));

const DEFAULTS: Record<string, () => Row> = {
  user: () => ({
    id: fakeId(), role: 'USER', status: 'ACTIVE', kycStatus: 'NOT_SUBMITTED', kycTier: 'TIER_0',
    firstName: 'Test', lastName: 'User', phone: null, phoneCountryCode: null, dateOfBirth: null,
    twoFactorEnabled: false, twoFactorSecret: null, emailVerified: false,
    emailVerificationToken: null, emailVerificationExpires: null, emailVerificationCode: null, emailVerificationCodeExpires: null,
    passwordResetToken: null, passwordResetCode: null, passwordResetAttempts: 0, passwordResetExpires: null,
    twoFactorRecoveryCode: null, twoFactorRecoveryExpires: null,
    failedLoginAttempts: 0, lockoutUntil: null, lastLoginAt: null, lastLoginIp: null,
    username: null, avatarUrl: null, profilePublic: false, referralCode: `ref${seq}`, phoneVerified: false,
    phoneOtpCode: null, phoneOtpExpires: null, createdAt: new Date(), updatedAt: new Date(),
  }),
  refreshToken: () => ({ id: fakeId(), revokedAt: null, replacedById: null, ipAddress: null, userAgent: null, createdAt: new Date() }),
  stepUpChallenge: () => ({ id: fakeId(), attempts: 0, consumedAt: null, createdAt: new Date() }),
  knownDevice: () => ({ id: fakeId(), lastSeenAt: new Date(), createdAt: new Date() }),
  loginHistory: () => ({ id: fakeId(), createdAt: new Date() }),
  securityEvent: () => ({ id: fakeId(), createdAt: new Date() }),
  wallet: () => ({ id: fakeId() }),
};

export function createFakePrisma() {
  const tables: Record<string, Row[]> = Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, []]));

  function model(name: string) {
    const rows = () => tables[name];
    return {
      async findUnique({ where, select }: { where: Row; select?: Row }) { await tick(); return project(rows().find((r) => matches(r, where)), select); },
      async findFirst({ where, select, orderBy }: { where?: Row; select?: Row; orderBy?: Row }) { await tick(); return project(order(rows().filter((r) => matches(r, where)), orderBy)[0], select); },
      async findMany({ where, select, orderBy, take }: { where?: Row; select?: Row; orderBy?: Row; take?: number } = {}) {
        await tick();
        const found = order(rows().filter((r) => matches(r, where)), orderBy);
        return (take ? found.slice(0, take) : found).map((r) => project(r, select));
      },
      async count({ where }: { where?: Row } = {}) { await tick(); return rows().filter((r) => matches(r, where)).length; },
      async create({ data, select }: { data: Row; select?: Row }) {
        await tick();
        const row = { ...DEFAULTS[name](), ...Object.fromEntries(Object.entries(data).filter(([, v]) => !(isPlainObject(v) && ('create' in v || 'connect' in v)))) };
        rows().push(row);
        return project(row, select);
      },
      async createMany({ data }: { data: Row[] }) { await tick(); for (const d of data) rows().push({ ...DEFAULTS[name](), ...d }); return { count: data.length }; },
      async update({ where, data, select }: { where: Row; data: Row; select?: Row }) {
        await tick();
        const row = rows().find((r) => matches(r, where));
        if (!row) throw Object.assign(new Error('Record to update not found.'), { code: 'P2025' });
        applyData(row, data);
        return project(row, select);
      },
      async updateMany({ where, data }: { where?: Row; data: Row }) {
        await tick();
        const hit = rows().filter((r) => matches(r, where));
        hit.forEach((r) => applyData(r, data));
        return { count: hit.length };
      },
      async upsert({ where, update, create }: { where: Row; update: Row; create: Row }) {
        await tick();
        const row = rows().find((r) => matches(r, where));
        if (row) { applyData(row, update); return { ...row }; }
        const fresh = { ...DEFAULTS[name](), ...create };
        rows().push(fresh);
        return { ...fresh };
      },
      async delete({ where }: { where: Row }) {
        await tick();
        const i = rows().findIndex((r) => matches(r, where));
        if (i < 0) throw Object.assign(new Error('Record to delete does not exist.'), { code: 'P2025' });
        return rows().splice(i, 1)[0];
      },
      async deleteMany({ where }: { where?: Row } = {}) {
        await tick();
        const keep = rows().filter((r) => !matches(r, where));
        const count = rows().length - keep.length;
        tables[name] = keep;
        return { count };
      },
    };
  }

  const client: Record<string, any> = { _tables: tables };
  for (const name of Object.keys(DEFAULTS)) client[name] = model(name);
  client.reset = () => { for (const k of Object.keys(tables)) tables[k] = []; };
  return client;
}

/** Minimal Express-like req/res pair for calling a controller directly. */
export function harness(opts: { body?: any; query?: any; params?: any; user?: any; headers?: Record<string, string>; ip?: string } = {}) {
  const req: any = {
    body: opts.body ?? {}, query: opts.query ?? {}, params: opts.params ?? {},
    user: opts.user, headers: opts.headers ?? {}, ip: opts.ip ?? '203.0.113.7', originalUrl: '/test',
    app: { get: () => undefined },
  };
  const res: any = {
    statusCode: 200, body: undefined as any,
    status(c: number) { this.statusCode = c; return this; },
    json(b: any) { this.body = b; return this; },
  };
  let error: any;
  const next = (e?: any) => { error = e; };
  return { req, res, next, get error() { return error; } };
}

/** One shared instance per test file: `jest.mock('../utils/prisma', () => ({ prisma: require('./helpers/fakePrisma').fakePrisma }))`. */
export const fakePrisma = createFakePrisma();
