"use client";

/* Tabbed code block for the /business developer section. Code is always LTR,
   mono and scrolls sideways inside its own box — never the page. A tiny
   line-by-line highlighter keeps it calm: keys ink, strings accent, comments
   and punctuation faint. */

import { useState } from "react";
import { Box } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { FiCheck, FiCopy } from "react-icons/fi";
import { Footnote, MONO, useSiteTheme, type SiteTokens } from "@/components/site";
import { PAYOUT_REQUEST, PAYOUT_RESPONSE, WEBHOOK_VERIFY } from "./codeSamples";

/** The Chakra theme forces Cairo with !important on every element under
 *  html[dir=rtl] / html[lang=ar]; this out-specifies it so code stays mono. */
export const MONO_SX = {
  fontFamily: MONO,
  "html[dir='rtl'] &, html[lang='ar'] &, html[dir='rtl'] & *, html[lang='ar'] & *": { fontFamily: `${MONO} !important` },
};

const TOKEN = /("(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|(\/\/.*$)|(\b(?:import|from|export|function|const|return|if|curl)\b)|(\b\d+(?:\.\d+)?\b)|(\$[A-Z_]+)/g;

function highlight(line: string, t: SiteTokens, key: number) {
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index));
    const [text, str, comment, keyword, num, env] = m;
    let color = t.fgMuted;
    let weight: number | undefined;
    if (str) color = /^\s*:/.test(line.slice(m.index + text.length)) ? t.fg : t.accentText;
    else if (comment) color = t.fgFaint;
    else if (keyword) { color = t.fg; weight = 600; }
    else if (num) color = t.fg;
    else if (env) color = t.accentText;
    out.push(<span key={m.index} style={{ color, fontWeight: weight }}>{text}</span>);
    last = m.index + text.length;
    if (text.length === 0) TOKEN.lastIndex++;
  }
  if (last < line.length) out.push(line.slice(last));
  return <span key={key}>{out}{"\n"}</span>;
}

const TABS = [
  { id: "request", label: "business.dev.tab.request", caption: "business.dev.caption.request", code: PAYOUT_REQUEST, bar: "POST /api/v1/payouts" },
  { id: "response", label: "business.dev.tab.response", caption: "business.dev.caption.response", code: PAYOUT_RESPONSE, bar: "201 Created · application/json" },
  { id: "webhook", label: "business.dev.tab.webhook", caption: "business.dev.caption.webhook", code: WEBHOOK_VERIFY, bar: "Node.js · Tazdan-Signature: t=…,v1=…" },
] as const;

export default function CodeSample() {
  const { t: tr } = useTranslate();
  const t = useSiteTheme();
  const [tab, setTab] = useState(0);
  const [copied, setCopied] = useState(false);
  const cur = TABS[tab];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cur.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked — nothing to do */ }
  };

  return (
    <Box minW={0}>
      <Box display="flex" gap="6px" flexWrap="wrap" role="tablist" aria-label={tr("business.dev.tabs")}>
        {TABS.map((x, i) => {
          const on = i === tab;
          return (
            <Box
              key={x.id}
              as="button"
              type="button"
              role="tab"
              id={`biz-code-tab-${x.id}`}
              aria-selected={on}
              aria-controls="biz-code-panel"
              onClick={() => { setTab(i); setCopied(false); }}
              minH="44px"
              px="16px"
              borderRadius="999px"
              border="1px solid"
              borderColor={on ? t.accentBorder : t.border}
              bg={on ? t.accentSoft : "transparent"}
              color={on ? t.accentText : t.fgMuted}
              fontSize="14.5px"
              fontWeight={on ? 600 : 500}
              transition="background-color .16s ease, color .16s ease, border-color .16s ease"
              _hover={on ? undefined : { color: t.fg, borderColor: t.borderStrong }}
              _focusVisible={{ outline: `2px solid ${t.accent}`, outlineOffset: "2px" }}
            >
              {tr(x.label)}
            </Box>
          );
        })}
      </Box>

      <Box
        id="biz-code-panel"
        role="tabpanel"
        aria-labelledby={`biz-code-tab-${cur.id}`}
        mt="16px"
        bg={t.bgElev}
        border="1px solid"
        borderColor={t.border}
        borderRadius="18px"
        overflow="hidden"
        minW={0}
      >
        <Box
          dir="ltr"
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          gap="12px"
          px="18px"
          minH="48px"
          borderBottom="1px solid"
          borderColor={t.border}
        >
          <Box fontFamily={MONO} sx={MONO_SX} fontSize="12.5px" color={t.fgFaint} whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis" minW={0}>
            {cur.bar}
          </Box>
          <Box
            as="button"
            type="button"
            onClick={copy}
            display="inline-flex"
            alignItems="center"
            gap="6px"
            minH="40px"
            px="10px"
            borderRadius="999px"
            color={copied ? t.green : t.accentText}
            fontFamily="inherit"
            fontSize="13.5px"
            fontWeight={600}
            flexShrink={0}
            _hover={{ bg: t.bgRaised }}
            _focusVisible={{ outline: `2px solid ${t.accent}`, outlineOffset: "2px" }}
          >
            {copied ? <FiCheck aria-hidden /> : <FiCopy aria-hidden />}
            <span aria-live="polite">{tr(copied ? "business.dev.copied" : "business.dev.copy")}</span>
          </Box>
        </Box>
        <Box
          as="pre"
          dir="ltr"
          tabIndex={0}
          aria-label={tr(cur.label)}
          m={0}
          p="clamp(16px, 2.6vw, 26px)"
          overflowX="auto"
          fontFamily={MONO}
          fontSize={{ base: "12px", md: "13px" }}
          lineHeight={1.7}
          color={t.fgMuted}
          whiteSpace="pre"
          textAlign="left"
          sx={{ ...MONO_SX, tabSize: 2, WebkitOverflowScrolling: "touch" }}
          _focusVisible={{ outline: `2px solid ${t.accent}`, outlineOffset: "-2px" }}
        >
          <code>{cur.code.split("\n").map((line, i) => highlight(line, t, i))}</code>
        </Box>
      </Box>
      <Footnote mt="14px" maxW="68ch">{tr(cur.caption)}</Footnote>
    </Box>
  );
}
