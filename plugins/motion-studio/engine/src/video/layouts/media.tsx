import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { bulletText, type ColumnSpec, type SlideSpec } from "../../spec";
import { alpha, fontStack } from "../../themes";
import { Reveal, WordReveal, fitSize, useAsset, useAssetResolver, useLook, useSpring, useTheme } from "../anim";
import { useU } from "../Background";
import { Heading, Stage } from "./common";

type Of<L extends SlideSpec["layout"]> = Extract<SlideSpec, { layout: L }>;

export const ImageSlide: React.FC<{ slide: Of<"image"> }> = ({ slide }) => {
  const u = useU();
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  // loadProject always resolves src (generated image or placeholder) before rendering.
  const src = useAsset(slide.src ?? "");
  const zoom = slide.kenBurns ? interpolate(frame, [0, durationInFrames], [1.0, 1.12]) : 1;
  const pan = slide.kenBurns ? interpolate(frame, [0, durationInFrames], [0, -2]) : 0;
  const p = useSpring(0, { damping: 30 });
  const contain = slide.fit === "contain";
  return (
    <AbsoluteFill>
      {contain ? (
        <AbsoluteFill style={{ padding: u(120), paddingBottom: slide.title || slide.caption ? u(240) : u(120), alignItems: "center", justifyContent: "center" }}>
          <Img
            src={src}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              borderRadius: u(24),
              boxShadow: `0 ${u(40)}px ${u(100)}px ${alpha("#000", 0.35)}`,
              opacity: p,
              transform: `scale(${(0.92 + 0.08 * p) * zoom})`,
            }}
          />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ opacity: p, transform: `scale(${zoom}) translateX(${pan}%)` }}>
          <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </AbsoluteFill>
      )}
      {!contain && (slide.title || slide.caption) ? (
        <AbsoluteFill style={{ background: `linear-gradient(0deg, ${alpha("#000", 0.75)} 0%, transparent 55%)` }} />
      ) : null}
      {slide.title || slide.caption ? (
        <AbsoluteFill style={{ justifyContent: "flex-end", padding: `${u(90)}px ${u(140)}px`, color: contain ? theme.colors.text : "#fff" }}>
          {slide.title ? (
            <h1 style={{ margin: 0, fontFamily: fontStack(theme.fonts.heading), fontSize: u(fitSize(slide.title, 76, 36)), fontWeight: 700, letterSpacing: "-0.02em" }}>
              <WordReveal text={slide.title} delay={10} />
            </h1>
          ) : null}
          {slide.caption ? (
            <Reveal delay={22}>
              <p style={{ margin: `${u(16)}px 0 0`, fontSize: u(32), opacity: 0.85, fontFamily: fontStack(theme.fonts.body) }}>{slide.caption}</p>
            </Reveal>
          ) : null}
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

const Col: React.FC<{ col: ColumnSpec; delay: number; side: "left" | "right" }> = ({ col, delay, side }) => {
  const u = useU();
  const theme = useTheme();
  const lk = useLook();
  const resolve = useAssetResolver();
  const src = col.src ? resolve(col.src) : undefined;
  // Minimal: the right column is the emphasized one (accent); the left stays neutral.
  const tone = lk.minimal ? (side === "left" ? theme.colors.muted : theme.colors.accent) : side === "left" ? theme.colors.accent : theme.colors.accent2;
  return (
    <Reveal delay={delay} from={side} distance={u(60)} style={{ flex: 1, minWidth: 0, display: "flex" }}>
      <div
        style={{
          flex: 1,
          ...lk.card(u, lk.minimal ? (side === "left" ? "none" : "accent") : side === "left" ? "accent" : "accent2"),
          padding: lk.minimal ? `${u(40)}px 0 0` : `${u(56)}px ${u(60)}px`,
          display: "flex",
          flexDirection: "column",
          gap: u(28),
        }}
      >
        {col.heading ? (
          <div
            style={{
              fontFamily: fontStack(theme.fonts.heading),
              fontSize: u(54),
              fontWeight: lk.minimal ? 600 : 700,
              letterSpacing: lk.minimal ? "-0.03em" : undefined,
              marginBottom: u(6),
              color: tone,
            }}
          >
            {col.heading}
          </div>
        ) : null}
        {col.text ? <div style={{ fontSize: u(fitSize(col.text, 38, 160, 26)), lineHeight: 1.4, color: theme.colors.text }}>{col.text}</div> : null}
        {col.bullets?.map((b, i) => {
          const { text, sub } = bulletText(b);
          return (
            <Reveal key={i} delay={delay + 10 + i * 7} from="up" distance={u(20)}>
              <div style={{ display: "flex", gap: u(20), fontSize: u(40), lineHeight: 1.3, fontWeight: 500 }}>
                <span style={{ color: tone, fontWeight: lk.minimal ? 400 : 800 }}>{lk.minimal ? "—" : "›"}</span>
                <span>
                  {text}
                  {sub ? <div style={{ fontSize: u(28), color: theme.colors.muted, marginTop: u(6), fontWeight: 400 }}>{sub}</div> : null}
                </span>
              </div>
            </Reveal>
          );
        })}
        {src ? <Img src={src} style={{ flex: 1, minHeight: 0, width: "100%", objectFit: "cover", borderRadius: lk.radius(u, 18) }} /> : null}
      </div>
    </Reveal>
  );
};

export const SplitSlide: React.FC<{ slide: Of<"split"> }> = ({ slide }) => {
  const u = useU();
  const hasImage = !!(slide.left.src || slide.right.src);
  return (
    <Stage>
      <Heading text={slide.title} delay={0} size={64} />
      <div style={{ flex: 1, display: "flex", alignItems: hasImage ? "stretch" : "center", minHeight: 0 }}>
        <div style={{ flex: 1, display: "flex", gap: u(50), alignItems: "stretch", height: hasImage ? "100%" : undefined }}>
          <Col col={slide.left} delay={14} side="left" />
          <Col col={slide.right} delay={24} side="right" />
        </div>
      </div>
    </Stage>
  );
};

export const TimelineSlide: React.FC<{ slide: Of<"timeline"> }> = ({ slide }) => {
  const u = useU();
  const theme = useTheme();
  const lk = useLook();
  const frame = useCurrentFrame();
  const n = slide.items.length;
  const lineH = u(lk.minimal ? 2 : 6);
  const lineP = interpolate(frame, [12, 12 + n * 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Stage>
      <Heading text={slide.title} delay={0} size={64} />
      <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: lineH, background: alpha(theme.colors.text, 0.1), borderRadius: lineH }} />
        <div
          style={{
            position: "absolute",
            left: 0,
            width: `${lineP * 100}%`,
            top: "50%",
            height: lineH,
            borderRadius: lineH,
            background: lk.accentFill(90),
          }}
        />
        <div style={{ display: "flex", width: "100%", justifyContent: "space-between", position: "relative" }}>
          {slide.items.map((it, i) => {
            const delay = 14 + i * 10;
            const up = i % 2 === 0;
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
                <Reveal delay={delay} from="scale">
                  <div
                    style={{
                      width: u(lk.minimal ? 18 : 34),
                      height: u(lk.minimal ? 18 : 34),
                      borderRadius: "50%",
                      background: lk.minimal ? theme.colors.accent : theme.colors.bg,
                      border: lk.minimal ? `${u(5)}px solid ${theme.colors.bg}` : `${u(7)}px solid ${i % 2 ? theme.colors.accent2 : theme.colors.accent}`,
                    }}
                  />
                </Reveal>
                <div
                  style={{
                    position: "absolute",
                    [up ? "bottom" : "top"]: u(60),
                    width: "92%",
                    textAlign: "center",
                  }}
                >
                  <Reveal delay={delay + 4} from={up ? "up" : "down"} distance={u(30)}>
                    <div style={{ fontFamily: fontStack(theme.fonts.mono), fontSize: u(24), color: theme.colors.accent, fontWeight: 700, letterSpacing: "0.06em" }}>
                      {it.label}
                    </div>
                    <div style={{ fontFamily: fontStack(theme.fonts.heading), fontSize: u(fitSize(it.title, 36, 18)), fontWeight: 700, marginTop: u(8) }}>{it.title}</div>
                    {it.text ? <div style={{ fontSize: u(24), color: theme.colors.muted, marginTop: u(8), lineHeight: 1.35 }}>{it.text}</div> : null}
                  </Reveal>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Stage>
  );
};

const KEYWORDS =
  /\b(const|let|var|function|return|if|else|for|while|import|from|export|class|def|async|await|new|try|catch|in|of|public|private|static|fn|pub|struct|impl|type|interface|True|False|None|null|true|false|self|this)\b/g;

function highlightLine(line: string, theme: ReturnType<typeof useTheme>): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = new RegExp(`(\\/\\/.*$|#.*$|"(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'|\`[^\`]*\`|\\b\\d+(?:\\.\\d+)?\\b|${KEYWORDS.source})`, "g");
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index));
    const tok = m[0];
    const color = /^(\/\/|#)/.test(tok)
      ? theme.colors.muted
      : /^["'`]/.test(tok)
        ? theme.colors.accent
        : /^\d/.test(tok)
          ? theme.colors.accent2
          : theme.colors.accent2;
    out.push(
      <span key={k++} style={{ color, fontStyle: /^(\/\/|#)/.test(tok) ? "italic" : undefined, fontWeight: /^[a-zA-Z]/.test(tok) ? 700 : undefined }}>
        {tok}
      </span>,
    );
    last = m.index + tok.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

export const CodeSlide: React.FC<{ slide: Of<"code"> }> = ({ slide }) => {
  const u = useU();
  const theme = useTheme();
  const lk = useLook();
  const lines = slide.code.replace(/\s+$/, "").split("\n");
  const size = lines.length > 16 ? 24 : lines.length > 10 ? 28 : 34;
  const hl = new Set(slide.highlight ?? []);
  return (
    <Stage>
      {slide.title ? <Heading text={slide.title} delay={0} size={60} /> : null}
      <Reveal delay={8} from="up" style={{ flex: 1, minHeight: 0, display: "flex" }}>
        <div
          style={{
            flex: 1,
            borderRadius: lk.radius(u, 24),
            background: theme.dark ? alpha("#000", 0.45) : lk.minimal ? "#161616" : "#0F172A",
            border: `${u(2)}px solid ${alpha(theme.colors.accent, 0.25)}`,
            padding: `${u(26)}px ${u(40)}px`,
            overflow: "hidden",
            color: "#E5E7EB",
          }}
        >
          <div style={{ display: "flex", gap: u(12), marginBottom: u(22), alignItems: "center" }}>
            {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
              <div key={c} style={{ width: u(18), height: u(18), borderRadius: "50%", background: c }} />
            ))}
            {slide.language ? <span style={{ marginLeft: u(16), fontSize: u(22), color: "#9CA3AF", fontFamily: fontStack(theme.fonts.mono) }}>{slide.language}</span> : null}
          </div>
          <pre style={{ margin: 0, fontFamily: fontStack(theme.fonts.mono), fontSize: u(size), lineHeight: 1.5 }}>
            {lines.map((line, i) => (
              <Reveal key={i} delay={14 + i * 3} from="left" distance={u(16)}>
                <div
                  style={{
                    display: "flex",
                    background: hl.has(i + 1) ? alpha(theme.colors.accent, 0.16) : undefined,
                    borderLeft: `${u(5)}px solid ${hl.has(i + 1) ? theme.colors.accent : "transparent"}`,
                    paddingLeft: u(14),
                    marginLeft: -u(19),
                  }}
                >
                  <span style={{ width: u(size * 2.2), color: "#6B7280", flexShrink: 0, userSelect: "none" }}>{i + 1}</span>
                  <span style={{ whiteSpace: "pre" }}>{highlightLine(line, theme)}</span>
                </div>
              </Reveal>
            ))}
          </pre>
        </div>
      </Reveal>
    </Stage>
  );
};
