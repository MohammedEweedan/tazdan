/**
 * Base Bank Provider
 * 
 * Abstract base class for bank providers.
 * Provides common functionality and enforces interface implementation.
 */

import type { Bank, BankDetails, ValidationResult, ProviderConfig } from '../types';

export abstract class BaseProvider {
  protected config: ProviderConfig;
  
  constructor(config: ProviderConfig = {}) {
    this.config = {
      timeout: 10000,
      rateLimit: 60,
      ...config,
    };
  }

  /**
   * Validate bank details
   * Default implementation provides basic validation
   * Subclasses can override for provider-specific validation
   */
  async validate(details: BankDetails): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const normalized: Partial<BankDetails> = {};

    // Validate country code
    if (!details.countryCode || !/^[A-Z]{2}$/.test(details.countryCode)) {
      errors.push('Invalid country code. Must be ISO 3166-1 alpha-2 format.');
    } else {
      normalized.countryCode = details.countryCode.toUpperCase();
    }

    // Validate IBAN if provided
    if (details.iban) {
      const ibanValidation = this.validateIban(details.iban);
      if (!ibanValidation.valid) {
        errors.push(...ibanValidation.errors);
      } else if (ibanValidation.normalized) {
        Object.assign(normalized, ibanValidation.normalized);
      }
    }

    // Validate SWIFT if provided
    if (details.swift) {
      const swiftValidation = this.validateSwift(details.swift);
      if (!swiftValidation.valid) {
        errors.push(...swiftValidation.errors);
      } else if (swiftValidation.normalized) {
        Object.assign(normalized, swiftValidation.normalized);
      }
    }

    // Validate routing number (US)
    if (details.routingNumber) {
      const routingValidation = this.validateRoutingNumber(details.routingNumber);
      if (!routingValidation.valid) {
        errors.push(...routingValidation.errors);
      } else if (routingValidation.normalized) {
        Object.assign(normalized, routingValidation.normalized);
      }
    }

    // Validate sort code (UK)
    if (details.sortCode) {
      const sortCodeValidation = this.validateSortCode(details.sortCode);
      if (!sortCodeValidation.valid) {
        errors.push(...sortCodeValidation.errors);
      } else if (sortCodeValidation.normalized) {
        Object.assign(normalized, sortCodeValidation.normalized);
      }
    }

    // Validate IFSC (India)
    if (details.ifsc) {
      const ifscValidation = this.validateIfsc(details.ifsc);
      if (!ifscValidation.valid) {
        errors.push(...ifscValidation.errors);
      } else if (ifscValidation.normalized) {
        Object.assign(normalized, ifscValidation.normalized);
      }
    }

    // Validate BSB (Australia)
    if (details.bsb) {
      const bsbValidation = this.validateBsb(details.bsb);
      if (!bsbValidation.valid) {
        errors.push(...bsbValidation.errors);
      } else if (bsbValidation.normalized) {
        Object.assign(normalized, bsbValidation.normalized);
      }
    }

    // Validate CLABE (Mexico)
    if (details.clabe) {
      const clabeValidation = this.validateClabe(details.clabe);
      if (!clabeValidation.valid) {
        errors.push(...clabeValidation.errors);
      } else if (clabeValidation.normalized) {
        Object.assign(normalized, clabeValidation.normalized);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      normalized: Object.keys(normalized).length > 0 ? normalized : undefined,
    };
  }

  /**
   * Validate IBAN format
   */
  protected validateIban(iban: string): ValidationResult {
    const errors: string[] = [];
    const normalized = iban.replace(/\s/g, '').toUpperCase();

    // Basic format check
    if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(normalized)) {
      errors.push('Invalid IBAN format. Must be 2 letters + 2 digits + 11-30 alphanumeric characters.');
      return { valid: false, errors, warnings: [] };
    }

    // Modulo 97 check (IBAN validation algorithm)
    const rearranged = normalized.substring(4) + normalized.substring(0, 4);
    const numeric = rearranged.split('').map(c => {
      const code = c.charCodeAt(0);
      return code >= 65 && code <= 90 ? (code - 55).toString() : c;
    }).join('');
    
    const mod97 = BigInt(numeric) % 97n;
    if (mod97 !== 1n) {
      errors.push('IBAN checksum validation failed.');
      return { valid: false, errors, warnings: [] };
    }

    return { valid: true, errors: [], warnings: [], normalized: { iban: normalized } };
  }

  /**
   * Validate SWIFT/BIC format
   */
  protected validateSwift(swift: string): ValidationResult {
    const errors: string[] = [];
    const normalized = swift.replace(/\s/g, '').toUpperCase();

    // SWIFT/BIC is 8 or 11 characters: 4 letters (bank) + 2 letters (country) + 2 alphanum (location) + optional 3 alphanum (branch)
    if (!/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(normalized)) {
      errors.push('Invalid SWIFT/BIC format. Must be 8 or 11 characters.');
      return { valid: false, errors, warnings: [] };
    }

    return { valid: true, errors: [], warnings: [], normalized: { swift: normalized } };
  }

  /**
   * Validate US routing number (ABA routing number)
   */
  protected validateRoutingNumber(routingNumber: string): ValidationResult {
    const errors: string[] = [];
    const normalized = routingNumber.replace(/\s/g, '');

    // Must be 9 digits
    if (!/^\d{9}$/.test(normalized)) {
      errors.push('Invalid routing number. Must be exactly 9 digits.');
      return { valid: false, errors, warnings: [] };
    }

    // Checksum validation (ABA routing number algorithm)
    const digits = normalized.split('').map(Number);
    const checksum = 
      3 * (digits[0] + digits[3] + digits[6]) +
      7 * (digits[1] + digits[4] + digits[7]) +
      (digits[2] + digits[5] + digits[8]);
    
    if (checksum % 10 !== 0) {
      errors.push('Routing number checksum validation failed.');
      return { valid: false, errors, warnings: [] };
    }

    return { valid: true, errors: [], warnings: [], normalized: { routingNumber: normalized } };
  }

  /**
   * Validate UK sort code
   */
  protected validateSortCode(sortCode: string): ValidationResult {
    const errors: string[] = [];
    const normalized = sortCode.replace(/\s/g, '').replace(/-/g, '');

    // Must be 6 digits
    if (!/^\d{6}$/.test(normalized)) {
      errors.push('Invalid sort code. Must be 6 digits.');
      return { valid: false, errors, warnings: [] };
    }

    return { valid: true, errors: [], warnings: [], normalized: { sortCode: normalized } };
  }

  /**
   * Validate Indian IFSC code
   */
  protected validateIfsc(ifsc: string): ValidationResult {
    const errors: string[] = [];
    const normalized = ifsc.replace(/\s/g, '').toUpperCase();

    // IFSC format: 4 letters (bank code) + 0 + 6 alphanumeric (branch code)
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(normalized)) {
      errors.push('Invalid IFSC format. Must be 4 letters + 0 + 6 alphanumeric characters.');
      return { valid: false, errors, warnings: [] };
    }

    return { valid: true, errors: [], warnings: [], normalized: { ifsc: normalized } };
  }

  /**
   * Validate Australian BSB code
   */
  protected validateBsb(bsb: string): ValidationResult {
    const errors: string[] = [];
    const normalized = bsb.replace(/\s/g, '').replace(/-/g, '');

    // Must be 6 digits
    if (!/^\d{6}$/.test(normalized)) {
      errors.push('Invalid BSB code. Must be 6 digits.');
      return { valid: false, errors, warnings: [] };
    }

    return { valid: true, errors: [], warnings: [], normalized: { bsb: normalized } };
  }

  /**
   * Validate Mexican CLABE code
   */
  protected validateClabe(clabe: string): ValidationResult {
    const errors: string[] = [];
    const normalized = clabe.replace(/\s/g, '');

    // Must be 18 digits
    if (!/^\d{18}$/.test(normalized)) {
      errors.push('Invalid CLABE code. Must be 18 digits.');
      return { valid: false, errors, warnings: [] };
    }

    // Checksum validation (CLABE algorithm)
    const digits = normalized.split('').map(Number);
    const weights = [3, 1, 7, 1, 3, 1, 7, 1, 3, 1, 7, 1, 3, 1, 7, 1, 3, 1];
    let sum = 0;
    for (let i = 0; i < 17; i++) {
      const product = digits[i] * weights[i];
      sum += Math.floor(product / 10) + (product % 10);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    
    if (checkDigit !== digits[17]) {
      errors.push('CLABE checksum validation failed.');
      return { valid: false, errors, warnings: [] };
    }

    return { valid: true, errors: [], warnings: [], normalized: { clabe: normalized } };
  }

  /**
   * Execute HTTP request with timeout and error handling
   */
  protected async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.config.timeout}ms`);
      }
      throw error;
    }
  }
}
