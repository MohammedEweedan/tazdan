/**
 * Local Fallback Provider
 * 
 * Static fallback provider with critical country bank data.
 * Used when external APIs are unavailable or for critical countries.
 * Data is sourced from internal JSON snapshots.
 * 
 * This provider ensures the application never completely fails to return banks,
 * even when all external APIs are down.
 */

import { BaseProvider } from './BaseProvider';
import type { Bank, BankDetails, ValidationResult, ProviderConfig, BankProvider } from '../types';

// Import static bank data
import banksData from '../../../data/banks.json';

export class LocalFallbackProvider extends BaseProvider implements BankProvider {
  readonly name = 'LocalFallback';
  readonly priority = 3;
  readonly enabled: boolean;

  constructor(config: ProviderConfig & { enabled?: boolean }) {
    super(config);
    this.enabled = config.enabled !== false; // Enabled by default
  }

  /**
   * Fetch banks for a given country from local static data
   */
  async getBanks(countryCode: string): Promise<Bank[]> {
    if (!this.enabled) {
      throw new Error('LocalFallback provider is disabled');
    }

    try {
      const countryBanks = banksData[countryCode as keyof typeof banksData];
      
      if (!countryBanks || !Array.isArray(countryBanks)) {
        return [];
      }

      // Transform string bank names to Bank objects
      return countryBanks.map((name: string) => ({
        name,
        metadata: {
          provider: 'local-fallback',
          source: 'static-json',
        },
      }));
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch banks from local data: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Validate bank details using local validation only
   * (No external API calls)
   */
  async validate(details: BankDetails): Promise<ValidationResult> {
    // Only run base validation (no external API calls)
    return super.validate(details);
  }

  /**
   * Health check for LocalFallback provider
   * Always returns true as long as the JSON file is accessible
   */
  async healthCheck(): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      // Check if we can access the banks data
      const testCountry = 'GB';
      const countryBanks = banksData[testCountry as keyof typeof banksData];
      return Array.isArray(countryBanks);
    } catch {
      return false;
    }
  }
}
