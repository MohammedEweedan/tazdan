export function publicPageTheme(dark: boolean) {
  return {
    pageBg: dark ? "#16181C" : "#ffffff",
    textMain: dark ? "#F4F5F7" : "#0A0A0B",
    textSub: dark ? "rgba(244,245,247,0.62)" : "rgba(10,10,11,0.62)",
    textFaint: dark ? "rgba(244,245,247,0.38)" : "rgba(10,10,11,0.38)",
    cardBg: dark ? "rgba(255,255,255,0.04)" : "rgba(10,10,11,0.026)",
    cardBgHover: dark ? "rgba(255,255,255,0.065)" : "rgba(10,10,11,0.045)",
    raisedBg: dark ? "rgba(255,255,255,0.055)" : "#F8FAFC",
    raisedAlt: dark ? "rgba(255,255,255,0.04)" : "#FFFFFF",
    inputBg: dark ? "rgba(255,255,255,0.055)" : "rgba(10,10,11,0.045)",
    cardBorder: dark ? "rgba(255,255,255,0.10)" : "rgba(10,10,11,0.09)",
    rowBorder: dark ? "rgba(255,255,255,0.075)" : "rgba(10,10,11,0.07)",
    strongBorder: dark ? "rgba(255,255,255,0.18)" : "rgba(10,10,11,0.16)",
    accent: "#63A1DB",
    accentText: dark ? "#8BBCE8" : "#3E78AE",
    accentSoft: dark ? "rgba(99,161,219,0.16)" : "rgba(79,139,196,0.12)",
    accentBorder: dark ? "rgba(99,161,219,0.36)" : "rgba(79,139,196,0.30)",
    green: dark ? "#3FCF8E" : "#1F8F58",
    greenSoft: dark ? "rgba(63,207,142,0.14)" : "rgba(31,143,88,0.10)",
    shadow: dark ? "0 22px 70px rgba(0,0,0,0.28)" : "0 22px 62px rgba(10,10,11,0.06)",
    titleGradient: dark
      ? "linear(to-b, #ffffff 0%, rgba(244,245,247,0.88) 58%, rgba(244,245,247,0.34) 100%)"
      : "linear(to-b, #0A0A0B 0%, rgba(10,10,11,0.78) 58%, rgba(10,10,11,0.30) 100%)",
  };
}

export const publicPageEase = [0.22, 1, 0.36, 1] as const;
