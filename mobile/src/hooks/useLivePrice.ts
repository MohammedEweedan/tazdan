import { Currency } from "@/types";
import { useEffect, useState } from "react";

// hooks/useLivePrice.ts
export function useLivePrice(sym: Currency) {
  const [price, setPrice] = useState<number | null>(null);

  useEffect(() => {
    const ws = new WebSocket(
      `wss://stream.binance.com:9443/ws/${sym.toLowerCase()}usdt@miniTicker`
    );
    ws.onerror = () => ws.close(); // silently fail — price falls back to REST poll
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      setPrice(parseFloat(d.c)); // 'c' = close/last price
    };
    return () => ws.close();
  }, [sym]);

  return price;
}