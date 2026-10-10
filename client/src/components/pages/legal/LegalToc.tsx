"use client";

/* Table of contents for a legal document.
   Desktop: a sticky column beside the text with a scroll-spy marker.
   Phones/tablets: a slim sticky bar under the nav that names the section
   you are reading and opens the full list as a dropdown (absolutely
   positioned, so opening it never shifts the text underneath). */

import { useEffect, useRef, useState } from "react";
import { Box } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { FiArrowUp, FiChevronDown } from "react-icons/fi";
import { SectionLabel, useSiteLocale, useSiteTheme } from "@/components/site";

export type TocItem = { id: string; label: string; num: string | null };

const GUTTER = "clamp(16px, 5vw, 48px)";

function TocList({
  items, active, onNavigate, dense,
}: { items: TocItem[]; active: string | null; onNavigate?: () => void; dense?: boolean }) {
  const t = useSiteTheme();
  return (
    <Box as="ol" listStyleType="none" m={0} p={0}>
      {items.map((it) => {
        const on = it.id === active;
        return (
          <Box as="li" key={it.id}>
            <Box
              as="a"
              href={`#${it.id}`}
              onClick={onNavigate}
              aria-current={on ? "location" : undefined}
              display="flex"
              alignItems="center"
              gap="10px"
              minH="44px"
              py={dense ? "6px" : "8px"}
              color={on ? t.fg : t.fgMuted}
              fontSize="14.5px"
              fontWeight={on ? 600 : 400}
              lineHeight={1.4}
              transition="color .15s ease, border-color .15s ease"
              _hover={{ color: t.fg }}
              _focusVisible={{ outline: `2px solid ${t.accent}`, outlineOffset: "-2px", borderRadius: "6px" }}
              sx={{
                paddingInlineStart: "14px",
                borderInlineStart: `2px solid ${on ? t.accent : t.border}`,
              }}
            >
              <Box
                as="span"
                minW="20px"
                fontSize="12.5px"
                fontWeight={600}
                color={on ? t.accentText : t.fgFaint}
                sx={{ fontVariantNumeric: "tabular-nums" }}
                aria-hidden={!it.num}
              >
                {it.num}
              </Box>
              <Box as="span" dir="auto" minW={0}>
                {it.label}
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

/** Sticky contents column (lg and up). */
export function DesktopToc({ items, active }: { items: TocItem[]; active: string | null }) {
  const t = useSiteTheme();
  const { t: tr } = useTranslate();
  return (
    <Box
      as="nav"
      aria-label={tr("legal.toc.label")}
      data-legal-noprint
      display={{ base: "none", lg: "block" }}
      position="sticky"
      top="104px"
      alignSelf="start"
      maxH="calc(100vh - 128px)"
      overflowY="auto"
      pb="12px"
      sx={{ scrollbarWidth: "thin" }}
    >
      <SectionLabel mb="12px">{tr("legal.toc.title")}</SectionLabel>
      <TocList items={items} active={active} dense />
      <Box
        as="a"
        href="#top"
        mt="18px"
        display="inline-flex"
        alignItems="center"
        gap="8px"
        minH="44px"
        color={t.accentText}
        fontSize="14px"
        fontWeight={500}
        _hover={{ textDecoration: "underline", textUnderlineOffset: "4px" }}
        _focusVisible={{ outline: `2px solid ${t.accent}`, outlineOffset: "3px", borderRadius: "6px" }}
      >
        <FiArrowUp size={14} aria-hidden />
        {tr("legal.toc.backToTop")}
      </Box>
    </Box>
  );
}

/** Sticky "On this page" bar with a dropdown list (below lg). */
export function MobileToc({ items, active }: { items: TocItem[]; active: string | null }) {
  const t = useSiteTheme();
  const { t: tr } = useTranslate();
  const { isAr } = useSiteLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const current = items.find((i) => i.id === active) ?? null;
  const shown = current ?? items[0];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <Box
      ref={rootRef}
      as="nav"
      aria-label={tr("legal.toc.label")}
      data-legal-noprint
      display={{ base: "block", lg: "none" }}
      position="sticky"
      top="64px"
      zIndex={20}
      mb="clamp(28px, 6vw, 44px)"
      sx={{ marginInline: `calc(-1 * ${GUTTER})` }}
    >
      <Box bg={t.bg} borderTop="1px solid" borderBottom="1px solid" borderColor={t.border} px={GUTTER}>
        <Box
          as="button"
          ref={buttonRef}
          type="button"
          w="100%"
          h="52px"
          display="flex"
          alignItems="center"
          gap="12px"
          textAlign="start"
          aria-expanded={open}
          aria-controls="legal-toc-list"
          onClick={() => setOpen((v) => !v)}
          _focusVisible={{ outline: `2px solid ${t.accent}`, outlineOffset: "-2px", borderRadius: "8px" }}
        >
          <Box
            as="span"
            flexShrink={0}
            fontSize="12px"
            fontWeight={600}
            letterSpacing={isAr ? 0 : "0.09em"}
            textTransform="uppercase"
            color={t.fgFaint}
          >
            {tr("legal.toc.title")}
          </Box>
          <Box
            as="span"
            flex="1"
            minW={0}
            overflow="hidden"
            textOverflow="ellipsis"
            whiteSpace="nowrap"
            fontSize="14.5px"
            fontWeight={500}
            color={current ? t.fg : t.fgMuted}
          >
            {shown?.num && (
              <Box as="span" color={t.fgFaint} sx={{ fontVariantNumeric: "tabular-nums", marginInlineEnd: "8px" }}>
                {shown.num}
              </Box>
            )}
            {shown?.label}
          </Box>
          <Box
            as="span"
            aria-hidden
            color={t.fgMuted}
            transition="transform .2s ease"
            transform={open ? "rotate(180deg)" : "none"}
            flexShrink={0}
          >
            <FiChevronDown size={18} />
          </Box>
        </Box>
      </Box>
      <Box
        id="legal-toc-list"
        hidden={!open}
        position="absolute"
        top="100%"
        left={0}
        right={0}
        bg={t.bgElev}
        borderBottom="1px solid"
        borderColor={t.border}
        boxShadow={t.shadow}
        maxH="min(64vh, 540px)"
        overflowY="auto"
        px={GUTTER}
        py="10px"
      >
        <TocList items={items} active={active} onNavigate={() => setOpen(false)} />
      </Box>
    </Box>
  );
}
