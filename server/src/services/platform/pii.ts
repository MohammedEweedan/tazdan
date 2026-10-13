/**
 * Customer contact-data masking for staff without `customers.pii`.
 *
 * The cockpit masked contact details on its customer screens, but every other
 * staff endpoint (legacy /api/admin lists, transaction detail, remittance
 * detail, cases, businesses, sessions…) returned raw emails, phone numbers and
 * account numbers to any role that could open it. This masks them at the
 * response layer for every staff route, so a new endpoint cannot forget.
 *
 * Names stay visible (operators need them); contact details, account numbers,
 * dates of birth and document links do not. The staff member's own record is
 * left as is.
 */
import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../../types';

const EMAIL_KEYS = new Set(['email', 'recipientEmail', 'senderEmail', 'createdByEmail', 'ownerEmail', 'invitedEmail']);
const PHONE_KEYS = new Set(['phone', 'recipientPhone', 'phoneNumber', 'mobileNumber']);
const TAIL_KEYS = new Set(['accountNumber', 'iban', 'routingNumber', 'sortCode', 'mobileWallet', 'taxId', 'nationalId', 'idNumber', 'passportNumber']);
const DROP_KEYS = new Set(['dateOfBirth', 'addressLine', 'documentUrl', 'proofImageUrl', 'lastLoginIp']);

export function maskEmailValue(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 0) return email.length <= 2 ? '***' : `${email.slice(0, 2)}***`;
  return `${email.slice(0, Math.min(2, at))}***@${email.slice(at + 1)}`;
}

export function maskPhoneValue(phone: string): string {
  if (phone.length <= 6) return '****';
  return `${phone.slice(0, 4)}****${phone.slice(-2)}`;
}

export function maskTailValue(value: string): string {
  return value.length <= 4 ? '••••' : `••••${value.slice(-4)}`;
}

const MAX_DEPTH = 24;

function walk(node: any, selfId: string | undefined, depth: number): void {
  if (depth > MAX_DEPTH || node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item, selfId, depth + 1);
    return;
  }
  const own = selfId !== undefined && node.id === selfId;
  for (const key of Object.keys(node)) {
    const v = node[key];
    if (typeof v === 'string' && !own) {
      if (EMAIL_KEYS.has(key)) node[key] = maskEmailValue(v);
      else if (PHONE_KEYS.has(key)) node[key] = maskPhoneValue(v);
      else if (TAIL_KEYS.has(key)) node[key] = maskTailValue(v);
      else if (DROP_KEYS.has(key)) node[key] = null;
    } else if (v !== null && typeof v === 'object') {
      if (DROP_KEYS.has(key) && !own) { node[key] = null; continue; }
      walk(v, selfId, depth + 1);
    }
  }
}

/**
 * Deep-mask contact data in a JSON-serialisable value. Works on a JSON copy,
 * so cached or shared objects are never modified and Decimal/Date values are
 * serialised exactly as `res.json` would.
 */
export function maskPii<T>(body: T, selfId?: string): T {
  if (body === null || typeof body !== 'object') return body;
  const copy = JSON.parse(JSON.stringify(body));
  walk(copy, selfId, 0);
  return copy;
}

export function canSeePii(req: AuthRequest): boolean {
  return Boolean(req.staff?.permissions.has('customers.pii'));
}

/**
 * Router-level middleware for staff routers. Mount after `requireAdmin`; it
 * decides at response time, after `requirePermission` has loaded the staff
 * context for the route.
 */
export function maskPiiForStaff(req: AuthRequest, res: Response, next: NextFunction): void {
  const json = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (req.staff && !req.staff.permissions.has('customers.pii') && !res.locals.companyDataOnly) {
      return json(maskPii(body, req.user?.id));
    }
    return json(body);
  }) as Response['json'];
  next();
}

/**
 * Marks a route whose response holds only the company's own data (for example
 * the platform's deposit bank accounts that treasury manages), so account
 * numbers in it are not masked.
 */
export function companyDataOnly(_req: AuthRequest, res: Response, next: NextFunction): void {
  res.locals.companyDataOnly = true;
  next();
}
