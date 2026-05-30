import { useState, useEffect } from "react";

export function useIsAr(): boolean {
  const [isAr, setIsAr] = useState(false);
  useEffect(() => {
    setIsAr(document.documentElement.lang === "ar");
    const observer = new MutationObserver(() => {
      setIsAr(document.documentElement.lang === "ar");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);
  return isAr;
}
