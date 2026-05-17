/**
 * Banking Service Module
 * 
 * Production-grade global banking metadata system.
 * Supports multiple providers with graceful fallbacks.
 * 
 * Usage:
 * ```ts
 * import { getBankFetchService } from '@/services/banking';
 * 
 * const service = getBankFetchService({
 *   ibanComApiKey: process.env.IBAN_COM_API_KEY,
 *   useOpenIban: true,
 *   useLocalFallback: true,
 * });
 * 
 * const banks = await service.getBanks('GB');
 * const validation = await service.validate({ iban: 'GB82WEST12345698765432' });
 * ```
 */

export * from './types';
export * from './BankFetchService';
export * from './providers/BaseProvider';
export * from './providers/IbanComProvider';
export * from './providers/OpenIbanProvider';
export * from './providers/LocalFallbackProvider';
