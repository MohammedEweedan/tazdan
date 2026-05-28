# Banking Metadata System

Production-grade global banking metadata system with provider abstraction and graceful fallbacks.

## Overview

This system provides a robust, scalable solution for fetching bank data worldwide using external APIs with automatic fallback to local static data. It implements a provider abstraction layer that enables easy addition of new banking data sources.

## Architecture

### Provider Abstraction

The system uses a provider pattern with three levels of fallback:

1. **IBAN.com Bank Suite** (Primary)
   - Global coverage: 195 countries
   - ~60,000 institutions
   - ~950,000 branches
   - Paid service with comprehensive data
   - Documentation: https://www.iban.com/bank-suite-api

2. **OpenIban** (Free Fallback)
   - Free service
   - IBAN validation + limited BIC support
   - Limited coverage
   - Documentation: https://openiban.com/

3. **Local Fallback** (Last Resort)
   - Static JSON snapshots for critical countries
   - Always available
   - Ensures system never fails completely

### Components

```
banking/
├── types.ts                    # TypeScript interfaces and types
├── BankFetchService.ts         # Core service with caching and fallback chain
├── index.ts                    # Module exports
├── providers/
│   ├── BaseProvider.ts         # Abstract base class with validation
│   ├── IbanComProvider.ts      # IBAN.com API integration
│   ├── OpenIbanProvider.ts     # OpenIban API integration
│   └── LocalFallbackProvider.ts # Local static data fallback
└── __tests__/
    └── BankFetchService.test.ts # Unit tests
```

## Configuration

### Environment Variables

Add the following to your `.env` file:

```env
# Primary provider: IBAN.com Bank Suite API
IBAN_COM_API_KEY=your_api_key_here
USE_IBAN_COM=true

# Free fallback provider: OpenIban
USE_OPENIBAN=true

# Local static fallback (always enabled as last resort)
ENABLE_LOCAL_BANK_CACHE=true

# Bank data cache TTL in milliseconds (default: 24 hours)
BANK_CACHE_TTL=86400000
```

### Getting an IBAN.com API Key

1. Visit https://www.iban.com/bank-suite-api
2. Sign up for an account
3. Generate an API key
4. Add it to your `.env` file as `IBAN_COM_API_KEY`

## Usage

### Basic Usage

```typescript
import { getBankFetchService } from '@/services/banking';

// Get the singleton service instance
const bankService = getBankFetchService({
  ibanComApiKey: process.env.IBAN_COM_API_KEY,
  useIbanCom: process.env.USE_IBAN_COM === 'true',
  useOpenIban: process.env.USE_OPENIBAN !== 'false',
  useLocalFallback: process.env.ENABLE_LOCAL_BANK_CACHE !== 'false',
});

// Fetch banks for a country
const banks = await bankService.getBanks('GB');
console.log(banks); // [{ name: 'Barclays', swift: 'BARCGB22', ... }, ...]
```

### Validation

```typescript
// Validate bank details
const validation = await bankService.validate({
  countryCode: 'GB',
  iban: 'GB82WEST12345698765432',
  swift: 'BARCGB22',
});

console.log(validation);
// {
//   valid: true,
//   errors: [],
//   warnings: [],
//   normalized: {
//     iban: 'GB82WEST12345698765432',
//     swift: 'BARCGB22',
//     countryCode: 'GB'
//   }
// }
```

### Health Checks

```typescript
// Check health of all providers
const health = await bankService.healthCheck();
console.log(health);
// {
//   'IBAN.com': true,
//   'OpenIban': true,
//   'LocalFallback': true
// }
```

### Cache Management

```typescript
// Get cache statistics
const stats = bankService.getCacheStats();
console.log(stats);
// {
//   bankCacheSize: 10,
//   validationCacheSize: 5,
//   providers: [...]
// }

// Clear all caches
bankService.clearCache();

// Clear cache for a specific country
bankService.clearCountryCache('GB');
```

## API Endpoint

The banking system is integrated into the existing API:

```
GET /api/bank-accounts/banks/:country
```

Response:
```json
{
  "banks": ["Barclays", "HSBC", "Lloyds", ...]
}
```

## Validation Algorithms

The system implements industry-standard validation algorithms:

### IBAN Validation
- Format check (ISO 13616)
- Modulo 97 checksum validation
- Country-specific length validation

### SWIFT/BIC Validation
- Format check (8 or 11 characters)
- Structure validation (4 letters + 2 letters + 2 alphanum + optional 3 alphanum)

### US Routing Number (ABA)
- 9-digit format check
- Checksum validation using standard algorithm

### UK Sort Code
- 6-digit format check
- Basic structure validation

### Indian IFSC
- Format check (4 letters + 0 + 6 alphanumeric)
- Bank code validation

### Australian BSB
- 6-digit format check
- Basic structure validation

### Mexican CLABE
- 18-digit format check
- Checksum validation using CLABE algorithm

## Caching

The system implements intelligent caching:

- **Bank Data Cache**: Caches bank lists by country code (default TTL: 24 hours)
- **Validation Cache**: Caches validation results to avoid redundant API calls
- **Automatic Expiration**: Cache entries automatically expire after TTL
- **Manual Clearing**: Methods available to clear specific or all caches

## Error Handling

The system implements graceful degradation:

1. If IBAN.com fails, it falls back to OpenIban
2. If OpenIban fails, it falls back to local static data
3. If all providers fail, it returns an empty array with appropriate error logging
4. Validation always works with base algorithms even if all APIs are down

## Testing

The banking module includes comprehensive unit tests in `__tests__/BankFetchService.test.ts`. However, the project does not currently have Jest configured. To run the tests:

### Setup Jest (if needed)

```bash
# Install Jest and types
npm install --save-dev jest @types/jest ts-jest

# Initialize Jest configuration
npx ts-jest config:init
```

### Running Tests

```bash
# Run banking service tests
npm test -- BankFetchService.test.ts
```

### Test Coverage

The test suite covers:
- Provider initialization and configuration
- Bank fetching with fallback chain
- Validation algorithms (IBAN, SWIFT, routing, etc.)
- Caching behavior
- Health checks
- Singleton pattern
- Error handling

## Extending the System

### Adding a New Provider

1. Create a new provider class extending `BaseProvider`:

```typescript
import { BaseProvider } from './BaseProvider';
import type { Bank, BankDetails, ValidationResult, BankProvider } from '../types';

export class CustomProvider extends BaseProvider implements BankProvider {
  readonly name = 'CustomProvider';
  readonly priority = 2; // Between IBAN.com and OpenIban
  readonly enabled: boolean;

  constructor(config: ProviderConfig & { enabled?: boolean }) {
    super(config);
    this.enabled = config.enabled !== false;
  }

  async getBanks(countryCode: string): Promise<Bank[]> {
    // Implement your custom logic
    const response = await fetch(`https://your-api.com/banks/${countryCode}`);
    const data = await response.json();
    return this.transformResponse(data);
  }

  async validate(details: BankDetails): Promise<ValidationResult> {
    // Implement custom validation or use base validation
    return super.validate(details);
  }

  async healthCheck(): Promise<boolean> {
    // Implement health check
    try {
      const response = await fetch('https://your-api.com/health');
      return response.ok;
    } catch {
      return false;
    }
  }

  private transformResponse(data: any): Bank[] {
    // Transform API response to Bank format
    return data.banks.map((bank: any) => ({
      name: bank.name,
      swift: bank.swift,
      // ... other fields
    }));
  }
}
```

2. Register the provider in `BankFetchService.ts`:

```typescript
import { CustomProvider } from './providers/CustomProvider';

private initializeProviders(): void {
  // ... existing providers

  if (this.config.useCustom) {
    this.providers.push(new CustomProvider({
      enabled: true,
      apiKey: this.config.customApiKey,
    }));
  }

  // Sort by priority
  this.providers.sort((a, b) => a.priority - b.priority);
}
```

3. Add environment configuration:

```env
USE_CUSTOM_PROVIDER=true
CUSTOM_API_KEY=your_key
```

## Performance Considerations

- **Caching**: Reduces API calls by caching results for 24 hours
- **Timeouts**: All providers have configurable timeouts (default: 10s)
- **Rate Limiting**: Configure rate limits per provider in provider config
- **Lazy Loading**: Providers are only initialized when needed
- **Concurrent Requests**: Providers are tried sequentially to avoid overwhelming APIs

## Security Considerations

- **API Keys**: Stored in environment variables, never committed to code
- **Input Validation**: All inputs are validated before processing
- **Error Messages**: Generic error messages to avoid information leakage
- **Rate Limiting**: Prevents abuse and protects against DoS attacks

## Troubleshooting

### No Banks Returned

1. Check if the country code is valid (ISO 3166-1 alpha-2)
2. Verify provider health with `bankService.healthCheck()`
3. Check logs for specific provider errors
4. Ensure local fallback data includes the country

### Validation Fails

1. Verify the input format matches expected patterns
2. Check the validation errors for specific issues
3. Use the `normalized` field to get corrected values
4. Test with known valid values from provider documentation

### Cache Issues

1. Clear cache with `bankService.clearCache()`
2. Adjust `BANK_CACHE_TTL` if needed
3. Check cache statistics with `bankService.getCacheStats()`

## Dependencies

- No external runtime dependencies for core functionality
- Jest and @types/jest for testing
- Node.js built-in `fetch` for HTTP requests

## License

Part of the Fortuni project.
