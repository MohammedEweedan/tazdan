#!/usr/bin/env ts-node
/**
 * Seed exchange rates for simulator
 * Usage: npx ts-node scripts/seed-rates.ts
 */

/// <reference types="node" />
import { prisma } from '../src/utils/prisma';

async function seedRates() {
  try {
    const rates = [
      { base: 'USDT', quote: 'USD', buy: 1.005, sell: 0.995 },
      { base: 'USDT', quote: 'LYD', buy: 5.15, sell: 5.05 },
      { base: 'USD', quote: 'LYD', buy: 5.12, sell: 5.02 },
    ];
    
    for (const rate of rates) {
      await prisma.exchangeRate.upsert({
        where: {
          baseCurrency_quoteCurrency: {
            baseCurrency: rate.base as any,
            quoteCurrency: rate.quote as any,
          }
        },
        update: {
          buyPrice: rate.buy,
          sellPrice: rate.sell,
          isActive: true,
        },
        create: {
          baseCurrency: rate.base as any,
          quoteCurrency: rate.quote as any,
          buyPrice: rate.buy,
          sellPrice: rate.sell,
          isActive: true,
          setBy: 'system',
        },
      });
      console.log(`✓ Rate ${rate.base}/${rate.quote}: Buy ${rate.buy}, Sell ${rate.sell}`);
    }
    
    console.log('✓ Exchange rates seeded successfully');
    
  } catch (error) {
    console.error('✗ Failed to seed rates:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedRates();
