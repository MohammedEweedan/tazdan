// Simple in-process IP ban list.
// In production replace with Redis-backed store for cross-instance consistency.
import { Request, Response, NextFunction } from 'express';

const bannedIPs = new Set<string>();
const strikeMap = new Map<string, { count: number; firstStrike: number }>();

const STRIKE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_STRIKES = 5;

export function recordStrike(ip: string): void {
  const now = Date.now();
  const existing = strikeMap.get(ip);
  if (!existing || now - existing.firstStrike > STRIKE_WINDOW_MS) {
    strikeMap.set(ip, { count: 1, firstStrike: now });
  } else {
    existing.count += 1;
    if (existing.count >= MAX_STRIKES) {
      bannedIPs.add(ip);
    }
  }
}

export function banIP(ip: string): void {
  bannedIPs.add(ip);
}

export function unbanIP(ip: string): void {
  bannedIPs.delete(ip);
  strikeMap.delete(ip);
}

export function ipBanMiddleware(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip ?? req.socket.remoteAddress ?? '';
  if (bannedIPs.has(ip)) {
    res.status(403).json({ message: 'Access denied' });
    return;
  }
  next();
}
