import type { DeckSpec } from "./spec";

export type Theme = {
  name: string;
  dark: boolean;
  style: "expressive" | "minimal";
  colors: {
    bg: string;
    bg2: string;
    surface: string;
    text: string;
    muted: string;
    accent: string;
    accent2: string;
  };
  fonts: { heading: string; body: string; mono: string };
  background: "orbs" | "grid" | "dots" | "gradient" | "solid";
};

export const PRESETS: Record<string, Theme> = {
  midnight: {
    name: "midnight",
    dark: true,
    style: "expressive",
    colors: { bg: "#0B1020", bg2: "#131A33", surface: "#1A2244", text: "#F4F6FF", muted: "#9AA3C7", accent: "#5EEAD4", accent2: "#A78BFA" },
    fonts: { heading: "Space Grotesk", body: "Inter", mono: "JetBrains Mono" },
    background: "orbs",
  },
  aurora: {
    name: "aurora",
    dark: true,
    style: "expressive",
    colors: { bg: "#070B14", bg2: "#0E1A24", surface: "#12222E", text: "#EAFBF6", muted: "#8DB3AA", accent: "#34D399", accent2: "#38BDF8" },
    fonts: { heading: "Outfit", body: "Inter", mono: "JetBrains Mono" },
    background: "gradient",
  },
  noir: {
    name: "noir",
    dark: true,
    style: "expressive",
    colors: { bg: "#0A0A0A", bg2: "#161616", surface: "#1F1F1F", text: "#FAFAFA", muted: "#A3A3A3", accent: "#F97316", accent2: "#FACC15" },
    fonts: { heading: "Inter", body: "Inter", mono: "JetBrains Mono" },
    background: "grid",
  },
  paper: {
    name: "paper",
    dark: false,
    style: "expressive",
    colors: { bg: "#F7F3EA", bg2: "#EFE8D8", surface: "#FFFFFF", text: "#1C1917", muted: "#6B645A", accent: "#E4572E", accent2: "#2E86AB" },
    fonts: { heading: "Playfair Display", body: "Inter", mono: "JetBrains Mono" },
    background: "dots",
  },
  corporate: {
    name: "corporate",
    dark: false,
    style: "minimal",
    colors: { bg: "#FFFFFF", bg2: "#F1F5F9", surface: "#F8FAFC", text: "#0F172A", muted: "#64748B", accent: "#2563EB", accent2: "#0EA5E9" },
    fonts: { heading: "Inter", body: "Inter", mono: "JetBrains Mono" },
    background: "solid",
  },
  minimal: {
    name: "minimal",
    dark: false,
    style: "minimal",
    colors: { bg: "#FAFAF8", bg2: "#F1F1EE", surface: "#FFFFFF", text: "#111111", muted: "#6E6E6A", accent: "#FF4D1C", accent2: "#A6A6A1" },
    fonts: { heading: "Geist", body: "Geist", mono: "Geist Mono" },
    background: "solid",
  },
  "minimal-dark": {
    name: "minimal-dark",
    dark: true,
    style: "minimal",
    colors: { bg: "#0C0C0D", bg2: "#131315", surface: "#18181B", text: "#F4F4F2", muted: "#8C8C88", accent: "#FF5A2B", accent2: "#5E5E5A" },
    fonts: { heading: "Geist", body: "Geist", mono: "Geist Mono" },
    background: "grid",
  },
  swiss: {
    name: "swiss",
    dark: false,
    style: "minimal",
    colors: { bg: "#FFFFFF", bg2: "#F4F4F4", surface: "#F7F7F7", text: "#0A0A0A", muted: "#707070", accent: "#E30613", accent2: "#0A0A0A" },
    fonts: { heading: "Manrope", body: "Inter", mono: "JetBrains Mono" },
    background: "solid",
  },
};

export function resolveTheme(deck: Pick<DeckSpec, "theme">): Theme {
  const t = deck.theme;
  const base = PRESETS[t.preset] ?? PRESETS.midnight;
  return {
    ...base,
    style: t.style ?? base.style,
    colors: { ...base.colors, ...(t.colors ?? {}) },
    fonts: { ...base.fonts, ...(t.fonts ?? {}) },
    background: t.background ?? base.background,
  };
}

/** Fallback stack appended to every font so CJK and other scripts render with system fonts. */
export const FALLBACK_STACK =
  '"Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", "Noto Sans CJK KR", "Malgun Gothic", "Hiragino Sans", "Noto Sans JP", "PingFang SC", system-ui, sans-serif';

export function fontStack(family: string): string {
  return `"${family}", ${FALLBACK_STACK}`;
}

/** Hex color with alpha, e.g. alpha("#ff0000", 0.5). */
export function alpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
