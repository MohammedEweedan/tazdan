"use client";

/* Page-level CSS that only legal documents mount: smooth in-page anchors
   (when motion is welcome) and a clean print / "save as PDF" layout — black
   on white, no nav, footer, contents or buttons, one column, links spelled
   out. */

import { Global } from "@emotion/react";

const CSS = `
@media (prefers-reduced-motion: no-preference) {
  html { scroll-behavior: smooth; }
}

@media print {
  @page { margin: 16mm 18mm; }
  html, body { background: #fff !important; }
  body * { background: transparent !important; box-shadow: none !important; text-shadow: none !important; }
  nav, footer, a[href="#main"], [data-legal-noprint] { display: none !important; }

  [data-legal-doc] * { color: #000 !important; border-color: #c9c9c9 !important; }
  [data-legal-doc] [data-legal-hero] header { min-height: 0 !important; padding: 0 0 14pt !important; align-items: flex-start !important; }
  [data-legal-doc] [data-legal-hero] header > div { align-items: flex-start !important; text-align: start !important; padding: 0 !important; }
  [data-legal-doc] [data-legal-hero] header > div[aria-hidden] { display: none !important; }
  [data-legal-doc] .media-hero-step { opacity: 1 !important; transform: none !important; animation: none !important; }
  [data-legal-doc] [data-legal-body] { padding: 14pt 0 0 !important; border: none !important; }
  [data-legal-doc] [data-legal-grid] { display: block !important; }
  [data-legal-doc] [data-legal-content] { max-width: none !important; font-size: 10.5pt !important; }
  [data-legal-doc] h1 { font-size: 24pt !important; line-height: 1.15 !important; }
  [data-legal-doc] h2 { font-size: 13.5pt !important; break-after: avoid; page-break-after: avoid; }
  [data-legal-doc] [data-legal-section] { margin-top: 12pt !important; padding-top: 12pt !important; }
  [data-legal-doc] p, [data-legal-doc] li { orphans: 3; widows: 3; }
  [data-legal-doc] a { text-decoration: underline !important; }
  [data-legal-doc] a[href^="http"]::after { content: " (" attr(href) ")"; font-size: 0.85em; }
}
`;

export default function LegalPageStyles() {
  return <Global styles={CSS} />;
}
