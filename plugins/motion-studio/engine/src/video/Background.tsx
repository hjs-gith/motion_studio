import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { alpha, type Theme } from "../themes";
import { useTheme } from "./anim";

/** Pixel-size helper: layouts are designed on a 1920x1080 grid and scaled to the output. */
export function useU() {
  const { width, height } = useVideoConfig();
  const s = Math.min(width / 1920, height / 1080);
  return (n: number) => n * s;
}

export const Background: React.FC<{ kind?: Theme["background"]; frameOffset?: number }> = ({ kind, frameOffset = 0 }) => {
  const theme = useTheme();
  const minimal = theme.style === "minimal";
  // Minimal style keeps backgrounds quiet: no glow over patterns, fainter lines, softer orbs.
  const soft = minimal ? 0.45 : 1;
  const frame = useCurrentFrame() + frameOffset;
  const { width, height } = useVideoConfig();
  const c = theme.colors;
  const k = kind ?? theme.background;
  const t = frame / 30;

  const base = <AbsoluteFill style={{ background: `linear-gradient(160deg, ${c.bg} 0%, ${c.bg2} 100%)` }} />;
  if (k === "solid") return <AbsoluteFill style={{ background: c.bg }} />;

  if (k === "gradient") {
    const a = 140 + Math.sin(t * 0.25) * 25;
    return (
      <AbsoluteFill
        style={{
          background: `linear-gradient(${a}deg, ${c.bg} 0%, ${c.bg2} 45%, ${alpha(c.accent, theme.dark ? 0.22 : 0.12)} 100%)`,
        }}
      >
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at ${50 + Math.sin(t * 0.2) * 30}% ${40 + Math.cos(t * 0.17) * 25}%, ${alpha(
              c.accent2,
              theme.dark ? 0.25 : 0.12,
            )}, transparent 55%)`,
          }}
        />
      </AbsoluteFill>
    );
  }

  if (k === "grid" || k === "dots") {
    const size = Math.round(Math.min(width, height) / 18);
    const shift = (t * 8) % size;
    const line = alpha(c.text, (theme.dark ? 0.06 : 0.08) * (minimal ? 0.7 : 1));
    const pattern =
      k === "grid"
        ? `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`
        : `radial-gradient(${alpha(c.text, (theme.dark ? 0.14 : 0.16) * (minimal ? 0.7 : 1))} 1.5px, transparent 1.5px)`;
    return (
      <AbsoluteFill>
        {base}
        <AbsoluteFill
          style={{
            backgroundImage: pattern,
            backgroundSize: `${size}px ${size}px`,
            backgroundPosition: `${shift}px ${shift}px`,
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
          }}
        />
        {minimal ? null : <Orb color={c.accent} x={0.85 + Math.sin(t * 0.3) * 0.05} y={0.15} r={0.35} a={theme.dark ? 0.18 : 0.1} />}
      </AbsoluteFill>
    );
  }

  // orbs
  return (
    <AbsoluteFill>
      {base}
      <Orb color={c.accent} x={0.18 + Math.sin(t * 0.21) * 0.08} y={0.25 + Math.cos(t * 0.17) * 0.08} r={0.45} a={(theme.dark ? 0.28 : 0.14) * soft} />
      <Orb color={c.accent2} x={0.82 + Math.cos(t * 0.19) * 0.07} y={0.75 + Math.sin(t * 0.23) * 0.08} r={0.5} a={(theme.dark ? 0.26 : 0.12) * soft} />
      <Orb color={c.accent2} x={0.6 + Math.sin(t * 0.13) * 0.1} y={0.1 + Math.cos(t * 0.11) * 0.05} r={0.25} a={(theme.dark ? 0.12 : 0.06) * soft} />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, transparent 40%, ${alpha(c.bg, 0.6)} 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

const Orb: React.FC<{ color: string; x: number; y: number; r: number; a: number }> = ({ color, x, y, r, a }) => {
  const { width, height } = useVideoConfig();
  const d = Math.max(width, height) * r;
  return (
    <div
      style={{
        position: "absolute",
        left: width * x - d / 2,
        top: height * y - d / 2,
        width: d,
        height: d,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${alpha(color, a)} 0%, transparent 70%)`,
        filter: `blur(${d * 0.08}px)`,
      }}
    />
  );
};
