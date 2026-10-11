import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — tazdan",
  description: "The terms that govern your access to and use of the tazdan platform.",
  openGraph: {
    title: "Terms of Service — tazdan",
    description: "The terms that govern your access to and use of the tazdan platform.",
    url: "https://tazdan.com/terms",
  },
  alternates: { canonical: "https://tazdan.com/terms" },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
