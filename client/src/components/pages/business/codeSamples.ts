/* Code shown on /business. Everything here mirrors the real server code:
   - POST /api/v1/payouts      server/src/routes/publicApi.ts + controllers/publicApi.controller.ts
     (Bearer tzk_… or X-Api-Key, Idempotency-Key ≥ 8 chars, `recipients[]` up to 500,
     each { handle | email, amount, note }, batch `currency` + `note`)
   - response shape            { data: { batchId, reference, status, payouts[] }, replayed }
     (ids: cuid batch, `bpo_` + 24 hex payout, refs `BPB-` + 12 hex / `BPO-` + 10 hex)
   - webhook signature         services/business/webhooks.service.ts
     Tazdan-Signature: t=<unix>,v1=<hex HMAC-SHA256(secret, `${t}.${rawBody}`)>, 5-minute tolerance.
   Code is never translated. The key is masked on purpose (CI scans for credentials). */

export const PAYOUT_REQUEST = `curl -X POST "$TAZDAN_API_BASE/api/v1/payouts" \\
  -H "Authorization: Bearer tzk_test_••••••••••••Qd8w" \\
  -H "Idempotency-Key: payroll-2026-10" \\
  -H "Content-Type: application/json" \\
  -d '{
    "currency": "USD",
    "note": "October payroll",
    "recipients": [
      { "handle": "salma_b", "amount": "850.00", "note": "Salary" },
      { "handle": "omar_k", "amount": "620.00", "note": "Salary" },
      { "email": "accounts@example.com", "amount": "1240.00", "note": "Supplier" }
    ]
  }'`;

export const PAYOUT_RESPONSE = `HTTP/1.1 201 Created

{
  "data": {
    "batchId": "cm2k8x0f40001qz7h3n5v9r2d",
    "reference": "BPB-3F9A1C7E02D4",
    "status": "EXECUTED",
    "payouts": [
      {
        "id": "bpo_6c1f0e9a2b7d4c3e8f5a1b0c",
        "reference": "BPO-A41F0C93D2",
        "recipientHandle": "salma_b",
        "amount": "850",
        "currency": "USD",
        "status": "COMPLETED"
      },
      …
    ]
  },
  "replayed": false
}`;

export const WEBHOOK_VERIFY = `import crypto from "node:crypto";

// Tazdan-Signature: t=1760090400,v1=5d0c…a91f
export function verifyTazdan(rawBody, header, secret) {
  const { t, v1 } = Object.fromEntries(
    header.split(",").map((part) => part.trim().split("="))
  );
  const age = Math.abs(Date.now() / 1000 - Number(t));
  if (!(age <= 300)) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(\`\${t}.\${rawBody}\`)
    .digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1 ?? "", "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}`;

/** Webhook events, from WEBHOOK_EVENTS in webhooks.service.ts. */
export const WEBHOOK_EVENTS = [
  "payout.completed",
  "payout.failed",
  "payout.cancelled",
  "batch.pending_approval",
  "batch.compliance_review",
  "batch.completed",
  "batch.rejected",
] as const;
