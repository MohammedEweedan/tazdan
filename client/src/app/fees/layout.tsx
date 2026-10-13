import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "tazdan fees — know the cost before you confirm",
  description:
    "Sending to other tazdan users is free. See the current fee settings, how our rate margin works and a send-abroad cost calculator. Pre-launch; final fees are published before launch.",
  openGraph: {
    title: "tazdan fees — know the cost before you confirm",
    description:
      "Sending to other tazdan users is free. See the current fee settings, how our rate margin works and a send-abroad cost calculator. Pre-launch; final fees are published before launch.",
    url: "https://tazdan.com/fees",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "tazdan fees — know the cost before you confirm" }],
  },
  twitter: { card: "summary_large_image", title: "tazdan fees — know the cost before you confirm", description: "Sending to other tazdan users is free. See the current fee settings, how our rate margin works and a send-abroad cost calculator. Pre-launch; final fees are published before launch.", images: ["/og-image.png"] },
  alternates: { canonical: "https://tazdan.com/fees" },
};

export default function FeesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
