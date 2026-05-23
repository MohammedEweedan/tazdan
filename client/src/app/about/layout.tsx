import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About fortuni — Building the Financial Layer for MENA",
  description:
    "Learn how fortuni is redefining money movement across Libya, Egypt, UAE and 120+ countries. Our mission, story, values and the team behind the platform.",
  keywords: [
    "about fortuni",
    "fortuni story",
    "MENA fintech",
    "Libya money transfer",
    "crypto remittance MENA",
    "fortuni team",
    "fintech Libya",
    "crypto platform MENA",
  ],
  openGraph: {
    title: "About fortuni — Building the Financial Layer for MENA",
    description:
      "Transparent reserves, regulated infrastructure, and a P2P marketplace built for the Middle East and North Africa.",
    url: "https://fortuni.com/about",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "About fortuni",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "About fortuni",
    description:
      "Our mission: make global money movement as easy as sending a message.",
    images: ["/og-image.png"],
  },
  alternates: { canonical: "https://fortuni.com/about" },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
