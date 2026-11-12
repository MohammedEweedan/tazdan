# LYDT token contract (sandbox)

`contracts/LYDT.sol` — one token per Libyan dinar held at the Central Bank of
Libya. The CBL holds the admin, supervisor and attester roles; tazdan holds
the issuer role. The CBL can take over issuance by granting itself
`ISSUER_ROLE` and revoking tazdan's. Not deployed anywhere: it runs on
Hardhat's local chain until the CBL authorises a network.

```sh
npm install
npm test   # 12 tests: reserve limit, stale statements, verified holders,
           # freezes, pause without blocking redemption, holding cap, CBL takeover
```

The in-app sandbox (`server/src/services/lydt`) enforces the same rules on
tazdan's ledger.
