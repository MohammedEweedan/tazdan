/**
 * Bank Fetch Service
 * 
 * Core service for fetching bank data with provider fallback chain and caching.
 * Orchestrates multiple providers with graceful degradation.
 * Implements caching with TTL for performance.
 */

import { IbanComProvider } from './providers/IbanComProvider';
import { OpenIbanProvider } from './providers/OpenIbanProvider';
import { LocalFallbackProvider } from './providers/LocalFallbackProvider';
import type { Bank, BankDetails, ValidationResult, BankProvider, BankFetchConfig, CacheEntry } from './types';

export class BankFetchService {
  private providers: BankProvider[] = [];
  private cache: Record<string, CacheEntry<Bank[]>> = {};
  private validationCache: Record<string, CacheEntry<ValidationResult>> = {};
  private cacheTtl: number;
  private config: BankFetchConfig;

  constructor(config: BankFetchConfig = {}) {
    this.config = {
      cacheTtl: 24 * 60 * 60 * 1000, // 24 hours default
      useIbanCom: true,
      useOpenIban: true,
      useLocalFallback: true,
      ...config,
    };
    this.cacheTtl = this.config.cacheTtl || 24 * 60 * 60 * 1000;

    this.initializeProviders();
  }

  /**
   * Initialize providers in priority order
   */
  private initializeProviders(): void {
    this.providers = [];

    // Add IBAN.com provider (primary)
    if (this.config.useIbanCom && this.config.ibanComApiKey) {
      this.providers.push(new IbanComProvider({
        apiKey: this.config.ibanComApiKey,
        timeout: 10000,
      }));
    }

    // Add OpenIban provider (fallback)
    if (this.config.useOpenIban) {
      this.providers.push(new OpenIbanProvider({
        enabled: true,
        timeout: 10000,
      }));
    }

    // Add LocalFallback provider (last resort)
    if (this.config.useLocalFallback) {
      this.providers.push(new LocalFallbackProvider({
        enabled: true,
        timeout: 5000,
      }));
    }

    // Sort by priority
    this.providers.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Fetch banks for a given country with provider fallback chain
   */
  async getBanks(countryCode: string): Promise<Bank[]> {
    const normalizedCountryCode = countryCode.toUpperCase();

    // Check cache first
    const cached = this.getFromCache<Bank[]>(this.cache, normalizedCountryCode);
    if (cached) {
      return cached;
    }

    // Try each provider in priority order
    let lastError: Error | null = null;
    
    for (const provider of this.providers) {
      if (!provider.enabled) continue;

      try {
        const banks = await provider.getBanks(normalizedCountryCode);
        
        // Cache the successful result
        this.setCache(this.cache, normalizedCountryCode, banks);
        
        return banks;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`Provider ${provider.name} failed:`, lastError.message);
        continue;
      }
    }

    // All providers failed
    throw new Error(
      `All banking providers failed. Last error: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Validate bank details with provider fallback chain
   */
  async validate(details: BankDetails): Promise<ValidationResult> {
    const cacheKey = this.generateValidationCacheKey(details);

    // Check cache first
    const cached = this.getFromCache<ValidationResult>(this.validationCache, cacheKey);
    if (cached) {
      return cached;
    }

    // Try each provider in priority order
    let lastError: Error | null = null;
    
    for (const provider of this.providers) {
      if (!provider.enabled) continue;

      try {
        const result = await provider.validate(details);
        
        // Cache the successful result
        this.setCache(this.validationCache, cacheKey, result);
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`Provider ${provider.name} validation failed:`, lastError.message);
        continue;
      }
    }

    // All providers failed, return basic validation
    // Use the first provider's base validation (which doesn't require API)
    if (this.providers.length > 0) {
      try {
        const result = await this.providers[0].validate(details);
        this.setCache(this.validationCache, cacheKey, result);
        return result;
      } catch (error) {
        console.error('Base validation also failed:', error);
      }
    }

    // Return minimal validation result
    return {
      valid: false,
      errors: ['All validation providers failed'],
      warnings: [],
    };
  }

  /**
   * Health check for all providers
   */
  async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const provider of this.providers) {
      try {
        results[provider.name] = await provider.healthCheck();
      } catch {
        results[provider.name] = false;
      }
    }

    return results;
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache = {};
    this.validationCache = {};
  }

  /**
   * Clear cache for a specific country
   */
  clearCountryCache(countryCode: string): void {
    const normalizedCountryCode = countryCode.toUpperCase();
    delete this.cache[normalizedCountryCode];
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    bankCacheSize: number;
    validationCacheSize: number;
    providers: { name: string; enabled: boolean; priority: number }[];
  } {
    return {
      bankCacheSize: Object.keys(this.cache).length,
      validationCacheSize: Object.keys(this.validationCache).length,
      providers: this.providers.map(p => ({
        name: p.name,
        enabled: p.enabled,
        priority: p.priority,
      })),
    };
  }

  /**
   * Get value from cache if not expired
   */
  private getFromCache<T>(cache: Record<string, CacheEntry<T>>, key: string): T | null {
    const entry = cache[key];
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      delete cache[key];
      return null;
    }

    return entry.data;
  }

  /**
   * Set value in cache
   */
  private setCache<T>(cache: Record<string, CacheEntry<T>>, key: string, data: T): void {
    cache[key] = {
      data,
      timestamp: Date.now(),
      ttl: this.cacheTtl,
    };
  }

  /**
   * Generate cache key for validation results
   */
  private generateValidationCacheKey(details: BankDetails): string {
    const parts = [
      details.countryCode,
      details.iban || '',
      details.swift || '',
      details.routingNumber || '',
      details.sortCode || '',
      details.ifsc || '',
      details.bsb || '',
      details.clabe || '',
      details.transitNumber || '',
    ];
    return parts.join('|');
  }
}

// Singleton instance
let serviceInstance: BankFetchService | null = null;

/**
 * Get or create the singleton BankFetchService instance
 */
export function getBankFetchService(config?: BankFetchConfig): BankFetchService {
  if (!serviceInstance) {
    serviceInstance = new BankFetchService(config);
  }
  return serviceInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetBankFetchService(): void {
  serviceInstance = null;
}
