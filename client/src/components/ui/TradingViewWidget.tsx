"use client";

import { useEffect, useRef } from "react";
import { Box, useColorMode } from "@chakra-ui/react";

interface Props {
  symbol: string;
  containerId: string;
}

export default function TradingViewWidget({ symbol, containerId }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";

    const inner = document.createElement("div");
    inner.className = "tradingview-widget-container__widget";
    ref.current.appendChild(inner);

    const s = document.createElement("script");
    s.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js";
    s.async = true;
    s.innerHTML = JSON.stringify({
      symbols: [[symbol]],
      chartOnly: false,
      width: "100%",
      height: "100%",
      locale: "en",
      colorTheme: dark ? "dark" : "light",
      autosize: true,
      showVolume: false,
      hideDateRanges: false,
      hideMarketStatus: false,
      scalePosition: "right",
      scaleMode: "Normal",
      fontFamily: "Inter, sans-serif",
      fontSize: "10",
      noTimeScale: false,
      valuesTracking: "1",
      changeMode: "price-and-percent",
      chartType: "area",
      lineWidth: 2,
      lineType: 0,
      dateRanges: ["1d|1", "1w|15", "1m|30", "12m|1D"],
      isTransparent: true,
      backgroundColor: "rgba(0,0,0,0)",
      // Force the iframe bg via undocumented param
      ...(dark
        ? { paneProperties: { background: "#0d0d22", backgroundType: "solid" } }
        : {}),
    });
    ref.current.appendChild(s);

    // Inject bg fix into iframe after it loads
    const timer = setTimeout(() => {
      const iframe = ref.current?.querySelector("iframe");
      if (iframe) {
        try {
          const style = document.createElement("style");
          style.textContent = `
            body, .chart-container, .chart-page { background: transparent !important; }
            .tv-lightweight-charts { background: transparent !important; }
          `;
          iframe.contentDocument?.head?.appendChild(style);
        } catch {}
      }
    }, 2000);

    return () => {
      clearTimeout(timer);
      if (ref.current) ref.current.innerHTML = "";
    };
  }, [symbol, colorMode]);

  return (
    <Box position="relative" overflow="hidden">
      {/* Hard clip strips the TV logo from the bottom ~28px */}
      <Box
        ref={ref}
        id={containerId}
        className="tradingview-widget-container"
        h="298px"
        w="100%"
        sx={{
          // Clip logo row at bottom, compensate with negative margin
          clipPath: "inset(0 0 28px 0)",
          marginBottom: "-28px",
          // Force iframe to be transparent on dark mode
          "& iframe": {
            ...(dark
              ? {
                  filter: "none",
                  background: "transparent",
                }
              : {}),
          },
        }}
      />
      {/* Overlay that matches card bg to hide any iframe white edge */}
      {dark && (
        <Box
          position="absolute"
          bottom={0}
          left={0}
          right={0}
          h="30px"
          bg="rgba(13,13,34,1)"
          zIndex={2}
          pointerEvents="none"
        />
      )}
    </Box>
  );
}
