/**
 * IBAN.com Bank Suite Provider
 * 
 * Primary provider for bank data with global coverage.
 * Supports 195 countries, ~60,000 institutions, ~950,000 branches.
 * 
 * Documentation: https://www.iban.com/bank-suite-api
 */

import { BaseProvider } from './BaseProvider';
import type { Bank, BankDetails, ValidationResult, ProviderConfig, BankProvider } from '../types';

export class IbanComProvider extends BaseProvider implements BankProvider {
  readonly name = 'IBAN.com';
  readonly priority = 1;
  readonly enabled: boolean;

  private apiKey: string;
  private baseUrl: string;

  constructor(config: ProviderConfig & { apiKey: string }) {
    super(config);
    this.apiKey = config.apiKey || '';
    this.baseUrl = config.baseUrl || 'https://openiban.com';
    this.enabled = !!this.apiKey;
  }

  /**
   * Fetch banks for a given country from IBAN.com
   */
  async getBanks(countryCode: string): Promise<Bank[]> {
    if (!this.enabled) {
      throw new Error('IBAN.com provider is not enabled. Missing API key.');
    }

    try {
      const url = `${this.baseUrl}/v1/banks/${countryCode}`;
      const response = await this.fetchWithTimeout(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`IBAN.com API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Transform IBAN.com response to our Bank format
      return this.transformResponse(data, countryCode);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch banks from IBAN.com: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Validate bank details using IBAN.com API
   */
  async validate(details: BankDetails): Promise<ValidationResult> {
    // First run base validation
    const baseResult = await super.validate(details);
    
    if (!baseResult.valid) {
      return baseResult;
    }

    // If IBAN is provided, use IBAN.com for additional validation
    if (details.iban) {
      try {
        const url = `${this.baseUrl}/v1/validate/${details.iban}`;
        const response = await this.fetchWithTimeout(url, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json',
          },
        });

        if (response.ok) {
          const data: any = await response.json();
          
          // Check if IBAN is valid according to IBAN.com
          if (!data.valid) {
            baseResult.valid = false;
            baseResult.errors.push('IBAN validation failed at IBAN.com');
          }

          // Add any additional warnings from the API
          if (data.warnings && Array.isArray(data.warnings)) {
            baseResult.warnings.push(...data.warnings);
          }
        }
      } catch (error) {
        // Don't fail validation if API is down, just add a warning
        baseResult.warnings.push('Could not validate IBAN with IBAN.com API');
      }
    }

    return baseResult;
  }

  /**
   * Health check for IBAN.com provider
   */
  async healthCheck(): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/v1/status`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Transform IBAN.com response to our Bank format
   */
  private transformResponse(data: any, countryCode: string): Bank[] {
    if (!data || !Array.isArray(data.banks)) {
      return [];
    }

    return data.banks.map((bank: any) => ({
      name: bank.name || bank.bank_name || '',
      swift: bank.swift || bank.bic || bank.swift_code || '',
      bic: bank.bic || bank.swift_code || '',
      bankCode: bank.bank_code || bank.routing_code || bank.sort_code || '',
      location: bank.city || bank.location || '',
      metadata: {
        provider: 'iban.com',
        branch: bank.branch || '',
        address: bank.address || '',
        postcode: bank.postcode || '',
      },
    })).filter((bank: Bank) => bank.name.length > 0);
  }
}
