"use client";

/* Reading primitives for legal documents: paragraphs at a comfortable measure,
   inline links (emails and the /fees page are linked automatically, the
   wording itself is never changed), a bullet list and a warning note. */

import { Fragment } from "react";
import NextLink from "next/link";
import { Box, VisuallyHidden, type BoxProps } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { FiAlertTriangle } from "react-icons/fi";
import { useSiteLocale, useSiteTheme } from "@/components/site";

/** dir="auto" lets a stray Arabic block read RTL on an English page (the
 *  bilingual delete-account page). On Arabic pages we leave direction to the
 *  page, so a Latin-only label such as "Memecoins" still sits on the right. */
export function useAutoDir(): "auto" | undefined {
  return useSiteLocale().isAr ? undefined : "auto";
}

/** Inline link inside legal copy — accent text, underlined, LTR-isolated. */
export function InlineLink({
  href, children, external,
}: { href: string; children: React.ReactNode; external?: boolean }) {
  const t = useSiteTheme();
  const { t: tr } = useTranslate();
  const internal = href.startsWith("/") && !external;
  return (
    <Box
      as={internal ? NextLink : "a"}
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      color={t.accentText}
      fontWeight={500}
      textDecoration="underline"
      textDecorationColor={t.accentBorder}
      textUnderlineOffset="3px"
      transition="text-decoration-color .15s ease"
      _hover={{ textDecorationColor: t.accentText }}
      _focusVisible={{ outline: `2px solid ${t.accent}`, outlineOffset: "2px", borderRadius: "3px" }}
      sx={{ overflowWrap: "anywhere" }}
    >
      {children}
      {external && <VisuallyHidden> {tr("legal.link.newTab")}</VisuallyHidden>}
    </Box>
  );
}

// Email addresses and the fees page path, as they appear in the approved copy.
const TOKEN = /([A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+|\/fees\b)/g;

/** Renders a translated string with its emails / site paths as links. */
export function Linkify({ text }: { text: string }) {
  const parts = (text ?? "").split(TOKEN);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
        const href = part.startsWith("/") ? part : `mailto:${part}`;
        return (
          <bdi key={i} dir="ltr">
            <InlineLink href={href}>{part}</InlineLink>
          </bdi>
        );
      })}
    </>
  );
}

/** Body paragraph of a legal document. Strings are linkified. */
export function LegalParagraph({ children, ...rest }: BoxProps) {
  const t = useSiteTheme();
  const dir = useAutoDir();
  return (
    <Box
      as="p"
      dir={dir}
      color={t.fgMuted}
      fontSize="1em"
      lineHeight={1.78}
      style={{ textAlign: "start" }}
      sx={{ textWrap: "pretty", "& + &": { marginTop: "1em" } }}
      {...rest}
    >
      {typeof children === "string" ? <Linkify text={children} /> : children}
    </Box>
  );
}

/** Bulleted list with small round dots (logical spacing, flips in RTL). */
export function LegalList({ items, ...rest }: { items: React.ReactNode[] } & BoxProps) {
  const t = useSiteTheme();
  const dir = useAutoDir();
  return (
    <Box as="ul" listStyleType="none" m={0} p={0} display="grid" gap="8px" {...rest}>
      {items.map((item, i) => (
        <Box as="li" key={i} display="flex" alignItems="flex-start" gap="12px" color={t.fgMuted} lineHeight={1.7}>
          <Box as="span" aria-hidden w="5px" h="5px" minW="5px" mt="0.72em" borderRadius="999px" bg={t.fgFaint} />
          <Box as="span" dir={dir} minW={0}>
            {item}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

/** A regulatory warning: amber rule on the reading-start side, no box. */
export function LegalNotice({ children, ...rest }: BoxProps) {
  const t = useSiteTheme();
  const dir = useAutoDir();
  return (
    <Box
      role="note"
      display="flex"
      alignItems="flex-start"
      gap="14px"
      py="4px"
      sx={{ paddingInlineStart: "18px", borderInlineStart: `2px solid ${t.amber}` }}
      {...rest}
    >
      <Box as="span" color={t.amber} mt="4px" flexShrink={0} aria-hidden>
        <FiAlertTriangle size={17} />
      </Box>
      <Box
        as="p"
        dir={dir}
        color={t.fg}
        fontSize={{ base: "15px", md: "16px" }}
        fontWeight={500}
        lineHeight={1.6}
        style={{ textAlign: "start" }}
        sx={{ textWrap: "pretty" }}
      >
        {children}
      </Box>
    </Box>
  );
}
