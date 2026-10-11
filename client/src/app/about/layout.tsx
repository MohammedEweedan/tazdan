import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About tazdan — An Arabic-first financial platform",
  description:
    "Learn how tazdan is redefining money movement across Libya, Egypt, UAE and 120+ countries. Our mission, story, values and the team behind the platform.",
  keywords: [
    "about tazdan",
    "tazdan story",
    "MENA fintech",
    "Libya money transfer",
    "crypto remittance MENA",
    "tazdan team",
    "fintech Libya",
    "crypto platform MENA",
  ],
  openGraph: {
    title: "About tazdan — An Arabic-first financial platform",
    description:
      "Transparent reserves, regulated infrastructure, and a P2P marketplace built for the Middle East and North Africa.",
    url: "https://tazdan.com/about",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "About tazdan",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "About tazdan",
    description:
      "Our mission: make global money movement as easy as sending a message.",
    images: ["/og-image.png"],
  },
  alternates: { canonical: "https://tazdan.com/about" },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
