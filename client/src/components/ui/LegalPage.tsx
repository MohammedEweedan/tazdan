"use client";

import { SiteShell } from "@/components/site";
import LegalDocument, { type LegalSectionData } from "@/components/pages/legal/LegalDocument";

export interface LegalSection {
  title: string;
  body: string;
}

interface LegalPageProps {
  eyebrow: string;
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

export default function LegalPage({ eyebrow, title, updated, intro, sections }: LegalPageProps) {
  const legalSections: LegalSectionData[] = sections.map(({ title, body }, i) => ({
    id: `section-${i + 1}`, title, body,
  }));
  return <SiteShell><LegalDocument eyebrow={eyebrow} title={title} updated={updated} intro={intro} sections={legalSections} /></SiteShell>;
}
