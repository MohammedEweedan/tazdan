"use client";

/* Form fields styled like the app's inputs: bgRaised fill, 14px radius,
   hairline border and a clearly visible focus ring in both colour modes. */

import { Box, type BoxProps } from "@chakra-ui/react";
import { useSiteTheme } from "@/components/site";

/** Shared Chakra props for Input / Select / Textarea. */
export function useFieldStyle() {
  const t = useSiteTheme();
  // The navy accent is too dark to read as a ring on charcoal; use the light slate there.
  const ring = t.dark ? t.accentText : t.accent;
  return {
    bg: t.bgRaised,
    color: t.fg,
    border: "1px solid",
    borderColor: t.border,
    borderRadius: "14px",
    fontSize: "16px",
    focusBorderColor: ring,
    _hover: { borderColor: t.borderStrong },
    _placeholder: { color: t.fgFaint },
    _focusVisible: { borderColor: ring, boxShadow: `0 0 0 3px ${t.dark ? "rgba(155,168,183,0.35)" : "rgba(36,56,79,0.25)"}` },
    _invalid: { borderColor: t.red },
  } as const;
}

/** Visible label above a field. */
export function FieldLabel({ htmlFor, children, ...rest }: { htmlFor: string } & BoxProps) {
  const t = useSiteTheme();
  return (
    <Box as="label" htmlFor={htmlFor} display="block" mb="8px" fontSize="14px" fontWeight={500} color={t.fgMuted} {...rest}>
      {children}
    </Box>
  );
}
