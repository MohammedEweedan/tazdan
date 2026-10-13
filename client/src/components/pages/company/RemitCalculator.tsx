"use client";

/* Send-abroad cost calculator.

   Numbers are the server's seeded corridor pricing — keep them in step with
   server/src/services/remittance/corridors.ts (DEFAULT_CORRIDORS) and
   docs/REMITTANCE.md. They are SANDBOX defaults ("not a commercial
   commitment"), so the page labels them as pilot pricing.

   The maths mirrors server/src/services/remittance/pricing.ts:
     fee           = feeFixed + feePercent × send          (source currency)
     margin        = send × spread × (1 − tier discount)   (value kept in the rate)
     total debit   = send + fee
   Tier discounts: TIER_3 25 %, BUSINESS 35 % (tierSpreadDiscounts). */

import { useId, useMemo, useState } from "react";
import { Box, Input, Select } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { Footnote, StatusChip, useSiteTheme } from "@/components/site";
import { FieldLabel, useFieldStyle } from "./fields";

type Corridor = { code: string; label: string; ccy: string; fixed: number; pct: number; spread: number; dec: number };

export const CORRIDORS: Corridor[] = [
  { code: "GB-LY", label: "company.fees.calc.c.gbLy", ccy: "GBP", fixed: 2, pct: 0.005, spread: 0.015, dec: 2 },
  { code: "LY-GB", label: "company.fees.calc.c.lyGb", ccy: "LYD", fixed: 10, pct: 0.005, spread: 0.015, dec: 3 },
  { code: "EU-LY", label: "company.fees.calc.c.euLy", ccy: "EUR", fixed: 2, pct: 0.005, spread: 0.015, dec: 2 },
  { code: "LY-EU", label: "company.fees.calc.c.lyEu", ccy: "LYD", fixed: 10, pct: 0.005, spread: 0.015, dec: 3 },
  { code: "EG-LY", label: "company.fees.calc.c.egLy", ccy: "EGP", fixed: 50, pct: 0.004, spread: 0.012, dec: 2 },
  { code: "LY-EG", label: "company.fees.calc.c.lyEg", ccy: "LYD", fixed: 5, pct: 0.004, spread: 0.012, dec: 3 },
  { code: "TR-LY", label: "company.fees.calc.c.trLy", ccy: "TRY", fixed: 30, pct: 0.004, spread: 0.013, dec: 2 },
  { code: "LY-TR", label: "company.fees.calc.c.lyTr", ccy: "LYD", fixed: 8, pct: 0.004, spread: 0.013, dec: 3 },
  { code: "AE-LY", label: "company.fees.calc.c.aeLy", ccy: "AED", fixed: 10, pct: 0.004, spread: 0.012, dec: 2 },
  { code: "LY-AE", label: "company.fees.calc.c.lyAe", ccy: "LYD", fixed: 8, pct: 0.004, spread: 0.012, dec: 3 },
  { code: "TN-LY", label: "company.fees.calc.c.tnLy", ccy: "TND", fixed: 3, pct: 0.004, spread: 0.012, dec: 3 },
  { code: "LY-TN", label: "company.fees.calc.c.lyTn", ccy: "LYD", fixed: 5, pct: 0.004, spread: 0.012, dec: 3 },
];

const PROFILES = [
  { id: "standard", label: "company.fees.calc.profile.standard", discount: 0 },
  { id: "tier3", label: "company.fees.calc.profile.tier3", discount: 0.25 },
  { id: "business", label: "company.fees.calc.profile.business", discount: 0.35 },
] as const;

const fmt = (n: number, dec: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
const pct = (n: number) => `${(Math.round(n * 10000) / 100).toString()}%`;

export default function RemitCalculator() {
  const { t } = useTranslate();
  const theme = useSiteTheme();
  const field = useFieldStyle();
  const uid = useId();
  const [code, setCode] = useState("GB-LY");
  const [raw, setRaw] = useState("500");
  const [profile, setProfile] = useState<(typeof PROFILES)[number]["id"]>("standard");

  const c = CORRIDORS.find((x) => x.code === code) ?? CORRIDORS[0];
  const amount = Number(raw.replace(/,/g, ""));
  const valid = Number.isFinite(amount) && amount > 0;
  const r = useMemo(() => {
    const discount = PROFILES.find((p) => p.id === profile)?.discount ?? 0;
    const spread = c.spread * (1 - discount);
    const fee = c.fixed + amount * c.pct;
    const margin = amount * spread;
    return { spread, fee, margin, total: fee + margin, debit: amount + fee };
  }, [amount, c, profile]);

  const money = (n: number) => (
    <Box as="span" dir="ltr" sx={{ unicodeBidi: "isolate", fontVariantNumeric: "tabular-nums" }}>{fmt(n, c.dec)} {c.ccy}</Box>
  );
  const line = (label: string, hint: React.ReactNode, value: React.ReactNode, strong?: boolean) => (
    <Box display="flex" alignItems="baseline" justifyContent="space-between" gap="16px" py="14px" borderTop="1px solid" borderColor={theme.border}>
      <Box minW={0}>
        <Box fontSize="15.5px" fontWeight={strong ? 600 : 500} color={theme.fg}>{label}</Box>
        {hint && <Box mt="2px" fontSize="13px" color={theme.fgFaint}>{hint}</Box>}
      </Box>
      <Box fontSize={strong ? "20px" : "16px"} fontWeight={strong ? 600 : 500} color={theme.fg} textAlign="end" flexShrink={0}>{value}</Box>
    </Box>
  );

  return (
    <Box>
      <Box display="grid" gridTemplateColumns={{ base: "minmax(0,1fr)", sm: "minmax(0,1.3fr) minmax(0,1fr)" }} gap="16px">
        <Box>
          <FieldLabel htmlFor={`${uid}-corridor`}>{t("company.fees.calc.corridor")}</FieldLabel>
          <Select id={`${uid}-corridor`} value={code} onChange={(e) => setCode(e.target.value)} h="52px" {...field}
            /* Chakra keeps the chevron on the physical right but flips its padding in RTL — pin both sides. */
            style={{ paddingLeft: 16, paddingRight: 40 }}>
            {CORRIDORS.map((x) => <option key={x.code} value={x.code}>{t(x.label)}</option>)}
          </Select>
        </Box>
        <Box>
          <FieldLabel htmlFor={`${uid}-amount`}>{t("company.fees.calc.amount")} ({c.ccy})</FieldLabel>
          <Input id={`${uid}-amount`} inputMode="decimal" value={raw} dir="ltr"
            onChange={(e) => setRaw(e.target.value.replace(/[^0-9.,]/g, ""))}
            aria-invalid={!valid} aria-describedby={!valid ? `${uid}-err` : undefined}
            h="52px" fontWeight={600} sx={{ fontVariantNumeric: "tabular-nums" }} {...field} />
        </Box>
      </Box>

      <Box as="fieldset" mt="18px" border="none" p={0}>
        <Box as="legend" mb="8px" fontSize="14px" fontWeight={500} color={theme.fgMuted}>{t("company.fees.calc.profile")}</Box>
        <Box display="flex" flexWrap="wrap" gap="8px">
          {PROFILES.map((p) => {
            const on = profile === p.id;
            return (
              <Box key={p.id} as="label" position="relative" display="inline-flex" alignItems="center" minH="44px" px="16px" borderRadius="999px" cursor="pointer"
                border="1px solid" borderColor={on ? theme.fg : theme.border} bg={on ? theme.fg : "transparent"} color={on ? theme.bg : theme.fgMuted}
                fontSize="14px" fontWeight={500} transition="background-color .15s ease, color .15s ease"
                sx={{ "&:has(input:focus-visible)": { outline: `2px solid ${theme.dark ? theme.accentText : theme.accent}`, outlineOffset: "2px" } }}>
                <input type="radio" name={`${uid}-profile`} value={p.id} checked={on} onChange={() => setProfile(p.id)}
                  style={{ position: "absolute", opacity: 0, width: 1, height: 1 }} />
                {t(p.label)}
              </Box>
            );
          })}
        </Box>
      </Box>

      <Box mt="26px" aria-live="polite">
        {valid ? (
          <>
            {line(t("company.fees.calc.fee"), <Box as="span" dir="ltr" sx={{ unicodeBidi: "isolate" }}>{fmt(c.fixed, c.dec)} {c.ccy} + {pct(c.pct)}</Box>, money(r.fee))}
            {line(t("company.fees.calc.margin"), <>{pct(r.spread)} · {t("company.fees.calc.marginHint")}</>, money(r.margin))}
            {line(t("company.fees.calc.total"), <>{valid ? pct(r.total / amount) : ""} {t("company.fees.calc.totalPct")}</>, money(r.total), true)}
            {line(t("company.fees.calc.debit"), null, money(r.debit))}
          </>
        ) : (
          <Box id={`${uid}-err`} py="14px" borderTop="1px solid" borderColor={theme.border} color={theme.fgMuted} fontSize="15px">
            {t("company.fees.calc.invalid")}
          </Box>
        )}
      </Box>
      <Box mt="18px" display="flex" gap="10px" alignItems="flex-start">
        <StatusChip status="pilot" />
        <Footnote>{t("company.fees.calc.note")}</Footnote>
      </Box>
    </Box>
  );
}
