import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — tazdan",
  description: "What data tazdan collects, how we use it, who we share it with, and the rights you have over it.",
  openGraph: {
    title: "Privacy Policy — tazdan",
    description: "What data tazdan collects, how we use it, who we share it with, and the rights you have over it.",
    url: "https://tazdan.com/privacy",
  },
  alternates: { canonical: "https://tazdan.com/privacy" },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
