# Custody hardening: KMS envelope encryption + hot/cold split

The master BIP-39 seed derives **every user wallet**. Today it sits in the DB
encrypted by `MASTER_SEED_ENC_KEY` from the environment — so one box
compromise (env + DB read) = all user crypto. This runbook removes that
single point in ~an hour of work, then establishes the hot/cold policy.

## 1. Enable AWS KMS envelope encryption (do this week)

The code path already exists (`masterSeed.service.ts`, mode `kms`); it only
needs credentials and one re-encryption.

1. Create an AWS account dedicated to custody (no other workloads).
   Enable MFA on root, create an IAM user `tazdan-kms` with ONLY
   `kms:GenerateDataKey` + `kms:Decrypt` on the one key below.
2. Create a symmetric KMS key, alias `alias/tazdan-master-seed`.
   - Key policy: only `tazdan-kms` may use it; only root may administer.
   - Enable CloudTrail → every decrypt of the seed becomes an audit event
     (this is your canary: the server decrypts at boot + per withdrawal
     signing; anything else is an attacker).
3. On the droplet, add to `/srv/promrkts/.env`:
   ```
   MASTER_SEED_KMS_KEY_ID=arn:aws:kms:…:key/…
   AWS_ACCESS_KEY_ID=…       AWS_SECRET_ACCESS_KEY=…
   AWS_REGION=eu-central-1
   ```
4. Re-encrypt the stored seed under KMS (one-off, on the server host):
   the simplest safe path is: decrypt with the current local key, re-run
   `encrypt()` with KMS configured, update the `MasterSeedStore` row.
   Write a 10-line script using the service's own `encrypt`/`decrypt` —
   never print the mnemonic.
5. Verify a withdrawal signs correctly, then **delete
   `MASTER_SEED_ENC_KEY` from the env** and set
   `MASTER_SEED_REQUIRE_KMS=1` so a future misconfig fails closed
   (the boot gate in `utils/env.ts` enforces this).
6. Print the 24-word mnemonic ONCE (offline ceremony, two people), write
   it on steel/paper, seal in two envelopes, two locations. This is the
   disaster-recovery path if AWS or the DB is ever lost. Never photograph it.

**Result:** stealing the droplet AND the database no longer yields keys —
the attacker also needs working AWS credentials, whose every use is logged.

## 2. Hot/cold policy (before real volume)

- **Cold storage**: a hardware wallet (Ledger/Trezor, bought direct from
  manufacturer) per chain. Record its addresses in the droplet env as
  `COLD_STORAGE_ADDRESS_ETH/BTC/SOL` — the sweep CLI refuses any other
  destination.
- **Hot target**: keep ≤ 1 day of typical withdrawal volume per asset on
  server-derivable addresses (start: the platform daily caps —
  `onchain_platform_daily_cap_*` in PlatformSettings).
- **Sweep** weekly, or whenever a single address accumulates > 2× the hot
  target:
  ```bash
  npx ts-node --transpile-only scripts/treasury-sweep.ts \
    --asset ETH --index <walletIndex> --amount <n> [--dry-run]
  ```
  Two-person rule: one runs, one verifies the cold address + amount on the
  hardware wallet screen. The CLI requires a typed confirmation phrase and
  records an `OnChainTransaction` audit row.
- **Daily caps** (already enforced in `initiateWithdrawal`): per-user and
  platform-wide per asset/day, tunable from Admin → Settings. The platform
  cap bounds the worst-case daily loss even under full compromise.

## 3. Roadmap (post-launch)

- MPC custody (Fireblocks / Dfns / Turnkey) replaces raw seed handling
  entirely — evaluate once volume justifies the fee.
- TRON: TRC-20 withdrawals stay disabled until a TRX fee-delegation
  treasury exists (user addresses hold no TRX to pay energy). Plan:
  central TRX wallet + energy delegation per withdrawal, or migrate
  TRC-20 custody to a provider.
