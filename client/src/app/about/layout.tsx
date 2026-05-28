import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Fortuni — Building the Financial Layer for MENA",
  description:
    "Learn how Fortuni is redefining money movement across Libya, Egypt, UAE and 120+ countries. Our mission, story, values and the team behind the platform.",
  keywords: [
    "about Fortuni",
    "Fortuni story",
    "MENA fintech",
    "Libya money transfer",
    "crypto remittance MENA",
    "Fortuni team",
    "fintech Libya",
    "crypto platform MENA",
  ],
  openGraph: {
    title: "About Fortuni — Building the Financial Layer for MENA",
    description:
      "Transparent reserves, regulated infrastructure, and a P2P marketplace built for the Middle East and North Africa.",
    url: "https://Fortuni.com/about",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "About Fortuni",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "About Fortuni",
    description:
      "Our mission: make global money movement as easy as sending a message.",
    images: ["/og-image.png"],
  },
  alternates: { canonical: "https://Fortuni.com/about" },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
