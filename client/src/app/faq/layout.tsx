import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Help & FAQ — tazdan",
  description:
    "Straight answers about tazdan: getting started, verification, moving money, send abroad, P2P, savings, cards, business, security, fees and availability.",
  openGraph: {
    title: "Help & FAQ — tazdan",
    description:
      "Straight answers about tazdan: getting started, verification, moving money, send abroad, P2P, savings, cards, business, security, fees and availability.",
    url: "https://tazdan.com/faq",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Help & FAQ — tazdan" }],
  },
  twitter: { card: "summary_large_image", title: "Help & FAQ — tazdan", description: "Straight answers about tazdan: getting started, verification, moving money, send abroad, P2P, savings, cards, business, security, fees and availability.", images: ["/og-image.png"] },
  alternates: { canonical: "https://tazdan.com/faq" },
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
