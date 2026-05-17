/**
 * OpenIban Provider
 * 
 * Free fallback provider for IBAN validation and limited bank data.
 * Provides IBAN validation and some BIC support.
 * Limited coverage but free to use.
 * 
 * Documentation: https://openiban.com/
 */

import { BaseProvider } from './BaseProvider';
import type { Bank, BankDetails, ValidationResult, ProviderConfig, BankProvider } from '../types';

export class OpenIbanProvider extends BaseProvider implements BankProvider {
  readonly name = 'OpenIban';
  readonly priority = 2;
  readonly enabled: boolean;

  private baseUrl: string;

  constructor(config: ProviderConfig & { enabled?: boolean }) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://openiban.com';
    this.enabled = config.enabled !== false; // Enabled by default
  }

  /**
   * Fetch banks for a given country from OpenIban
   * Note: OpenIban has limited bank data, mainly provides IBAN validation
   */
  async getBanks(countryCode: string): Promise<Bank[]> {
    if (!this.enabled) {
      throw new Error('OpenIban provider is disabled');
    }

    try {
      const url = `${this.baseUrl}/v1/validate/${countryCode}`;
      const response = await this.fetchWithTimeout(url, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`OpenIban API error: ${response.status} ${response.statusText}`);
      }

      const data: any = await response.json();
      
      // OpenIban doesn't provide comprehensive bank lists
      // Return empty array to trigger fallback to local provider
      return this.transformResponse(data, countryCode);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch banks from OpenIban: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Validate bank details using OpenIban API
   */
  async validate(details: BankDetails): Promise<ValidationResult> {
    // First run base validation
    const baseResult = await super.validate(details);
    
    if (!baseResult.valid) {
      return baseResult;
    }

    // If IBAN is provided, use OpenIban for additional validation
    if (details.iban) {
      try {
        const url = `${this.baseUrl}/v1/validate/${details.iban}`;
        const response = await this.fetchWithTimeout(url, {
          headers: {
            'Accept': 'application/json',
          },
        });

        if (response.ok) {
          const data: any = await response.json();
          
          // Check if IBAN is valid according to OpenIban
          if (!data.valid) {
            baseResult.valid = false;
            baseResult.errors.push('IBAN validation failed at OpenIban');
          }

          // Extract bank data if available
          if (data.bank_data) {
            baseResult.warnings.push(`Bank data available: ${JSON.stringify(data.bank_data)}`);
          }
        }
      } catch (error) {
        // Don't fail validation if API is down, just add a warning
        baseResult.warnings.push('Could not validate IBAN with OpenIban API');
      }
    }

    return baseResult;
  }

  /**
   * Health check for OpenIban provider
   */
  async healthCheck(): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      // Test with a known valid IBAN (Germany)
      const response = await this.fetchWithTimeout(`${this.baseUrl}/v1/validate/DE89370400440532013000`, {
        headers: {
          'Accept': 'application/json',
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Transform OpenIban response to our Bank format
   * OpenIban doesn't provide bank lists, so this returns empty array
   */
  private transformResponse(data: any, countryCode: string): Bank[] {
    // OpenIban doesn't provide bank lists, only IBAN validation
    // Return empty to trigger fallback to local provider
    return [];
  }
}
