"use client";

/* Presentational pieces of the web sign-up flow (/register). The page keeps
   all state, validation and API calls; these only render. */

import { useRef, useState } from "react";
import { Box, chakra } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import type { IconType } from "react-icons";
import { FiFileText, FiUpload, FiX } from "react-icons/fi";
import { Eyebrow, Footnote, Headline, IconDisc, Lead, PhoneStage, useSiteTheme } from "@/components/site";
import { ringOf } from "./authKit";

/* ── avatar picker ───────────────────────────────────────────────────────── */

export type AvatarGroup = { key: string; label: string; emojis: string[] };

/** Category pills + emoji grid (the app's avatar picker). */
export function AvatarPicker({ title, groups, value, onPick }: {
  title: string; groups: AvatarGroup[]; value: string; onPick: (emoji: string) => void;
}) {
  const t = useSiteTheme();
  const ring = ringOf(t);
  const [active, setActive] = useState(groups[0]?.key);
  const group = groups.find((g) => g.key === active) ?? groups[0];
  return (
    <Box w="100%" pt="6px">
      <Box fontSize="14px" fontWeight={600} color={t.fg} mb="10px">{title}</Box>
      <Box
        role="tablist"
        aria-label={title}
        display="flex"
        gap="6px"
        overflowX="auto"
        pb="4px"
        sx={{ scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}
      >
        {groups.map((g) => {
          const on = g.key === group.key;
          return (
            <chakra.button
              key={g.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(g.key)}
              flexShrink={0}
              h="36px"
              px="14px"
              borderRadius="999px"
              fontSize="13px"
              fontWeight={600}
              bg={on ? t.fg : t.bgRaised}
              color={on ? t.bg : t.fgMuted}
              _hover={on ? undefined : { color: t.fg }}
              _focusVisible={{ outline: `2px solid ${ring}`, outlineOffset: "2px" }}
            >
              {g.label}
            </chakra.button>
          );
        })}
      </Box>
      <Box role="tabpanel" mt="12px" display="flex" flexWrap="wrap" gap="8px">
        {group.emojis.map((emoji, i) => {
          const on = value === emoji;
          return (
            <chakra.button
              key={`${emoji}-${i}`}
              type="button"
              aria-pressed={on}
              onClick={() => onPick(emoji)}
              w="44px"
              h="44px"
              borderRadius="14px"
              fontSize="22px"
              lineHeight={1}
              bg={on ? t.bgElev : t.bgRaised}
              border="1.5px solid"
              borderColor={on ? ring : "transparent"}
              transition="border-color .15s ease, background-color .15s ease"
              _hover={{ borderColor: on ? ring : t.borderStrong }}
              _focusVisible={{ outline: `2px solid ${ring}`, outlineOffset: "2px" }}
            >
              {emoji}
            </chakra.button>
          );
        })}
      </Box>
    </Box>
  );
}

/* ── identity document slot ─────────────────────────────────────────────── */

/** One document row: icon (or preview), label + hint (or file name), and an
 *  Upload pill or a remove button. Accepts JPG / PNG / WEBP / PDF. */
export function KycSlotRow({
  icon, label, hint, file, preview, onPick, uploadLabel, removeLabel,
}: {
  icon: IconType;
  label: string;
  hint: string;
  file: File | null;
  preview: string | null;
  onPick: (f: File | null) => void;
  uploadLabel: string;
  removeLabel: string;
}) {
  const t = useSiteTheme();
  const ring = ringOf(t);
  const ref = useRef<HTMLInputElement | null>(null);
  const has = !!file;
  const isPdf = file?.type === "application/pdf";
  return (
    <Box role="listitem" display="flex" alignItems="center" gap="14px" py="14px" px="16px">
      {preview && !isPdf ? (
        <Box
          w="44px"
          h="44px"
          minW="44px"
          borderRadius="12px"
          bg="#000"
          backgroundImage={`url(${preview})`}
          backgroundSize="cover"
          backgroundPosition="center"
          aria-hidden
        />
      ) : (
        <IconDisc icon={isPdf ? FiFileText : icon} size={44} tone={has ? "green" : "neutral"} />
      )}
      <Box flex="1" minW={0}>
        <Box fontSize="15px" fontWeight={600} color={t.fg} lineHeight={1.35}>{label}</Box>
        <Box mt="2px" fontSize="13px" color={t.fgMuted} lineHeight={1.45} noOfLines={1} dir={has ? "auto" : undefined}>
          {has ? file!.name : hint}
        </Box>
      </Box>
      {has ? (
        <chakra.button
          type="button"
          onClick={() => onPick(null)}
          aria-label={`${removeLabel}: ${label}`}
          w="44px"
          h="44px"
          flexShrink={0}
          borderRadius="999px"
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          color={t.fgMuted}
          _hover={{ color: t.fg, bg: t.bgRaised }}
          _focusVisible={{ outline: `2px solid ${ring}`, outlineOffset: "1px" }}
        >
          <FiX size={17} aria-hidden />
        </chakra.button>
      ) : (
        <chakra.button
          type="button"
          onClick={() => ref.current?.click()}
          aria-label={`${uploadLabel}: ${label}`}
          flexShrink={0}
          h="38px"
          px="14px"
          borderRadius="999px"
          border="1px solid"
          borderColor={t.borderStrong}
          color={t.fg}
          fontSize="13.5px"
          fontWeight={600}
          display="inline-flex"
          alignItems="center"
          gap="6px"
          _hover={{ borderColor: t.fg }}
          _focusVisible={{ outline: `2px solid ${ring}`, outlineOffset: "2px" }}
        >
          <FiUpload size={14} aria-hidden />
          {uploadLabel}
        </chakra.button>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        style={{ display: "none" }}
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          if (ref.current) ref.current.value = "";
        }}
      />
    </Box>
  );
}

/* ── desktop aside ───────────────────────────────────────────────────────── */

const SCREENS = {
  details: { screen: "onboarding", alt: "account.register.aside.alt.onboarding" },
  business: { screen: "business-home", alt: "account.register.aside.alt.business" },
  email: { screen: "twofa", alt: "account.register.aside.alt.code" },
  identity: { screen: "kyc", alt: "account.register.aside.alt.kyc" },
  done: { screen: "home", alt: "account.register.aside.alt.home" },
} as const;

/** The story beside the form on large screens: what this account is for and
 *  the app screen that matches the current step. */
export function RegisterAside({ business, step }: { business: boolean; step: 1 | 2 | 3 | 4 }) {
  const { t: tr } = useTranslate();
  const order = [business ? SCREENS.business : SCREENS.details, SCREENS.email, SCREENS.identity, SCREENS.done];
  const items = order.map((s) => ({ screen: s.screen, alt: tr(s.alt) }));
  return (
    <Box>
      <Eyebrow mb="14px">{tr(business ? "account.register.aside.business.eyebrow" : "account.register.aside.personal.eyebrow")}</Eyebrow>
      <Headline
        as="h2"
        size="sub"
        maxW="16ch"
        text={tr(business ? "account.register.aside.business.title" : "account.register.aside.personal.title")}
      />
      <Lead mt="16px" maxW="40ch" fontSize={{ base: "16px", md: "17px" }}>
        {tr(business ? "account.register.aside.business.lead" : "account.register.aside.personal.lead")}
      </Lead>
      <Box mt="40px" display="flex" justifyContent="center">
        <PhoneStage items={items} index={step - 1} w="min(270px, 100%)" />
      </Box>
      <Footnote mt="22px" align="center">{tr("common.media.illustrative")}</Footnote>
    </Box>
  );
}
