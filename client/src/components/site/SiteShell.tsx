"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   SiteShell — every public page renders inside this: page surface, nav,
   <main>, footer and ONE shared waitlist modal (open it from anywhere with
   useWaitlist().open).
   ═══════════════════════════════════════════════════════════════════════════ */

import { createContext, useContext, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Box, useDisclosure } from "@chakra-ui/react";
const WaitlistModal = dynamic(() => import("@/components/ui/WaitlistModal"), { ssr: false });
import SiteNav from "./SiteNav";
import SiteFooter from "@/components/ui/LegacyPublicFooter";
import { FONT, useSiteTheme } from "./tokens";

type WaitlistApi = { open: () => void };
const WaitlistContext = createContext<WaitlistApi | null>(null);

/** Opens the shared waitlist modal. Outside a SiteShell it is a no-op. */
export function useWaitlist(): WaitlistApi {
  return useContext(WaitlistContext) ?? { open: () => {} };
}
export const useWaitlistContext = () => useContext(WaitlistContext);

export default function SiteShell({ children }: { children: React.ReactNode }) {
  const t = useSiteTheme();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [hasOpened, setHasOpened] = useState(false);
  const api = useMemo(() => ({ open: () => { setHasOpened(true); onOpen(); } }), [onOpen]);
  return (
    <WaitlistContext.Provider value={api}>
      <Box minH="100vh" bg={t.bg} color={t.fg} fontFamily={FONT} overflowX="clip">
        <SiteNav />
        <Box as="main" id="main">
          {children}
        </Box>
        <SiteFooter />
      </Box>
      {hasOpened && <WaitlistModal isOpen={isOpen} onClose={onClose} />}
    </WaitlistContext.Provider>
  );
}
