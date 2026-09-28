// Layouts: agenda, cards, big-number, image-text, quote, comparison, visual (SVG).
import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { bulletText, type BulletSpec, type SlideSpec } from "../../spec";
import { alpha, fontStack } from "../../themes";
import { looksLikeSvg } from "../../svg-utils";
import { AccentLine, Reveal, WordReveal, fitSize, useAssetResolver, useCountUp, useLook, useSpring, useTheme } from "../anim";
import { useU } from "../Background";
import { SvgVisual } from "../SvgVisual";
import { Heading, Kicker, Stage } from "./common";

type Of<L extends SlideSpec["layout"]> = Extract<SlideSpec, { layout: L }>;

/** Short text + bullet list used beside media. */
const Notes: React.FC<{ text?: string; bullets?: BulletSpec[]; delay: number; size?: number }> = ({ text, bullets, delay, size = 36 }) => {
  const u = useU();
  const theme = useTheme();
  const lk = useLook();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: u(24) }}>
      {text ? (
        <Reveal delay={delay}>
          <div style={{ fontSize: u(fitSize(text, size, 140, 26)), lineHeight: 1.45, color: theme.colors.muted }}>{text}</div>
        </Reveal>
      ) : null}
      {bullets?.map((b, i) => {
        const { text: t, sub } = bulletText(b);
        return (
          <Reveal key={i} delay={delay + 6 + i * 7} from="up" distance={u(20)}>
            <div style={{ display: "flex", gap: u(18), fontSize: u(size), lineHeight: 1.3, fontWeight: 500 }}>
              <span style={{ color: theme.colors.accent, fontWeight: lk.minimal ? 400 : 800 }}>{lk.minimal ? "—" : "›"}</span>
              <span>
                {t}
                {sub ? <div style={{ fontSize: u(size * 0.7), color: theme.colors.muted, marginTop: u(4), fontWeight: 400 }}>{sub}</div> : null}
              </span>
            </div>
          </Reveal>
        );
      })}
    </div>
  );
};

export const AgendaSlide: React.FC<{ slide: Of<"agenda"> }> = ({ slide }) => {
  const u = useU();
  const theme = useTheme();
  const lk = useLook();
  const n = slide.items.length;
  const twoCol = n > 5;
  const active = slide.active ? slide.active - 1 : -1;
  return (
    <Stage>
      <Heading text={slide.title} delay={0} size={64} />
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: twoCol ? "1fr 1fr" : "1fr",
          gridAutoFlow: twoCol ? "column" : "row",
          gridTemplateRows: twoCol ? `repeat(${Math.ceil(n / 2)}, auto)` : undefined,
          alignContent: "center",
          columnGap: u(80),
          rowGap: u(twoCol ? 18 : 22),
        }}
      >
        {slide.items.map((item, i) => {
          const dim = active >= 0 && i !== active;
          const on = i === active;
          return (
            <Reveal key={i} delay={14 + i * 6} from="left" distance={u(30)}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: u(32),
                  paddingTop: u(18),
                  borderTop: `${u(on ? 3 : 1.5)}px solid ${on ? theme.colors.accent : alpha(theme.colors.text, 0.12)}`,
                  opacity: dim ? 0.35 : 1,
                }}
              >
                <span style={{ fontFamily: fontStack(theme.fonts.mono), fontSize: u(24), color: theme.colors.accent, width: u(48) }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ fontSize: u(fitSize(item, n > 5 ? 38 : 46, 40)), fontWeight: on ? 600 : lk.minimal ? 500 : 600, letterSpacing: "-0.015em" }}>{item}</span>
              </div>
            </Reveal>
          );
        })}
      </div>
    </Stage>
  );
};

export const CardsSlide: React.FC<{ slide: Of<"cards"> }> = ({ slide }) => {
  const u = useU();
  const theme = useTheme();
  const lk = useLook();
  const n = slide.cards.length;
  return (
    <Stage>
      <Kicker text={slide.kicker} />
      <Heading text={slide.title} delay={2} size={64} />
      <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
        <div style={{ flex: 1, display: "flex", gap: u(n === 4 ? 32 : 44), alignItems: "stretch" }}>
          {slide.cards.map((c, i) => {
            const delay = 16 + i * 8;
            return (
              <Reveal key={i} delay={delay} from="up" distance={u(40)} style={{ flex: 1, display: "flex", minWidth: 0 }}>
                <div style={{ flex: 1, ...lk.card(u, lk.minimal ? (i === 0 ? "accent" : "none") : "none"), padding: lk.cardPad(u), display: "flex", flexDirection: "column", gap: u(18) }}>
                  {looksLikeSvg(c.icon) ? (
                    <div style={{ width: u(84), height: u(84), marginBottom: u(10), color: theme.colors.accent }}>
                      <SvgVisual svg={c.icon} delay={delay + 4} />
                    </div>
                  ) : c.label ? (
                    <div style={{ fontFamily: fontStack(theme.fonts.mono), fontSize: u(24), color: theme.colors.accent, marginBottom: u(6) }}>{c.label}</div>
                  ) : null}
                  <div style={{ fontFamily: fontStack(theme.fonts.heading), fontSize: u(fitSize(c.title, n === 4 ? 36 : 42, 22)), fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
                    {c.title}
                  </div>
                  {c.text ? <div style={{ fontSize: u(fitSize(c.text, n === 4 ? 26 : 29, 90, 22)), lineHeight: 1.45, color: theme.colors.muted }}>{c.text}</div> : null}
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </Stage>
  );
};

export const BigNumberSlide: React.FC<{ slide: Of<"big-number"> }> = ({ slide }) => {
  const u = useU();
  const theme = useTheme();
  const lk = useLook();
  const value = useCountUp(slide.value, 8, 50, slide.decimals ?? (Number.isInteger(slide.value) ? 0 : 1));
  const display = `${slide.prefix ?? ""}${slide.value.toLocaleString("en-US")}${slide.suffix ?? ""}`;
  return (
    <Stage style={{ justifyContent: "center" }}>
      <Kicker text={slide.kicker} />
      <div style={{ display: "flex", alignItems: "flex-end", gap: u(80) }}>
        <div
          style={{
            fontFamily: fontStack(theme.fonts.heading),
            fontSize: u(fitSize(display, 320, 5, 160)),
            fontWeight: lk.minimal ? 500 : 800,
            lineHeight: 0.9,
            letterSpacing: "-0.06em",
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
            ...lk.numberText(),
          }}
        >
          {slide.prefix ?? ""}
          {value}
          {slide.suffix ?? ""}
        </div>
        <Reveal delay={24} from="left" distance={u(30)} style={{ paddingBottom: u(24), maxWidth: u(700) }}>
          <div style={{ fontSize: u(fitSize(slide.label, 46, 40)), fontWeight: 600, lineHeight: 1.2, letterSpacing: "-0.02em" }}>{slide.label}</div>
        </Reveal>
      </div>
      <div style={{ margin: `${u(48)}px 0 ${u(36)}px` }}>
        <AccentLine delay={30} width={u(lk.minimal ? 1640 : 160)} height={u(lk.minimal ? 3 : 7)} color={lk.minimal ? alpha(theme.colors.text, 0.14) : undefined} />
      </div>
      {slide.context ? (
        <Reveal delay={36}>
          <p style={{ margin: 0, fontSize: u(fitSize(slide.context, 36, 120, 26)), color: theme.colors.muted, lineHeight: 1.45, maxWidth: u(1200) }}>{slide.context}</p>
        </Reveal>
      ) : null}
    </Stage>
  );
};

export const ImageTextSlide: React.FC<{ slide: Of<"image-text"> }> = ({ slide }) => {
  const u = useU();
  const theme = useTheme();
  const lk = useLook();
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const resolve = useAssetResolver();
  const p = useSpring(0, { damping: 30 });
  const mediaLeft = slide.side === "left";
  const isSvg = looksLikeSvg(slide.svg);
  const zoom = interpolate(frame, [0, durationInFrames], [1.0, 1.08]);
  const mediaW = 46;
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: isSvg || slide.fit === "contain" ? u(110) : 0,
          bottom: isSvg || slide.fit === "contain" ? u(110) : 0,
          [mediaLeft ? "left" : "right"]: isSvg || slide.fit === "contain" ? u(110) : 0,
          width: `${mediaW}%`,
          overflow: "hidden",
          opacity: isSvg ? 1 : p,
          background: !isSvg && slide.fit === "cover" ? theme.colors.bg2 : undefined,
        }}
      >
        {isSvg ? (
          <SvgVisual svg={slide.svg!} animate={slide.animate} delay={10} />
        ) : (
          <Img
            src={resolve(slide.src!)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: slide.fit,
              transform: slide.fit === "cover" ? `scale(${zoom})` : undefined,
              borderRadius: slide.fit === "contain" ? lk.radius(u, 20) : 0,
            }}
          />
        )}
      </div>
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          [mediaLeft ? "right" : "left"]: 0,
          width: `${100 - mediaW}%`,
          padding: `${u(110)}px ${u(mediaLeft ? 140 : 90)}px ${u(110)}px ${u(mediaLeft ? 90 : 140)}px`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          color: theme.colors.text,
          fontFamily: fontStack(theme.fonts.body),
        }}
      >
        <Kicker text={slide.kicker} />
        <Heading text={slide.title} delay={4} size={62} />
        <Notes text={slide.text} bullets={slide.bullets} delay={18} size={34} />
      </div>
    </AbsoluteFill>
  );
};

export const QuoteSlide: React.FC<{ slide: Of<"quote"> }> = ({ slide }) => {
  const u = useU();
  const theme = useTheme();
  const lk = useLook();
  const resolve = useAssetResolver();
  const p = useSpring(0);
  return (
    <Stage style={{ justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: u(90) }}>
        {slide.src ? (
          <div
            style={{
              width: u(320),
              height: u(320),
              borderRadius: "50%",
              overflow: "hidden",
              flexShrink: 0,
              opacity: p,
              transform: `scale(${0.94 + 0.06 * p})`,
              boxShadow: lk.glow ? `0 0 0 ${u(8)}px ${alpha(theme.colors.accent, 0.25)}` : `0 0 0 ${u(2)}px ${alpha(theme.colors.text, 0.12)}`,
            }}
          >
            <Img src={resolve(slide.src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        ) : null}
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: fontStack(theme.fonts.heading), fontSize: u(150), lineHeight: 0.7, height: u(80), color: theme.colors.accent, opacity: p }}>“</div>
          <p
            style={{
              margin: 0,
              fontFamily: fontStack(theme.fonts.heading),
              fontSize: u(fitSize(slide.text, slide.src ? 64 : 76, 90, 40)),
              fontWeight: lk.minimal ? 500 : 600,
              lineHeight: 1.25,
              letterSpacing: "-0.02em",
            }}
          >
            <WordReveal text={slide.text} delay={8} stagger={2} />
          </p>
          <Reveal delay={30}>
            <div style={{ marginTop: u(44), display: "flex", alignItems: "center", gap: u(22) }}>
              <AccentLine delay={30} width={u(48)} height={u(4)} />
              <div>
                <div style={{ fontSize: u(32), fontWeight: 600 }}>{slide.author}</div>
                {slide.role ? <div style={{ fontSize: u(26), color: theme.colors.muted, marginTop: u(4) }}>{slide.role}</div> : null}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </Stage>
  );
};

export const ComparisonSlide: React.FC<{ slide: Of<"comparison"> }> = ({ slide }) => {
  const u = useU();
  const theme = useTheme();
  const lk = useLook();
  const hl = slide.highlight ? slide.highlight - 1 : -1;
  const cols = slide.columns.length;
  const few = slide.rows.length <= 5;
  const rowH = slide.rows.length > 6 ? 76 : few ? 104 : 90;
  const fs = few ? 36 : 32;
  const grid = `minmax(${u(360)}px, 1.3fr) repeat(${cols}, 1fr)`;
  const cell = (v: string | number | boolean | undefined, ci: number) => {
    if (v === true) return <span style={{ color: ci === hl || hl < 0 ? theme.colors.accent : theme.colors.text, fontSize: u(fs + 8), fontWeight: 600 }}>✓</span>;
    if (v === false || v === undefined || v === "") return <span style={{ color: alpha(theme.colors.text, 0.3), fontSize: u(fs) }}>—</span>;
    return <span style={{ fontSize: u(fitSize(String(v), fs, 18, 24)), fontWeight: ci === hl ? 600 : 400 }}>{String(v)}</span>;
  };
  return (
    <Stage>
      <Heading text={slide.title} delay={0} size={62} />
      <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
        <div
          style={{
            flex: 1,
            position: "relative",
            borderRadius: lk.minimal ? 0 : u(24),
            background: lk.minimal ? "transparent" : alpha(theme.colors.surface, theme.dark ? 0.45 : 0.85),
            padding: lk.minimal ? 0 : `${u(10)}px ${u(30)}px`,
          }}
        >
          {hl >= 0 ? (
            <Reveal delay={8} from="none" style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: grid, padding: lk.minimal ? 0 : `0 ${u(30)}px`, pointerEvents: "none" }}>
              {[...Array(cols + 1)].map((_, i) => (
                <div key={i} style={{ background: i === hl + 1 ? alpha(theme.colors.accent, theme.dark ? 0.12 : 0.07) : undefined, borderRadius: lk.radius(u, 16) }} />
              ))}
            </Reveal>
          ) : null}
          <Reveal delay={6} from="none">
            <div style={{ display: "grid", gridTemplateColumns: grid, alignItems: "center", height: u(rowH), position: "relative" }}>
              <span />
              {slide.columns.map((c, ci) => (
                <span key={ci} style={{ textAlign: "center", fontSize: u(fs - 2), fontWeight: 600, color: ci === hl ? theme.colors.accent : theme.colors.muted, letterSpacing: "-0.01em" }}>
                  {c}
                </span>
              ))}
            </div>
          </Reveal>
          {slide.rows.map((r, ri) => (
            <Reveal key={ri} delay={14 + ri * 5} from="up" distance={u(14)}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: grid,
                  alignItems: "center",
                  height: u(rowH),
                  borderTop: `${u(1.5)}px solid ${alpha(theme.colors.text, 0.1)}`,
                  position: "relative",
                }}
              >
                <span style={{ fontSize: u(fitSize(r.label, fs, 26, 24)), fontWeight: 500, paddingLeft: u(8) }}>{r.label}</span>
                {slide.columns.map((_, ci) => (
                  <span key={ci} style={{ textAlign: "center" }}>
                    {cell(r.values[ci], ci)}
                  </span>
                ))}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </Stage>
  );
};

export const VisualSlide: React.FC<{ slide: Of<"visual"> }> = ({ slide }) => {
  const u = useU();
  const theme = useTheme();
  const svg = slide.svg ?? "";
  const side = slide.position !== "center";
  const hasNotes = !!(slide.text || slide.bullets?.length);
  const visual = <SvgVisual svg={svg} animate={slide.animate} delay={slide.title ? 12 : 4} stepSec={slide.stepSec} />;
  return (
    <Stage>
      <Kicker text={slide.kicker} />
      {slide.title ? <Heading text={slide.title} delay={0} size={side ? 58 : 60} underline={!side} /> : null}
      {side ? (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: slide.position === "left" ? "row" : "row-reverse", gap: u(80), alignItems: "center" }}>
          <div style={{ flex: hasNotes ? 1.45 : 1, height: "100%", minWidth: 0 }}>{visual}</div>
          {hasNotes ? (
            <div style={{ flex: 1, minWidth: 0 }}>
              <Notes text={slide.text} bullets={slide.bullets} delay={20} size={34} />
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0 }}>{visual}</div>
      )}
      {slide.caption ? (
        <Reveal delay={30}>
          <div style={{ marginTop: u(20), fontSize: u(26), color: theme.colors.muted, textAlign: side ? "left" : "center" }}>{slide.caption}</div>
        </Reveal>
      ) : null}
    </Stage>
  );
};
