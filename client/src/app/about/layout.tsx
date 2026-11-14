import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About tazdan — built for the markets the banks left behind",
  description:
    "tazdan is a pre-launch, Libya-first money app: dinars, dollars and digital assets in one account at the real rate. Our story, what we believe, how we build and where we are.",
  openGraph: {
    title: "About tazdan — built for the markets the banks left behind",
    description:
      "tazdan is a pre-launch, Libya-first money app: dinars, dollars and digital assets in one account at the real rate. Our story, what we believe, how we build and where we are.",
    url: "https://tazdan.com/about",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "About tazdan — built for the markets the banks left behind" }],
  },
  twitter: { card: "summary_large_image", title: "About tazdan — built for the markets the banks left behind", description: "tazdan is a pre-launch, Libya-first money app: dinars, dollars and digital assets in one account at the real rate. Our story, what we believe, how we build and where we are.", images: ["/og-image.png"] },
  alternates: { canonical: "https://tazdan.com/about" },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
