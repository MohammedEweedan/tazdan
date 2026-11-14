"use client";

/* Accessible accordion for the help centre (WAI-ARIA pattern): each question
   is a button inside a heading, wired to its answer region with
   aria-controls / aria-labelledby. Several answers may be open at once, and
   none is open by default. Same look as the kit's FAQList. */

import { useState } from "react";
import { Box, Collapse } from "@chakra-ui/react";
import { FiPlus } from "react-icons/fi";
import { Body, SiteButton, useSiteTheme } from "@/components/site";

export type HelpItem = { id: string; q: string; a: string; link?: { href: string; label: string } };

export default function HelpAccordion({ items, headingLevel = 3 }: { items: HelpItem[]; headingLevel?: 2 | 3 | 4 }) {
  const t = useSiteTheme();
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const ring = t.dark ? t.accentText : t.accent;
  return (
    <Box borderBottom="1px solid" borderColor={t.border}>
      {items.map((it) => {
        const isOpen = open.has(it.id);
        const btnId = `faq-q-${it.id}`;
        const panelId = `faq-a-${it.id}`;
        return (
          <Box key={it.id} id={`faq-${it.id}`} borderTop="1px solid" borderColor={t.border} sx={{ scrollMarginTop: "96px" }}>
            <Box as={`h${headingLevel}` as "h3"} m={0}>
              <Box
                as="button"
                type="button"
                id={btnId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(it.id)}
                w="100%"
                minH="64px"
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                gap="16px"
                py="20px"
                textAlign="start"
                fontSize={{ base: "16.5px", md: "18px" }}
                fontWeight={500}
                color={t.fg}
                lineHeight={1.4}
                _hover={{ color: t.accentText }}
                _focusVisible={{ outline: `2px solid ${ring}`, outlineOffset: "2px", borderRadius: "6px" }}
              >
                <span>{it.q}</span>
                <Box as="span" aria-hidden color={t.fgMuted} transition="transform .25s ease" transform={isOpen ? "rotate(45deg)" : "none"} flexShrink={0}>
                  <FiPlus size={20} />
                </Box>
              </Box>
            </Box>
            <Collapse in={isOpen} animateOpacity>
              <Box id={panelId} role="region" aria-labelledby={btnId} pb="24px">
                <Body maxW="70ch">{it.a}</Body>
                {it.link && (
                  <Box mt="12px"><SiteButton variant="link" href={it.link.href} arrow>{it.link.label}</SiteButton></Box>
                )}
              </Box>
            </Collapse>
          </Box>
        );
      })}
    </Box>
  );
}
