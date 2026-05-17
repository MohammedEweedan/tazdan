/**
 * Banking Provider Types
 * 
 * Defines the core interfaces and types for the banking metadata system.
 * Supports multiple providers with graceful fallbacks.
 */

/**
 * Bank entity with standardized fields
 */
export interface Bank {
  /** Bank name (e.g., "Barclays", "Chase") */
  name: string;
  /** SWIFT/BIC code if available */
  swift?: string;
  /** Bank identifier code (country-specific) */
  bic?: string;
  /** Bank code (country-specific: routing, sort code, etc) */
  bankCode?: string;
  /** Head office location */
  location?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Bank details for validation
 */
export interface BankDetails {
  /** Country code (ISO 3166-1 alpha-2) */
  countryCode: string;
  /** IBAN if provided */
  iban?: string;
  /** SWIFT/BIC code */
  swift?: string;
  /** Routing number (US) */
  routingNumber?: string;
  /** Sort code (UK) */
  sortCode?: string;
  /** IFSC code (India) */
  ifsc?: string;
  /** BSB code (Australia) */
  bsb?: string;
  /** CLABE code (Mexico) */
  clabe?: string;
  /** Transit number (Canada) */
  transitNumber?: string;
}

/**
 * Validation result for bank details
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors if any */
  errors: string[];
  /** Warnings (non-critical issues) */
  warnings: string[];
  /** Normalized/corrected values */
  normalized?: Partial<BankDetails>;
}

/**
 * Provider-specific configuration
 */
export interface ProviderConfig {
  /** API key if required */
  apiKey?: string;
  /** Base URL for API */
  baseUrl?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Rate limit requests per minute */
  rateLimit?: number;
  /** Additional provider-specific options */
  options?: Record<string, unknown>;
}

/**
 * Bank Provider Interface
 * 
 * All banking providers must implement this interface.
 * Enables provider abstraction and fallback chain.
 */
export interface BankProvider {
  /** Provider name for logging/debugging */
  readonly name: string;
  /** Provider priority (lower = higher priority) */
  readonly priority: number;
  /** Whether provider is enabled */
  readonly enabled: boolean;
  
  /**
   * Fetch banks for a given country
   * @param countryCode ISO 3166-1 alpha-2 country code
   * @returns Promise resolving to array of banks
   */
  getBanks(countryCode: string): Promise<Bank[]>;
  
  /**
   * Validate bank details
   * @param details Bank details to validate
   * @returns Promise resolving to validation result
   */
  validate(details: BankDetails): Promise<ValidationResult>;
  
  /**
   * Health check for the provider
   * @returns Promise resolving to true if provider is operational
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Cache entry for bank data
 */
export interface CacheEntry<T> {
  /** Cached data */
  data: T;
  /** Timestamp when cached */
  timestamp: number;
  /** Time to live in milliseconds */
  ttl: number;
}

/**
 * Bank fetch service configuration
 */
export interface BankFetchConfig {
  /** Cache TTL in milliseconds (default: 24 hours) */
  cacheTtl?: number;
  /** Whether to use IBAN.com provider */
  useIbanCom?: boolean;
  /** Whether to use OpenIban provider */
  useOpenIban?: boolean;
  /** Whether to use local fallback */
  useLocalFallback?: boolean;
  /** IBAN.com API key */
  ibanComApiKey?: string;
}
