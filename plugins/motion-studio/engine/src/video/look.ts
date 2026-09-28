// Style tokens: how accents, cards, numbers and motion look in "expressive" vs "minimal" style.
// Layouts ask these helpers instead of hardcoding gradients, so one theme switch restyles everything.
import type React from "react";
import { alpha, type Theme } from "../themes";

export type Look = ReturnType<typeof look>;

export function look(theme: Theme) {
  const c = theme.colors;
  const minimal = theme.style === "minimal";
  return {
    minimal,
    /** Fill for accent bars, markers, buttons, progress lines. */
    accentFill: (angle = 90) => (minimal ? c.accent : `linear-gradient(${angle}deg, ${c.accent}, ${c.accent2})`),
    /** Style for hero words/numbers. Applied per word because gradients must live on the transformed element. */
    heroText: (base: string = c.text): React.CSSProperties =>
      minimal
        ? { color: base }
        : {
            backgroundImage: `linear-gradient(120deg, ${base} 20%, ${c.accent} 75%, ${c.accent2})`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            paddingBottom: "0.08em",
          },
    /** Big numbers (stat, big-number). */
    numberText: (): React.CSSProperties =>
      minimal
        ? { color: c.text }
        : {
            backgroundImage: `linear-gradient(135deg, ${c.accent}, ${c.accent2})`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          },
    /** Container card. `edge` picks which accent tints the border in expressive style. */
    card: (u: (n: number) => number, edge: "accent" | "accent2" | "none" = "accent"): React.CSSProperties =>
      minimal
        ? {
            background: "transparent",
            borderTop: `${u(2)}px solid ${edge === "none" ? alpha(c.text, 0.14) : edge === "accent" ? c.accent : alpha(c.text, 0.85)}`,
            borderRadius: 0,
          }
        : {
            background: alpha(c.surface, theme.dark ? 0.55 : 0.9),
            border: `${u(2)}px solid ${edge === "none" ? alpha(c.text, 0.12) : alpha(edge === "accent" ? c.accent : c.accent2, 0.28)}`,
            borderRadius: u(28),
          },
    /** Horizontal padding inside cards (minimal cards sit flush with the grid). */
    cardPad: (u: (n: number) => number) => (minimal ? `${u(34)}px 0 0` : `${u(50)}px ${u(44)}px`),
    radius: (u: (n: number) => number, n = 24) => (minimal ? u(Math.min(6, n)) : u(n)),
    /** Accent rule thickness multiplier. */
    rule: minimal ? 0.45 : 1,
    glow: !minimal,
    /** Motion character: minimal is calmer (no blur, shorter travel, no overshoot). */
    motion: minimal
      ? { spring: { damping: 30, mass: 1, stiffness: 120 }, distance: 0.5, blur: 0, stagger: 0.75 }
      : { spring: { damping: 18, mass: 0.9, stiffness: 110 }, distance: 1, blur: 1, stagger: 1 },
    /** Title slides: minimal aligns left like editorial layouts. */
    titleAlign: (minimal ? "left" : "center") as "left" | "center",
  };
}
