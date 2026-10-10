-- Earlier builds seeded seven illustrative "Tazdan" deposit bank accounts on
-- every boot (textbook example IBANs and invented account numbers, including a
-- real US routing number with a made-up account). The mobile deposit flow
-- showed them to customers as where to wire money.
--
-- Deactivate exactly those seeded rows. A row is matched only when the bank,
-- holder and the full fabricated account identifier are all unchanged, so any
-- account an administrator entered or corrected is left alone. Nothing is
-- deleted, so the change is auditable and reversible.
UPDATE "PlatformBankAccount" SET "isActive" = false, "updatedAt" = NOW()
WHERE "isActive" = true AND (
     ("currency" = 'USD' AND "bankName" = 'JPMorgan Chase Bank'            AND "accountName" = 'tazdan Inc.'   AND "accountNumber" = '000123456789')
  OR ("currency" = 'EUR' AND "bankName" = 'Deutsche Bank AG'               AND "accountName" = 'tazdan GmbH'   AND "iban" = 'DE89370400440532013000')
  OR ("currency" = 'GBP' AND "bankName" = 'Barclays Bank plc'              AND "accountName" = 'tazdan Ltd'    AND "iban" = 'GB82WEST12345698765432')
  OR ("currency" = 'AED' AND "bankName" = 'Emirates NBD'                   AND "accountName" = 'tazdan DMCC'   AND "iban" = 'AE070331234567890123456')
  OR ("currency" = 'SAR' AND "bankName" = 'Saudi National Bank'            AND "accountName" = 'tazdan Arabia' AND "iban" = 'SA0380000000608010167519')
  OR ("currency" = 'EGP' AND "bankName" = 'National Bank of Egypt'         AND "accountName" = 'tazdan Egypt'  AND "iban" = 'EG380002000000000012345678901')
  OR ("currency" = 'LYD' AND "bankName" = 'Bank of Commerce & Development' AND "accountName" = 'tazdan Libya'  AND "accountNumber" = '001-123456-001')
);
