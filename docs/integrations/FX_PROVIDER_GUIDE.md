# FX provider guide

Status: **live**. See [../FX.md](../FX.md).

Sources in priority order: treasury override (maker-checker, expiring) → Fulus (LYD parallel rate, primary; webhook plus polling) → public reference feeds (derived crosses) → static table (never executable). Crypto prices: Coinbase / CryptoCompare.

Adding a source (for example a bank or liquidity provider's executable rates): implement a rate fetcher returning `{ buyPrice, sellPrice, source, fetchedAt }`, slot it into `getRate` priority, add sanity bounds for its pairs, and store ticks for history. Remittance corridors pause quoting automatically when the base rate leaves the corridor's floor/ceiling, so new sources cannot silently move customer prices outside treasury limits.
