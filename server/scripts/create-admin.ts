#!/usr/bin/env ts-node
/**
 * Create a staff (ADMIN) account.
 *
 *   ADMIN_EMAIL=ops@example.com ADMIN_PASSWORD='<12+ chars>' \
 *   STAFF_ROLES=OPERATIONS,FINANCE npx ts-node scripts/create-admin.ts
 *
 * There are no default credentials. Without ADMIN_PASSWORD a random password
 * is generated and printed once. Refuses to run with NODE_ENV=production
 * unless ALLOW_PRODUCTION_ADMIN_CREATE=1 (then the password must be given).
 * The account still needs 2FA enabled before it can use the cockpit in
 * production.
 */

/// <reference types="node" />
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import type { StaffRole } from '@prisma/client';
import { prisma } from '../src/utils/prisma';
import { generateReferralCode } from '../src/utils/helpers';

const VALID_ROLES = ['SUPER_ADMIN', 'EXECUTIVE', 'OPERATIONS', 'FINANCE', 'TREASURY', 'COMPLIANCE', 'AML_ANALYST', 'FRAUD_ANALYST', 'SUPPORT', 'SECURITY', 'TECH_OPS', 'AUDITOR'];

async function createAdmin() {
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && process.env.ALLOW_PRODUCTION_ADMIN_CREATE !== '1') {
    console.error('✗ Refusing to create a staff account in production without ALLOW_PRODUCTION_ADMIN_CREATE=1');
    process.exit(1);
  }
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) {
    console.error('✗ Set ADMIN_EMAIL');
    process.exit(1);
  }
  let password = process.env.ADMIN_PASSWORD ?? '';
  if (!password) {
    if (isProd) { console.error('✗ ADMIN_PASSWORD is required in production'); process.exit(1); }
    password = randomBytes(12).toString('base64url');
  }
  if (password.length < 12) {
    console.error('✗ ADMIN_PASSWORD must be at least 12 characters');
    process.exit(1);
  }
  const roles = (process.env.STAFF_ROLES ?? 'SUPER_ADMIN').split(',').map((r) => r.trim().toUpperCase()).filter(Boolean);
  const bad = roles.filter((r) => !VALID_ROLES.includes(r));
  if (bad.length) { console.error(`✗ Unknown roles: ${bad.join(', ')}`); process.exit(1); }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`✓ ${email} already exists (role ${existing.role}); nothing changed`);
      return;
    }
    const admin = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 12),
        firstName: 'Staff',
        lastName: 'Member',
        role: 'ADMIN',
        staffRoles: roles as StaffRole[],
        status: 'ACTIVE',
        emailVerified: true,
        referralCode: generateReferralCode(),
      },
    });
    console.log('✓ Staff account created');
    console.log(`  Email: ${email}`);
    if (!process.env.ADMIN_PASSWORD) console.log(`  Password (shown once): ${password}`);
    console.log(`  Roles: ${roles.join(', ')}`);
    console.log(`  ID: ${admin.id}`);
  } catch (error) {
    console.error('✗ Failed to create staff account:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
