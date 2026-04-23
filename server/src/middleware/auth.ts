import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../types';
import { prisma } from '../utils/prisma';
import { AppError } from './errorHandler';

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return next(new AppError('Authentication required', 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as {
      id: string;
      email: string;
      role: string;
    };
    req.user = decoded;
    next();
  } catch {
    return next(new AppError('Invalid or expired token', 401));
  }
}

export function requireAdmin(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return next(new AppError('Admin access required', 403));
  }
  next();
}

export function requireAgent(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!req.user || (req.user.role !== 'AGENT' && req.user.role !== 'ADMIN')) {
    return next(new AppError('Agent access required', 403));
  }
  next();
}

export function requireKYC(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }

  prisma.user
    .findUnique({ where: { id: req.user.id }, select: { kycStatus: true } })
    .then((user) => {
      if (!user || user.kycStatus !== 'APPROVED') {
        return next(new AppError('KYC verification required', 403));
      }
      next();
    })
    .catch(() => next(new AppError('Internal error', 500)));
}

export function generateTokens(user: { id: string; email: string; role: string }) {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '24h' }
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET || 'refresh-secret',
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
}
