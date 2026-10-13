import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact tazdan",
  description:
    "Write to the tazdan team about support, business accounts, partnerships or press. Email support@tazdan.com or use the contact form.",
  openGraph: {
    title: "Contact tazdan",
    description:
      "Write to the tazdan team about support, business accounts, partnerships or press. Email support@tazdan.com or use the contact form.",
    url: "https://tazdan.com/contact",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Contact tazdan" }],
  },
  twitter: { card: "summary_large_image", title: "Contact tazdan", description: "Write to the tazdan team about support, business accounts, partnerships or press. Email support@tazdan.com or use the contact form.", images: ["/og-image.png"] },
  alternates: { canonical: "https://tazdan.com/contact" },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
