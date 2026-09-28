// Reusable motion primitives. All timing is in frames relative to the current slide.
import React, { createContext, useContext, useMemo } from "react";
import { interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import type { Theme } from "../themes";
import { look, type Look } from "./look";

export const ThemeContext = createContext<Theme | null>(null);
export function useTheme(): Theme {
  const t = useContext(ThemeContext);
  if (!t) throw new Error("ThemeContext missing");
  return t;
}

export function useLook(): Look {
  const theme = useTheme();
  return useMemo(() => look(theme), [theme]);
}

/** Maps a deck asset path to a URL. The HTML exporter provides inlined data URIs. */
export const AssetContext = createContext<Record<string, string> | null>(null);
export function useAssetResolver(): (src: string) => string {
  const map = useContext(AssetContext);
  return (src) => {
    if (map?.[src]) return map[src];
    if (/^(https?:|data:|blob:)/.test(src)) return src;
    return staticFile(src.replace(/^\.?\/?(assets\/)?/, ""));
  };
}
export function useAsset(src: string): string {
  return useAssetResolver()(src);
}

/**
 * Snaps a spring to exactly 1 once it is visually at rest (within 0.05%, i.e. ≤0.02px of travel).
 *
 * Why: Remotion renders frames in several browser tabs in parallel. An element left with a residual
 * transform/filter (e.g. translateY(1e-15px)) stays on its own compositor layer, and each tab can
 * rasterize that layer slightly differently depending on what it rendered before — so settled text
 * "trembles" as consecutive frames alternate between tabs. Exact rest values let settled elements
 * drop their transform/filter entirely and render identically in every tab.
 */
export function settle(v: number): number {
  return Math.abs(1 - v) < 5e-4 ? 1 : v;
}

export function useSpring(delay = 0, config: { damping?: number; mass?: number; stiffness?: number } = {}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lk = useLook();
  // Minimal style ignores per-call springiness so every element settles calmly.
  const cfg = lk.minimal ? lk.motion.spring : { ...lk.motion.spring, ...config };
  return settle(spring({ frame: frame - delay, fps, config: cfg }));
}

type RevealFrom = "up" | "down" | "left" | "right" | "scale" | "blur" | "none";

/** Fades and moves children into place starting at `delay` frames. */
export const Reveal: React.FC<{
  delay?: number;
  from?: RevealFrom;
  distance?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ delay = 0, from = "up", distance = 40, style, children }) => {
  const p = useSpring(delay);
  const lk = useLook();
  const opacity = interpolate(p, [0, 0.6], [0, 1], { extrapolateRight: "clamp" });
  distance *= lk.motion.distance;
  if (from === "blur" && !lk.motion.blur) from = "up";
  if (from === "scale" && lk.minimal) from = "up";
  let transform = "";
  if (from === "up") transform = `translateY(${(1 - p) * distance}px)`;
  if (from === "down") transform = `translateY(${-(1 - p) * distance}px)`;
  if (from === "left") transform = `translateX(${-(1 - p) * distance}px)`;
  if (from === "right") transform = `translateX(${(1 - p) * distance}px)`;
  if (from === "scale") transform = `scale(${0.85 + 0.15 * p})`;
  const filter = from === "blur" ? `blur(${(1 - p) * 16}px)` : undefined;
  // Settled: no transform, filter or will-change, so the element renders as plain static content.
  if (p === 1) return <div style={style}>{children}</div>;
  return <div style={{ opacity, transform, filter, ...style }}>{children}</div>;
};

/** Reveals text word by word. */
export const WordReveal: React.FC<{
  text: string;
  delay?: number;
  stagger?: number;
  style?: React.CSSProperties;
  /** Applied to every word span (e.g. gradient text, which must live on the transformed element). */
  wordStyle?: React.CSSProperties;
}> = ({ text, delay = 0, stagger = 3, style, wordStyle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lk = useLook();
  const step = stagger * lk.motion.stagger;
  // Split on spaces; CJK text without spaces animates as short character groups.
  const tokens = /\s/.test(text.trim()) ? text.split(/(\s+)/) : (text.match(/.{1,4}/gu) ?? [text]);
  let wi = 0;
  return (
    <span style={style}>
      {tokens.map((tok, i) => {
        if (/^\s+$/.test(tok)) return <span key={i}>{tok}</span>;
        const p = settle(spring({ frame: frame - delay - wi++ * step, fps, config: lk.minimal ? lk.motion.spring : { damping: 20, stiffness: 120 } }));
        if (p === 1)
          return (
            <span key={i} style={{ display: "inline-block", ...wordStyle }}>
              {tok}
            </span>
          );
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: interpolate(p, [0, 0.7], [0, 1], { extrapolateRight: "clamp" }),
              transform: `translateY(${(1 - p) * 0.45 * lk.motion.distance}em)`,
              filter: lk.motion.blur ? `blur(${(1 - p) * 6}px)` : undefined,
              ...wordStyle,
            }}
          >
            {tok}
          </span>
        );
      })}
    </span>
  );
};

/** Horizontal accent line that draws itself. */
export const AccentLine: React.FC<{ delay?: number; width?: number; color?: string; height?: number }> = ({
  delay = 0,
  width = 120,
  color,
  height = 6,
}) => {
  const lk = useLook();
  const p = useSpring(delay, { damping: 30 });
  const h = Math.max(2, height * lk.rule);
  return (
    <div
      style={{
        width: width * p,
        height: h,
        borderRadius: lk.minimal ? 0 : h,
        background: color ?? lk.accentFill(90),
      }}
    />
  );
};

export function useCountUp(target: number, delay: number, durationFrames: number, decimals = 0): string {
  const frame = useCurrentFrame();
  const v = interpolate(frame - delay, [0, durationFrames], [0, target], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Scales a font size down for long strings so text stays inside its box. */
export function fitSize(text: string, base: number, comfortableChars: number, min = base * 0.5): number {
  const len = [...text].length;
  if (len <= comfortableChars) return base;
  return Math.max(min, base * Math.sqrt(comfortableChars / len));
}
