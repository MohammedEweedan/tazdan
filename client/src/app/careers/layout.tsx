import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Careers at tazdan",
  description:
    "Join a small team building a Libya-first money app. Open roles in engineering, product, compliance, support and growth.",
  openGraph: {
    title: "Careers at tazdan",
    description:
      "Join a small team building a Libya-first money app. Open roles in engineering, product, compliance, support and growth.",
    url: "https://tazdan.com/careers",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Careers at tazdan" }],
  },
  twitter: { card: "summary_large_image", title: "Careers at tazdan", description: "Join a small team building a Libya-first money app. Open roles in engineering, product, compliance, support and growth.", images: ["/og-image.png"] },
  alternates: { canonical: "https://tazdan.com/careers" },
};

export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
