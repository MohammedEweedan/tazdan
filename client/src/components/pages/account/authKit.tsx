"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   Auth kit — the app's onboarding / sign-up look for the web flow.

   A slim header (logo · language · theme · close) instead of the full site
   nav, charcoal / paper surfaces, `bgRaised` fields with a 14px radius and a
   visible focus ring, the ink pill as the one primary action and the app's
   pill-dot progress. Built only from the site kit tokens.

   RTL: insets are written as inline `style` (Chakra rewrites `insetInline*`
   in `sx` into physical left/right, which would not flip in Arabic).
   ═══════════════════════════════════════════════════════════════════════════ */

import { useId, useState } from "react";
import NextLink from "next/link";
import {
  Box, chakra, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Spinner, type BoxProps,
} from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { FiAlertCircle, FiCheck, FiCheckCircle, FiChevronDown, FiX } from "react-icons/fi";
import { TextLogo } from "@/components/ui/Logo";
import ColorModeToggle from "@/components/ui/ColorModeToggle";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import { FONT, MONO, useSiteLocale, useSiteTheme, type SiteTokens } from "@/components/site";

/** Focus / selection colour that stays visible on both surfaces (the navy
 *  accent alone disappears on charcoal). */
export const ringOf = (t: SiteTokens) => (t.dark ? t.accentText : t.accent);
const redSoftOf = (t: SiteTokens) => (t.dark ? "rgba(248,113,113,0.10)" : "rgba(192,39,45,0.07)");

/* ── page chrome ─────────────────────────────────────────────────────────── */

/** Focused auth page: slim header + a two-column body on desktop. `children`
 *  is the form column (first in the DOM, so its h1 leads); `aside` sits in
 *  the reading-start column on large screens and is hidden on phones. */
export function AuthPage({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  const t = useSiteTheme();
  const { t: tr } = useTranslate();
  const { isAr } = useSiteLocale();
  const home = isAr ? "/ar" : "/";
  return (
    <Box minH="100vh" bg={t.bg} color={t.fg} fontFamily={FONT} overflowX="clip" position="relative">
      <Box aria-hidden position="absolute" top={0} left={0} right={0} h="520px" bg={t.glow} opacity={0.6} pointerEvents="none" />
      <Box
        as="header"
        position="relative"
        maxW="1320px"
        mx="auto"
        px="clamp(16px, 4vw, 40px)"
        h="64px"
        display="flex"
        alignItems="center"
        gap="12px"
      >
        <Box as={NextLink} href={home} aria-label={tr("account.register.home")} display="flex" alignItems="center" flexShrink={0}>
          <TextLogo h={24} />
        </Box>
        <Box display="flex" alignItems="center" gap="8px" sx={{ marginInlineStart: "auto" }}>
          <LanguageSwitcher />
          <ColorModeToggle size={36} />
          <Box
            as={NextLink}
            href={home}
            aria-label={tr("account.register.close")}
            w="36px"
            h="36px"
            borderRadius="999px"
            border="1px solid"
            borderColor={t.border}
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
            color={t.fg}
            transition="border-color .15s ease"
            _hover={{ borderColor: t.fg }}
            _focusVisible={{ outline: `2px solid ${ringOf(t)}`, outlineOffset: "2px" }}
          >
            <FiX size={17} aria-hidden />
          </Box>
        </Box>
      </Box>
      <Box
        as="main"
        id="main"
        position="relative"
        maxW="1200px"
        mx="auto"
        px="clamp(16px, 5vw, 48px)"
        pt={{ base: "8px", lg: "24px" }}
        pb="64px"
        display="grid"
        gridTemplateColumns={{ base: "minmax(0,1fr)", lg: "minmax(0,1fr) minmax(0,480px)" }}
        columnGap="clamp(48px, 7vw, 112px)"
        alignItems="start"
      >
        <Box gridColumn={{ base: "1", lg: "2" }} gridRow="1" w="100%" maxW="480px" mx="auto" minW={0}>
          {children}
        </Box>
        {aside && (
          <Box
            display={{ base: "none", lg: "block" }}
            gridColumn="1"
            gridRow="1"
            position="sticky"
            top="32px"
            pt="40px"
            minW={0}
          >
            {aside}
          </Box>
        )}
      </Box>
    </Box>
  );
}

/* ── type ────────────────────────────────────────────────────────────────── */

export function AuthTitle({ children, ...rest }: BoxProps) {
  const t = useSiteTheme();
  const { isAr } = useSiteLocale();
  return (
    <Box
      as="h1"
      fontSize={{ base: "30px", md: "36px" }}
      fontWeight={600}
      letterSpacing={isAr ? 0 : "-0.035em"}
      lineHeight={isAr ? 1.3 : 1.1}
      color={t.fg}
      sx={{ textWrap: "balance" }}
      {...rest}
    >
      {children}
    </Box>
  );
}

export function AuthLead({ children, ...rest }: BoxProps) {
  const t = useSiteTheme();
  return (
    <Box as="p" mt="10px" fontSize="15.5px" lineHeight={1.6} color={t.fgMuted} style={{ textAlign: "start" }} {...rest}>
      {children}
    </Box>
  );
}

/* ── fields ──────────────────────────────────────────────────────────────── */

function FieldShell({
  id, label, floated, focused, error, right, children, hint,
}: {
  id: string; label: string; floated: boolean; focused: boolean; error?: string;
  right?: React.ReactNode; children: React.ReactNode; hint?: string;
}) {
  const t = useSiteTheme();
  const ring = ringOf(t);
  return (
    <Box w="100%">
      <Box
        position="relative"
        h="60px"
        borderRadius="14px"
        bg={t.bgRaised}
        border="1px solid"
        borderColor={error ? t.red : focused ? ring : "transparent"}
        boxShadow={focused ? `0 0 0 3px ${t.dark ? "rgba(155,168,183,0.22)" : "rgba(36,56,79,0.16)"}` : "none"}
        transition="border-color .15s ease, box-shadow .15s ease"
      >
        <Box
          as="label"
          htmlFor={id}
          position="absolute"
          top={floated ? "9px" : "50%"}
          transform={floated ? "none" : "translateY(-50%)"}
          fontSize={floated ? "12px" : "15px"}
          fontWeight={500}
          color={focused ? ring : t.fgMuted}
          pointerEvents="none"
          whiteSpace="nowrap"
          overflow="hidden"
          textOverflow="ellipsis"
          transition="all .15s ease"
          zIndex={1}
          style={{ insetInlineStart: "16px", insetInlineEnd: right ? "52px" : "16px" }}
        >
          {label}
        </Box>
        {children}
        {right && (
          <Box position="absolute" top="50%" transform="translateY(-50%)" zIndex={2} style={{ insetInlineEnd: "8px" }}>
            {right}
          </Box>
        )}
      </Box>
      {error && (
        <Box role="alert" mt="6px" px="4px" fontSize="12.5px" fontWeight={600} color={t.red}>
          {error}
        </Box>
      )}
      {hint && !error && (
        <Box mt="6px" px="4px" fontSize="12.5px" lineHeight={1.5} color={t.fgFaint}>
          {hint}
        </Box>
      )}
    </Box>
  );
}

const inputBase = {
  position: "absolute" as const,
  left: 0,
  right: 0,
  bottom: "2px",
  h: "36px",
  bg: "transparent",
  border: "none",
  outline: "none",
  borderRadius: 0,
  fontSize: "16px",
  fontWeight: 500,
  fontFamily: FONT,
};

/** Floating-label input. `ltr` keeps emails, handles, codes and passwords in
 *  left-to-right order while sitting under an Arabic label. */
export function AuthField({
  label, value, onChange, type = "text", error, right, autoComplete, ltr, hint, inputMode, maxLength, autoFocus, mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  error?: string;
  right?: React.ReactNode;
  autoComplete?: string;
  ltr?: boolean;
  hint?: string;
  inputMode?: "numeric" | "text" | "email" | "tel" | "url";
  maxLength?: number;
  autoFocus?: boolean;
  mono?: boolean;
}) {
  const t = useSiteTheme();
  const { isAr } = useSiteLocale();
  const id = useId();
  const [focused, setFocused] = useState(false);
  // Date inputs always show their own dd/mm/yyyy mask, so the label stays up.
  const floated = focused || value.length > 0 || type === "date";
  return (
    <FieldShell id={id} label={label} floated={floated} focused={focused} error={error} right={right} hint={hint}>
      <chakra.input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        autoFocus={autoFocus}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        dir={ltr ? "ltr" : undefined}
        {...inputBase}
        px="16px"
        color={t.fg}
        fontFamily={mono ? MONO : FONT}
        letterSpacing={mono ? "0.4em" : undefined}
        sx={{ colorScheme: t.dark ? "dark" : "light", paddingInlineEnd: right ? "52px" : "16px" }}
        style={{ textAlign: ltr && isAr ? "right" : undefined }}
      />
    </FieldShell>
  );
}

/** Floating-label native select with a chevron. */
export function AuthSelect({
  label, value, onChange, options, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  const t = useSiteTheme();
  const id = useId();
  const [focused, setFocused] = useState(false);
  const optStyle = { color: t.fg, backgroundColor: t.bgElev };
  return (
    <FieldShell
      id={id}
      label={label}
      floated
      focused={focused}
      right={<Box w="36px" h="36px" display="flex" alignItems="center" justifyContent="center" color={t.fgMuted} pointerEvents="none"><FiChevronDown size={17} aria-hidden /></Box>}
    >
      <chakra.select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...inputBase}
        px="16px"
        color={value ? t.fg : t.fgFaint}
        cursor="pointer"
        sx={{
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          colorScheme: t.dark ? "dark" : "light",
          paddingInlineEnd: "52px",
        }}
      >
        {placeholder !== undefined && <option value="" style={optStyle}>{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} style={optStyle}>{o.label}</option>
        ))}
      </chakra.select>
    </FieldShell>
  );
}

/** Phone number with the country's dial code in front (always LTR). */
export function AuthPhoneField({
  label, dialCode, value, onChange,
}: { label: string; dialCode: string; value: string; onChange: (v: string) => void }) {
  const t = useSiteTheme();
  const id = useId();
  const [focused, setFocused] = useState(false);
  return (
    <FieldShell id={id} label={label} floated focused={focused}>
      <Box position="absolute" left={0} right={0} bottom="2px" h="36px" display="flex" alignItems="center" px="16px" gap="8px" dir="ltr">
        <Box fontSize="16px" fontWeight={600} color={t.fgMuted} whiteSpace="nowrap" sx={{ fontVariantNumeric: "tabular-nums" }}>
          +{dialCode}
        </Box>
        <chakra.input
          id={id}
          type="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete="tel-national"
          inputMode="tel"
          flex="1"
          minW={0}
          h="36px"
          bg="transparent"
          border="none"
          outline="none"
          fontSize="16px"
          fontWeight={500}
          fontFamily={FONT}
          color={t.fg}
        />
      </Box>
    </FieldShell>
  );
}

/** Small round icon button that sits inside a field (e.g. show password). */
export function FieldIconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  const t = useSiteTheme();
  return (
    <chakra.button
      type="button"
      onClick={onClick}
      aria-label={label}
      w="44px"
      h="44px"
      borderRadius="999px"
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      color={t.fgMuted}
      _hover={{ color: t.fg }}
      _focusVisible={{ outline: `2px solid ${ringOf(t)}`, outlineOffset: "0px" }}
    >
      {children}
    </chakra.button>
  );
}

/* ── actions ─────────────────────────────────────────────────────────────── */

/** The one primary action — the app's ink pill, full width. */
export function AuthButton({
  label, onClick, type = "button", loading, disabled, mt = "28px", arrow = true,
}: { label: string; onClick?: () => void; type?: "button" | "submit"; loading?: boolean; disabled?: boolean; mt?: string; arrow?: boolean }) {
  const t = useSiteTheme();
  const { forward } = useSiteLocale();
  const off = disabled || loading;
  return (
    <chakra.button
      type={type}
      onClick={onClick}
      disabled={off}
      aria-busy={loading || undefined}
      mt={mt}
      w="100%"
      h="54px"
      borderRadius="999px"
      bg={t.fg}
      color={t.bg}
      fontFamily={FONT}
      fontSize="16px"
      fontWeight={600}
      display="flex"
      alignItems="center"
      justifyContent="center"
      gap="10px"
      cursor={off ? "not-allowed" : "pointer"}
      opacity={disabled ? 0.45 : loading ? 0.75 : 1}
      transition="opacity .15s ease, transform .15s ease"
      _hover={off ? undefined : { opacity: 0.88 }}
      _active={off ? undefined : { transform: "scale(0.985)" }}
      _focusVisible={{ outline: `2px solid ${ringOf(t)}`, outlineOffset: "3px" }}
    >
      {loading && <Spinner size="sm" thickness="2px" speed="0.8s" color={t.bg} />}
      <span>{label}</span>
      {!loading && arrow && <Box as="span" aria-hidden fontWeight={400}>{forward}</Box>}
    </chakra.button>
  );
}

/** Quiet text action under the primary button (Resend, Skip). */
export function QuietButton({ label, onClick, arrow }: { label: string; onClick: () => void; arrow?: boolean }) {
  const t = useSiteTheme();
  const { forward } = useSiteLocale();
  return (
    <Box display="flex" justifyContent="center" mt="10px">
      <chakra.button
        type="button"
        onClick={onClick}
        minH="44px"
        px="12px"
        borderRadius="999px"
        color={t.fgMuted}
        fontSize="14px"
        fontWeight={600}
        display="inline-flex"
        alignItems="center"
        gap="6px"
        _hover={{ color: t.fg }}
        _focusVisible={{ outline: `2px solid ${ringOf(t)}`, outlineOffset: "2px" }}
      >
        {label}
        {arrow && <span aria-hidden>{forward}</span>}
      </chakra.button>
    </Box>
  );
}

/* ── status ──────────────────────────────────────────────────────────────── */

/** Banner above the step. `info` is for confirmations (a code was resent). */
export function Notice({ tone, children }: { tone: "error" | "info"; children: React.ReactNode }) {
  const t = useSiteTheme();
  const error = tone === "error";
  return (
    <Box
      role={error ? "alert" : "status"}
      display="flex"
      alignItems="flex-start"
      gap="10px"
      p="12px 14px"
      mb="18px"
      borderRadius="14px"
      bg={error ? redSoftOf(t) : t.bgRaised}
      border="1px solid"
      borderColor={error ? (t.dark ? "rgba(248,113,113,0.24)" : "rgba(192,39,45,0.18)") : t.border}
      color={error ? t.red : t.fg}
      fontSize="14px"
      lineHeight={1.5}
    >
      <Box as="span" mt="2px" flexShrink={0} color={error ? t.red : t.green}>
        {error ? <FiAlertCircle size={16} aria-hidden /> : <FiCheckCircle size={16} aria-hidden />}
      </Box>
      <Box as="span" style={{ textAlign: "start" }}>{children}</Box>
    </Box>
  );
}

/** The app's pill-dot progress: done and current dots in the ring colour, the
 *  current one stretched; the step name and "n / total" beside it. */
export function StepDots({ step, total, label, name }: { step: number; total: number; label: string; name: string }) {
  const t = useSiteTheme();
  const ring = ringOf(t);
  return (
    <Box
      role="progressbar"
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={step}
      aria-valuetext={`${name} — ${step} / ${total}`}
      display="flex"
      alignItems="center"
      gap="12px"
      mb="26px"
    >
      <Box display="flex" alignItems="center" gap="6px" aria-hidden>
        {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
          <Box
            key={n}
            h="5px"
            w={n === step ? "22px" : "5px"}
            borderRadius="3px"
            bg={n <= step ? ring : t.divider}
            transition="width .25s ease, background-color .25s ease"
          />
        ))}
      </Box>
      <Box fontSize="13px" fontWeight={500} color={t.fgMuted} aria-hidden>
        {name}
      </Box>
      <Box fontSize="12px" color={t.fgFaint} sx={{ fontVariantNumeric: "tabular-nums", marginInlineStart: "auto" }} aria-hidden>
        {step} / {total}
      </Box>
    </Box>
  );
}

/** Two-option segmented control (Personal / Business). */
export function SegmentToggle<T extends string>({
  label, options, value, onChange,
}: { label: string; options: readonly { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const t = useSiteTheme();
  return (
    <Box role="radiogroup" aria-label={label} display="flex" gap="4px" p="4px" bg={t.bgRaised} borderRadius="999px">
      {options.map((o) => {
        const active = value === o.key;
        return (
          <chakra.button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.key)}
            flex="1"
            h="40px"
            borderRadius="999px"
            bg={active ? t.fg : "transparent"}
            color={active ? t.bg : t.fgMuted}
            fontSize="14px"
            fontWeight={600}
            transition="background-color .15s ease, color .15s ease"
            _hover={active ? undefined : { color: t.fg }}
            _focusVisible={{ outline: `2px solid ${ringOf(t)}`, outlineOffset: "2px" }}
          >
            {o.label}
          </chakra.button>
        );
      })}
    </Box>
  );
}

/** Consent checkbox. `text` marks the two links as [Terms] and [Privacy]. */
export function TermsConsent({
  checked, onChange, text, onOpenTerms, onOpenPrivacy, termsLabel, privacyLabel,
}: {
  checked: boolean; onChange: (v: boolean) => void; text: string;
  onOpenTerms: () => void; onOpenPrivacy: () => void;
  /** used only if a translation lost its [bracketed] link markers */
  termsLabel: string; privacyLabel: string;
}) {
  const t = useSiteTheme();
  const textId = useId();
  const parts = (text ?? "").split(/\[([^\]]+)\]/);
  const linkStyle = {
    color: t.fg,
    fontWeight: 600,
    textDecoration: "underline",
    textUnderlineOffset: "3px",
  } as const;
  const link = (label: string, onClick: () => void, key: string | number) => (
    <chakra.button
      key={key}
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      display="inline"
      p={0}
      fontSize="inherit"
      lineHeight="inherit"
      style={linkStyle}
      _focusVisible={{ outline: `2px solid ${ringOf(t)}`, outlineOffset: "2px", borderRadius: "4px" }}
    >
      {label}
    </chakra.button>
  );
  let linkIndex = 0;
  const body = parts.length >= 5
    ? parts.map((p, i) => (i % 2 ? link(p, linkIndex++ === 0 ? onOpenTerms : onOpenPrivacy, i) : p))
    : [text];
  return (
    <Box display="flex" alignItems="flex-start" gap="12px" mt="22px">
      <chakra.button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-labelledby={textId}
        onClick={() => onChange(!checked)}
        flexShrink={0}
        w="22px"
        h="22px"
        mt="1px"
        borderRadius="7px"
        border="1.5px solid"
        borderColor={checked ? t.fg : t.borderStrong}
        bg={checked ? t.fg : "transparent"}
        color={t.bg}
        display="inline-flex"
        alignItems="center"
        justifyContent="center"
        transition="background-color .15s ease, border-color .15s ease"
        position="relative"
        _before={{ content: '""', position: "absolute", inset: "-11px" }}
        _focusVisible={{ outline: `2px solid ${ringOf(t)}`, outlineOffset: "2px" }}
      >
        {checked && <FiCheck size={14} strokeWidth={3} aria-hidden />}
      </chakra.button>
      <Box as="p" id={textId} fontSize="13.5px" lineHeight={1.6} color={t.fgMuted} style={{ textAlign: "start" }}>
        {body}
        {parts.length < 5 && (
          <> {link(termsLabel, onOpenTerms, "t")} · {link(privacyLabel, onOpenPrivacy, "p")}</>
        )}
      </Box>
    </Box>
  );
}

/** Readable Terms / Privacy summary in a modal sheet. */
export function LegalSheet({
  open, onClose, title, updated, intro, sections, closeLabel,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  updated: string;
  intro: string;
  sections: { title: string; body: string }[];
  closeLabel: string;
}) {
  const t = useSiteTheme();
  return (
    <Modal isOpen={open} onClose={onClose} size="xl" scrollBehavior="inside" isCentered>
      <ModalOverlay bg="rgba(0,0,0,0.55)" />
      <ModalContent bg={t.bgElev} color={t.fg} borderRadius="24px" border="1px solid" borderColor={t.border} mx="16px" fontFamily={FONT}>
        <ModalHeader display="flex" alignItems="center" justifyContent="space-between" gap="12px" pt="24px" px="24px">
          <Box as="span" fontSize="20px" fontWeight={600} letterSpacing="-0.01em">{title}</Box>
          <chakra.button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            w="40px"
            h="40px"
            flexShrink={0}
            borderRadius="999px"
            border="1px solid"
            borderColor={t.border}
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
            color={t.fgMuted}
            _hover={{ color: t.fg, borderColor: t.fg }}
            _focusVisible={{ outline: `2px solid ${ringOf(t)}`, outlineOffset: "2px" }}
          >
            <FiX size={16} aria-hidden />
          </chakra.button>
        </ModalHeader>
        <ModalBody px="24px" pb="8px">
          <Box as="p" fontSize="12.5px" color={t.fgFaint} mb="12px" style={{ textAlign: "start" }}>{updated}</Box>
          {intro && <Box as="p" fontSize="14.5px" lineHeight={1.65} color={t.fgMuted} mb="20px" style={{ textAlign: "start" }}>{intro}</Box>}
          {sections.map((s, i) => (
            <Box key={i} py="14px" borderTop="1px solid" borderColor={t.border}>
              <Box fontSize="15px" fontWeight={600} color={t.fg} mb="6px">{s.title}</Box>
              <Box as="p" fontSize="14px" lineHeight={1.65} color={t.fgMuted} style={{ textAlign: "start" }}>{s.body}</Box>
            </Box>
          ))}
        </ModalBody>
        <ModalFooter px="24px" pb="24px">
          <AuthButton label={closeLabel} onClick={onClose} mt="0" arrow={false} />
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
