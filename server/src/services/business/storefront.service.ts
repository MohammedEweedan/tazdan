/**
 * Business storefront: kiosk manager PIN, public posts (offers, deals, news)
 * and till plaque orders.
 *
 * Kiosk PIN — set by an owner/admin, hashed; any till operator can check it
 * to leave kiosk mode. Five wrong tries lock it for 15 minutes.
 * Posts — shown on the business's public profile to signed-in customers,
 * only while the business is a KYB-approved business account. Staff can
 * take a post down.
 * Plaques — the business orders printed till plaques; staff produce and
 * ship them. No charge is taken here: price and delivery are confirmed by
 * the tazdan team.
 */
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type { BusinessPostKind, PlaqueOrderStatus } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { writeAudit } from '../platform/audit';
import { assertCan, assertKybApproved, type BusinessContext } from './access';

// ── Kiosk PIN ───────────────────────────────────────────────────────

const PIN_RE = /^\d{6}$/;
const PIN_MAX_FAILURES = 5;
const PIN_LOCK_MS = 15 * 60_000;

function weakPin(pin: string): boolean {
  if (/^(\d)\1{5}$/.test(pin)) return true; // 000000, 111111…
  const up = '0123456789012345';
  const down = '9876543210987654';
  return up.includes(pin) || down.includes(pin);
}

export async function kioskPinStatus(ctx: BusinessContext) {
  assertCan(ctx, 'tills.view');
  const b = await prisma.businessProfile.findUniqueOrThrow({ where: { id: ctx.business.id }, select: { kioskPinHash: true, kioskPinSetAt: true, kioskPinLockedUntil: true } });
  return { set: Boolean(b.kioskPinHash), setAt: b.kioskPinSetAt, lockedUntil: b.kioskPinLockedUntil && b.kioskPinLockedUntil > new Date() ? b.kioskPinLockedUntil : null };
}

export async function setKioskPin(ctx: BusinessContext, pin: string) {
  assertCan(ctx, 'tills.manage');
  if (!PIN_RE.test(pin)) throw new AppError('The kiosk PIN is 6 digits', 400);
  if (weakPin(pin)) throw new AppError('Choose a PIN that is not a repeated or running sequence', 400);
  const hash = await bcrypt.hash(pin, 10);
  await prisma.$transaction(async (tx) => {
    await tx.businessProfile.update({ where: { id: ctx.business.id }, data: { kioskPinHash: hash, kioskPinSetAt: new Date(), kioskPinFailures: 0, kioskPinLockedUntil: null } });
    await writeAudit(tx, { actorId: ctx.userId, action: 'BUSINESS_KIOSK_PIN_SET', entity: 'BusinessProfile', entityId: ctx.business.id });
  });
  return { set: true };
}

export async function verifyKioskPin(ctx: BusinessContext, pin: string): Promise<{ ok: true }> {
  assertCan(ctx, 'tills.view');
  const b = await prisma.businessProfile.findUniqueOrThrow({ where: { id: ctx.business.id }, select: { kioskPinHash: true, kioskPinLockedUntil: true } });
  if (!b.kioskPinHash) throw new AppError('No kiosk PIN is set. A manager sets one under Tills.', 409);
  if (b.kioskPinLockedUntil && b.kioskPinLockedUntil > new Date()) {
    const mins = Math.ceil((b.kioskPinLockedUntil.getTime() - Date.now()) / 60_000);
    throw new AppError(`Too many wrong PINs. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`, 423);
  }
  if (PIN_RE.test(pin) && await bcrypt.compare(pin, b.kioskPinHash)) {
    await prisma.businessProfile.update({ where: { id: ctx.business.id }, data: { kioskPinFailures: 0, kioskPinLockedUntil: null } });
    return { ok: true };
  }
  // Count the failure atomically; the fifth locks the PIN for 15 minutes.
  const updated = await prisma.businessProfile.update({ where: { id: ctx.business.id }, data: { kioskPinFailures: { increment: 1 } }, select: { kioskPinFailures: true } });
  if (updated.kioskPinFailures >= PIN_MAX_FAILURES) {
    await prisma.businessProfile.update({ where: { id: ctx.business.id }, data: { kioskPinFailures: 0, kioskPinLockedUntil: new Date(Date.now() + PIN_LOCK_MS) } });
    await writeAudit(prisma, { actorId: ctx.userId, action: 'BUSINESS_KIOSK_PIN_LOCKED', entity: 'BusinessProfile', entityId: ctx.business.id });
    throw new AppError('Too many wrong PINs. Kiosk exit is locked for 15 minutes.', 423);
  }
  throw new AppError(`Wrong PIN. ${PIN_MAX_FAILURES - updated.kioskPinFailures} tries left.`, 403);
}

// ── Posts ───────────────────────────────────────────────────────────

const MAX_LIVE_POSTS = 30;
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '').trim();

export interface PostInput { kind: BusinessPostKind; title: string; body: string; startsAt?: Date | null; endsAt?: Date | null; published?: boolean }

function checkDates(startsAt?: Date | null, endsAt?: Date | null) {
  if (startsAt && endsAt && endsAt <= startsAt) throw new AppError('The end date must be after the start date', 400);
}

export async function listPosts(ctx: BusinessContext) {
  return prisma.businessPost.findMany({ where: { businessId: ctx.business.id }, orderBy: { createdAt: 'desc' }, take: 100 });
}

export async function createPost(ctx: BusinessContext, input: PostInput) {
  assertCan(ctx, 'profile.edit');
  assertKybApproved(ctx.business, 'you can post offers');
  checkDates(input.startsAt, input.endsAt);
  const live = await prisma.businessPost.count({ where: { businessId: ctx.business.id, published: true, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] } });
  if (live >= MAX_LIVE_POSTS) throw new AppError(`Up to ${MAX_LIVE_POSTS} live posts at a time — end or unpublish one first`, 400);
  return prisma.$transaction(async (tx) => {
    const post = await tx.businessPost.create({
      data: { businessId: ctx.business.id, kind: input.kind, title: clean(input.title), body: clean(input.body), startsAt: input.startsAt ?? null, endsAt: input.endsAt ?? null, published: input.published ?? true, createdById: ctx.userId },
    });
    await writeAudit(tx, { actorId: ctx.userId, action: 'BUSINESS_POST_CREATED', entity: 'BusinessPost', entityId: post.id, after: { kind: post.kind, title: post.title } });
    return post;
  });
}

export async function updatePost(ctx: BusinessContext, id: string, input: Partial<PostInput>) {
  assertCan(ctx, 'profile.edit');
  const before = await prisma.businessPost.findFirst({ where: { id, businessId: ctx.business.id } });
  if (!before) throw new AppError('Post not found', 404);
  checkDates(input.startsAt === undefined ? before.startsAt : input.startsAt, input.endsAt === undefined ? before.endsAt : input.endsAt);
  return prisma.businessPost.update({
    where: { id },
    data: {
      ...(input.kind ? { kind: input.kind } : {}),
      ...(input.title !== undefined ? { title: clean(input.title) } : {}),
      ...(input.body !== undefined ? { body: clean(input.body) } : {}),
      ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
      ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
      ...(input.published !== undefined ? { published: input.published } : {}),
    },
  });
}

export async function deletePost(ctx: BusinessContext, id: string) {
  assertCan(ctx, 'profile.edit');
  const deleted = await prisma.businessPost.deleteMany({ where: { id, businessId: ctx.business.id } });
  if (!deleted.count) throw new AppError('Post not found', 404);
  await writeAudit(prisma, { actorId: ctx.userId, action: 'BUSINESS_POST_DELETED', entity: 'BusinessPost', entityId: id });
}

/** Live posts of a payee, for customers. Only a KYB-approved business account has any. */
export async function publicPosts(ref: string) {
  const handle = ref.trim().replace(/^@/, '');
  const user = await prisma.user.findFirst({
    where: { status: 'ACTIVE', accountType: 'BUSINESS', OR: [{ id: handle }, { username: { equals: handle, mode: 'insensitive' } }] },
    select: { businessProfile: { select: { id: true, kybStatus: true } } },
  });
  if (!user?.businessProfile || user.businessProfile.kybStatus !== 'APPROVED') return { posts: [] };
  const now = new Date();
  const posts = await prisma.businessPost.findMany({
    where: {
      businessId: user.businessProfile.id, published: true, hiddenByStaff: false,
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, kind: true, title: true, body: true, startsAt: true, endsAt: true, createdAt: true },
  });
  return { posts };
}

/** Staff take-down / restore of a post. */
export async function moderatePost(actorId: string, id: string, hidden: boolean, reason: string, req?: { ip?: string; headers?: Record<string, any> }) {
  const before = await prisma.businessPost.findUnique({ where: { id } });
  if (!before) throw new AppError('Post not found', 404);
  return prisma.$transaction(async (tx) => {
    const post = await tx.businessPost.update({ where: { id }, data: { hiddenByStaff: hidden } });
    await writeAudit(tx, { actorId, action: hidden ? 'BUSINESS_POST_HIDDEN' : 'BUSINESS_POST_RESTORED', entity: 'BusinessPost', entityId: id, before: { hiddenByStaff: before.hiddenByStaff }, after: { hiddenByStaff: hidden }, reason, req });
    return post;
  });
}

// ── Plaques ─────────────────────────────────────────────────────────

export const PLAQUE_SIZES = ['A6', 'A5', 'STAND'] as const;
export const PLAQUE_LOCALES = ['en', 'ar', 'fr', 'es', 'de', 'nl', 'ru', 'tr', 'zh'] as const;

export interface PlaqueInput {
  tillId?: string | null; quantity: number; size: (typeof PLAQUE_SIZES)[number]; locale: (typeof PLAQUE_LOCALES)[number];
  shippingName: string; shippingPhone: string; shippingAddress: string; shippingCity: string; notes?: string | null;
}

export async function orderPlaques(ctx: BusinessContext, input: PlaqueInput) {
  assertCan(ctx, 'tills.manage');
  assertKybApproved(ctx.business, 'you can order plaques');
  if (input.tillId) {
    const till = await prisma.businessTill.findFirst({ where: { id: input.tillId, businessId: ctx.business.id } });
    if (!till) throw new AppError('Till not found', 404);
  }
  const open = await prisma.plaqueOrder.count({ where: { businessId: ctx.business.id, status: { in: ['REQUESTED', 'IN_PRODUCTION'] } } });
  if (open >= 10) throw new AppError('You have 10 plaque orders in progress — wait for some to ship first', 400);
  return prisma.$transaction(async (tx) => {
    const order = await tx.plaqueOrder.create({
      data: {
        businessId: ctx.business.id, tillId: input.tillId ?? null, quantity: input.quantity, size: input.size, locale: input.locale,
        shippingName: clean(input.shippingName), shippingPhone: clean(input.shippingPhone), shippingAddress: clean(input.shippingAddress),
        shippingCity: clean(input.shippingCity), notes: input.notes ? clean(input.notes) : null, createdById: ctx.userId,
      },
    });
    await writeAudit(tx, { actorId: ctx.userId, action: 'PLAQUE_ORDERED', entity: 'PlaqueOrder', entityId: order.id, after: { quantity: order.quantity, size: order.size, locale: order.locale, tillId: order.tillId } });
    return order;
  });
}

export async function listPlaqueOrders(ctx: BusinessContext) {
  return prisma.plaqueOrder.findMany({ where: { businessId: ctx.business.id }, orderBy: { createdAt: 'desc' }, take: 50 });
}

export async function cancelPlaqueOrder(ctx: BusinessContext, id: string) {
  assertCan(ctx, 'tills.manage');
  const moved = await prisma.plaqueOrder.updateMany({ where: { id, businessId: ctx.business.id, status: 'REQUESTED' }, data: { status: 'CANCELLED', statusNote: 'Cancelled by the business' } });
  if (!moved.count) throw new AppError('Only an order that has not gone into production can be cancelled', 409);
}

/** Staff: move an order through production and delivery. */
export async function setPlaqueStatus(actorId: string, id: string, status: PlaqueOrderStatus, note: string, req?: { ip?: string; headers?: Record<string, any> }) {
  const before = await prisma.plaqueOrder.findUnique({ where: { id } });
  if (!before) throw new AppError('Order not found', 404);
  return prisma.$transaction(async (tx) => {
    const order = await tx.plaqueOrder.update({ where: { id }, data: { status, statusNote: note } });
    await writeAudit(tx, { actorId, action: 'PLAQUE_STATUS_SET', entity: 'PlaqueOrder', entityId: id, before: { status: before.status }, after: { status }, reason: note, req });
    return order;
  });
}

// ── Logo ────────────────────────────────────────────────────────────

const MEDIA_DIR = () => path.resolve(process.env.MEDIA_UPLOAD_DIR || './uploads/media');
const MAX_LOGO_BYTES = 700 * 1024;

/**
 * Store a business logo (PNG or JPEG, checked by its bytes) as a public
 * media file with an unguessable name, and point the profile at it.
 */
export async function uploadLogo(ctx: BusinessContext, base64: string, origin: string) {
  assertCan(ctx, 'profile.edit');
  const buf = Buffer.from(base64, 'base64');
  if (!buf.length || buf.length > MAX_LOGO_BYTES) throw new AppError('The logo must be an image under 700 KB', 400);
  const png = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (!png && !jpeg) throw new AppError('The logo must be a PNG or JPEG image', 400);
  const name = `${randomUUID()}.${png ? 'png' : 'jpg'}`;
  await fs.mkdir(MEDIA_DIR(), { recursive: true });
  await fs.writeFile(path.join(MEDIA_DIR(), name), buf);
  const logoUrl = `${origin.replace(/\/+$/, '')}/media/${name}`;
  await prisma.$transaction(async (tx) => {
    await tx.businessProfile.update({ where: { id: ctx.business.id }, data: { logoUrl } });
    await writeAudit(tx, { actorId: ctx.userId, action: 'BUSINESS_LOGO_UPLOADED', entity: 'BusinessProfile', entityId: ctx.business.id, before: { logoUrl: ctx.business.logoUrl }, after: { logoUrl } });
  });
  return { logoUrl };
}
