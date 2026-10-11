"use client";

/* Who can do what in a business account — mirrors the CAN matrix in
   server/src/services/business/access.ts (plus "only the owner grants or
   removes admin" from business.controller.ts). Hairline grid with ARIA table
   roles; on phones each action sits above its four role marks. */

import { Box, VisuallyHidden } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { FiCheck } from "react-icons/fi";
import { Footnote, SectionLabel, useSiteTheme } from "@/components/site";

const ROLES = [
  { id: "OWNER", label: "business.roles.owner" },
  { id: "ADMIN", label: "business.roles.admin" },
  { id: "ANALYST", label: "business.roles.analyst" },
  { id: "DEVELOPER", label: "business.roles.developer" },
] as const;

// Order: OWNER, ADMIN, ANALYST, DEVELOPER
const ROWS = [
  { label: "business.roles.r.view", allow: [true, true, true, true] },
  { label: "business.roles.r.profile", allow: [true, true, false, false] },
  { label: "business.roles.r.team", allow: [true, true, false, false] },
  { label: "business.roles.r.pay", allow: [true, true, false, false] },
  { label: "business.roles.r.keys", allow: [true, true, false, true] },
  { label: "business.roles.r.kyb", allow: [true, false, false, false] },
] as const;

const COLS = { base: "repeat(4, minmax(0,1fr))", md: "minmax(0,1fr) repeat(4, minmax(62px, 76px))" };

export default function RoleTable() {
  const { t: tr } = useTranslate();
  const t = useSiteTheme();
  return (
    <Box>
      <SectionLabel mb="12px" id="biz-roles-caption">{tr("business.roles.caption")}</SectionLabel>
      <Box role="table" aria-labelledby="biz-roles-caption" borderBottom="1px solid" borderColor={t.border}>
        <Box role="row" display="grid" gridTemplateColumns={COLS} alignItems="end" pb="10px" borderBottom="1px solid" borderColor={t.divider}>
          <Box role="columnheader" display={{ base: "none", md: "block" }} fontSize="12.5px" color={t.fgFaint}>
            {tr("business.roles.action")}
          </Box>
          {ROLES.map((r) => (
            <Box key={r.id} role="columnheader" textAlign="center" fontSize="12.5px" fontWeight={600} color={t.fgMuted} lineHeight={1.3}>
              {tr(r.label)}
            </Box>
          ))}
        </Box>
        {ROWS.map((row) => (
          <Box
            key={row.label}
            role="row"
            display="grid"
            gridTemplateColumns={COLS}
            alignItems="center"
            rowGap="8px"
            py="12px"
            borderTop="1px solid"
            borderColor={t.border}
            sx={{ "&:nth-of-type(2)": { borderTop: "none" } }}
          >
            <Box role="rowheader" gridColumn={{ base: "1 / -1", md: "auto" }} fontSize="14.5px" color={t.fg} lineHeight={1.45} style={{ textAlign: "start" }}>
              {tr(row.label)}
            </Box>
            {row.allow.map((ok, i) => (
              <Box key={ROLES[i].id} role="cell" display="flex" justifyContent="center" alignItems="center" minH="22px">
                {ok ? (
                  <Box as="span" color={t.accentText} display="inline-flex"><FiCheck size={16} aria-hidden /></Box>
                ) : (
                  <Box as="span" aria-hidden color={t.fgFaint} fontSize="14px">–</Box>
                )}
                <VisuallyHidden>{`${tr(ROLES[i].label)}: ${tr(ok ? "business.roles.yes" : "business.roles.no")}`}</VisuallyHidden>
              </Box>
            ))}
          </Box>
        ))}
      </Box>
      <Footnote mt="14px" maxW="56ch">{tr("business.roles.note")}</Footnote>
    </Box>
  );
}
