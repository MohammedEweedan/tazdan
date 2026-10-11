"use client";

/* Local building blocks for /features — built only from the site kit.
   <Pill>          44px hit area around a quiet 34px pill (selected = accent).
   <SectionIndex>  sticky, horizontally scrollable chip bar under the nav that
                   highlights the area in view.
   <AreaSection>   pain → headline → lead, a phone with a screen switcher
                   (sticky on desktop, synced to the row being read) and a
                   RowList of every capability with its status chip.          */

import { useEffect, useRef, useState } from "react";
import { Box, useBreakpointValue } from "@chakra-ui/react";
import { useReducedMotion } from "framer-motion";
import { useTranslate } from "@tolgee/react";
import {
  Container, Eyebrow, Footnote, Headline, Lead, PhoneStage, Reveal, Row, RowList, Section,
  SiteButton, StatusChip, useSiteTheme,
} from "@/components/site";
import { areaStatus, type Area } from "./data";

/** Height of the fixed nav plus this page's sticky index bar. */
export const STICKY_OFFSET = 128;

export function Pill({
  active, children, onClick, href, ariaPressed,
}: { active: boolean; children: React.ReactNode; onClick?: (e: React.MouseEvent) => void; href?: string; ariaPressed?: boolean }) {
  const t = useSiteTheme();
  return (
    <Box
      as={href ? "a" : "button"}
      {...(href ? { href } : { type: "button" })}
      onClick={onClick}
      aria-pressed={ariaPressed}
      aria-current={href && active ? "true" : undefined}
      data-active={active ? "true" : undefined}
      display="inline-flex"
      alignItems="center"
      minH="44px"
      flexShrink={0}
      cursor="pointer"
      sx={{ WebkitTapHighlightColor: "transparent" }}
      _focusVisible={{ outline: "none", "& > span": { outline: `2px solid ${t.accent}`, outlineOffset: "2px" } }}
    >
      <Box
        as="span"
        display="inline-flex"
        alignItems="center"
        h="34px"
        px="13px"
        borderRadius="999px"
        border="1px solid"
        borderColor={active ? t.accentBorder : t.border}
        bg={active ? t.accentSoft : "transparent"}
        color={active ? t.accentText : t.fgMuted}
        fontSize="14px"
        fontWeight={500}
        whiteSpace="nowrap"
        transition="background-color .18s ease, border-color .18s ease, color .18s ease"
        _hover={active ? undefined : { color: t.fg, borderColor: t.borderStrong }}
      >
        {children}
      </Box>
    </Box>
  );
}

/* ── sticky section index ─────────────────────────────────────────────── */

export function SectionIndex({ items }: { items: { id: string; label: string }[] }) {
  const t = useSiteTheme();
  const { t: tr } = useTranslate();
  const reduced = useReducedMotion();
  const [active, setActive] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      let current: string | null = null;
      for (const it of items) {
        const el = document.getElementById(it.id);
        if (el && el.getBoundingClientRect().top <= STICKY_OFFSET + 40) current = it.id;
      }
      setActive(current);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [items]);

  // Keep the highlighted chip in view inside the bar (relative scroll, so it
  // behaves the same in LTR and RTL and never moves the page).
  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    const chip = box.querySelector<HTMLElement>("[data-active=true]");
    if (!chip) { box.scrollTo({ left: 0 }); return; }
    const b = box.getBoundingClientRect();
    const c = chip.getBoundingClientRect();
    if (c.left < b.left + 24 || c.right > b.right - 24) {
      box.scrollBy({ left: c.left - b.left - (b.width - c.width) / 2, behavior: reduced ? "auto" : "smooth" });
    }
  }, [active, reduced]);

  const go = (id: string) => (e: React.MouseEvent) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <Box
      as="nav"
      aria-label={tr("features.index.label")}
      position="sticky"
      top="64px"
      zIndex={20}
      bg={t.dark ? "rgba(22,24,28,0.94)" : "rgba(246,247,250,0.95)"}
      borderBottom="1px solid"
      borderColor={t.border}
      sx={{ backdropFilter: "saturate(1.4) blur(10px)" }}
    >
      <Container>
        <Box
          ref={scroller}
          display="flex"
          gap="4px"
          overflowX="auto"
          py="4px"
          sx={{
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
            maskImage: "linear-gradient(to right, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%)",
          }}
        >
          {items.map((it) => (
            <Pill key={it.id} href={`#${it.id}`} active={active === it.id} onClick={go(it.id)}>
              {it.label}
            </Pill>
          ))}
        </Box>
      </Container>
    </Box>
  );
}

/* ── one area ─────────────────────────────────────────────────────────── */

export function AreaSection({ area, phoneSide }: { area: Area; phoneSide: "start" | "end" }) {
  const t = useSiteTheme();
  const { t: tr } = useTranslate();
  const desktop = useBreakpointValue({ base: false, lg: true }, { ssr: true }) ?? false;
  const [shown, setShown] = useState(0);
  const rowsRef = useRef<HTMLDivElement>(null);
  const status = areaStatus(area);
  const items = area.media.map((m) => ({ video: m.video, screen: m.screen, alt: tr(m.alt) }));

  // Desktop: the sticky phone follows the row being read.
  useEffect(() => {
    if (!desktop || !rowsRef.current) return;
    const rows = Array.from(rowsRef.current.querySelectorAll<HTMLElement>("[data-media]"));
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setShown(Number((e.target as HTMLElement).dataset.media)); }),
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    rows.forEach((r) => io.observe(r));
    return () => io.disconnect();
  }, [desktop, area.id]);

  const phone = (
    <Box display="flex" flexDirection="column" alignItems="center" gap="18px">
      <Box position="relative">
        <Box aria-hidden position="absolute" inset="-18%" bg={t.glow} pointerEvents="none" />
        <PhoneStage
          items={items}
          index={shown}
          w={{ base: "min(270px, 70vw)", lg: "auto" }}
          h={{ base: "auto", lg: "min(560px, calc(100vh - 270px))" }}
        />
      </Box>
      {area.media.length > 1 && (
        <Box role="group" aria-label={tr("features.switcher.label")} display="flex" flexWrap="wrap" justifyContent="center" columnGap="6px" maxW="440px">
          {area.media.map((m, i) => (
            <Pill key={i} active={shown === i} ariaPressed={shown === i} onClick={() => setShown(i)}>
              {tr(m.tab)}
            </Pill>
          ))}
        </Box>
      )}
    </Box>
  );

  const areas = {
    base: `"copy" "phone" "rows"`,
    lg: phoneSide === "end" ? `"copy phone" "rows phone"` : `"phone copy" "phone rows"`,
  };
  const cols = {
    base: "minmax(0,1fr)",
    lg: phoneSide === "end" ? "minmax(0,1.05fr) minmax(0,0.95fr)" : "minmax(0,0.95fr) minmax(0,1.05fr)",
  };

  return (
    <Section id={area.id} rule aria-labelledby={`${area.id}-title`} sx={{ scrollMarginTop: `${STICKY_OFFSET - 1}px` }}>
      <Container>
        <Box
          display="grid"
          gridTemplateAreas={areas}
          gridTemplateColumns={cols}
          gridTemplateRows={{ base: "auto", lg: "auto 1fr" }}
          columnGap="clamp(40px, 6vw, 96px)"
          rowGap={{ base: "44px", lg: "36px" }}
        >
          <Box gridArea="copy">
            <Reveal y={18}>
              <Box
                as="p"
                mb="20px"
                maxW="46ch"
                fontSize={{ base: "15px", md: "16px" }}
                lineHeight={1.55}
                color={t.fgFaint}
                style={{ textAlign: "start" }}
                sx={{ paddingInlineStart: "14px", borderInlineStart: `2px solid ${t.divider}` }}
              >
                {tr(area.pain)}
              </Box>
              <Box display="flex" alignItems="center" gap="10px" flexWrap="wrap" mb="14px">
                <Eyebrow>{tr(area.nav)}</Eyebrow>
                {status && <StatusChip status={status} />}
              </Box>
              <Headline id={`${area.id}-title`} text={tr(area.title)} maxW="17ch" />
              <Lead mt="20px" maxW="44ch">{tr(area.lead)}</Lead>
              {area.note && <Footnote mt="16px" maxW="54ch">{tr(area.note)}</Footnote>}
            </Reveal>
          </Box>

          <Box gridArea="phone" position="relative">
            <Box position={{ base: "static", lg: "sticky" }} top={`${STICKY_OFFSET + 24}px`}>{phone}</Box>
          </Box>

          <Box gridArea="rows" ref={rowsRef}>
            <RowList borderTop="1px solid" borderBottom="1px solid" borderColor={t.border}>
              {area.caps.map((c) => (
                <Row
                  key={c.title}
                  data-media={c.media}
                  icon={c.icon}
                  title={
                    <Box as="span" display="flex" flexWrap="wrap" alignItems="center" columnGap="10px" rowGap="6px">
                      <span>{tr(c.title)}</span>
                      <StatusChip status={c.status} />
                    </Box>
                  }
                  body={tr(c.body)}
                />
              ))}
            </RowList>
            {area.link && (
              <Box mt="24px">
                <SiteButton variant="link" href={area.link.href} arrow>{tr(area.link.label)}</SiteButton>
              </Box>
            )}
          </Box>
        </Box>
      </Container>
    </Section>
  );
}
