#!/usr/bin/env ts-node
/**
 * Create default admin user for simulator
 * Usage: npx ts-node scripts/create-admin.ts
 */

/// <reference types="node" />
import { prisma } from '../src/utils/prisma';
import bcrypt from 'bcryptjs';
import { generateReferralCode } from '../src/utils/helpers';

async function createAdmin() {
  try {
    const existing = await prisma.user.findUnique({
      where: { email: 'admin@promrkts.com' }
    });
    
    if (existing) {
      console.log('✓ Admin user already exists');
      process.exit(0);
    }
    
    const passwordHash = await bcrypt.hash('admin123', 12);
    const referralCode = generateReferralCode();
    
    const admin = await prisma.user.create({
      data: {
        email: 'admin@promrkts.com',
        passwordHash,
        firstName: 'System',
        lastName: 'Administrator',
        role: 'ADMIN',
        status: 'ACTIVE',
        referralCode,
      },
    });
    
    console.log('✓ Admin user created:');
    console.log(`  Email: admin@promrkts.com`);
    console.log(`  Password: admin123`);
    console.log(`  ID: ${admin.id}`);
    
  } catch (error) {
    console.error('✗ Failed to create admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
