import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { bulletText, type SlideSpec } from "../../spec";
import { alpha, fontStack } from "../../themes";
import { AccentLine, Reveal, WordReveal, fitSize, useLook, useSpring, useTheme } from "../anim";
import { useU } from "../Background";
import { Heading, Kicker, Marker, Stage } from "./common";

type Of<L extends SlideSpec["layout"]> = Extract<SlideSpec, { layout: L }>;

export const TitleSlide: React.FC<{ slide: Of<"title"> }> = ({ slide }) => {
  const u = useU();
  const theme = useTheme();
  const lk = useLook();
  const center = lk.titleAlign === "center";
  return (
    <Stage center={center} style={center ? undefined : { justifyContent: "center" }}>
      <Kicker text={slide.kicker} delay={4} />
      <h1
        style={{
          margin: 0,
          fontFamily: fontStack(theme.fonts.heading),
          fontSize: u(fitSize(slide.title, lk.minimal ? 140 : 132, 24)),
          fontWeight: lk.minimal ? 600 : 800,
          lineHeight: 1.02,
          letterSpacing: lk.minimal ? "-0.045em" : "-0.035em",
          maxWidth: u(1600),
          paddingBottom: u(10),
        }}
      >
        <WordReveal text={slide.title} delay={8} stagger={4} wordStyle={lk.heroText()} />
      </h1>
      <div style={{ margin: `${u(lk.minimal ? 44 : 40)}px 0` }}>
        <AccentLine delay={20} width={u(lk.minimal ? 96 : 180)} height={u(8)} />
      </div>
      {slide.subtitle ? (
        <Reveal delay={26} from="blur">
          <p style={{ margin: 0, fontSize: u(fitSize(slide.subtitle, 42, 70)), color: theme.colors.muted, maxWidth: u(lk.minimal ? 1200 : 1400), lineHeight: 1.35 }}>
            {slide.subtitle}
          </p>
        </Reveal>
      ) : null}
    </Stage>
  );
};

export const SectionSlide: React.FC<{ slide: Of<"section"> }> = ({ slide }) => {
  const u = useU();
  const theme = useTheme();
  const lk = useLook();
  const frame = useCurrentFrame();
  const p = useSpring(0, { damping: 26 });

  if (lk.minimal)
    return (
      <Stage style={{ justifyContent: "center" }}>
        {slide.number ? (
          <Reveal delay={0}>
            <div style={{ fontFamily: fontStack(theme.fonts.mono), fontSize: u(30), color: theme.colors.accent, marginBottom: u(28), letterSpacing: "0.04em" }}>
              {slide.number} —
            </div>
          </Reveal>
        ) : null}
        <h1 style={{ margin: 0, fontFamily: fontStack(theme.fonts.heading), fontSize: u(fitSize(slide.title, 116, 22)), fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1.04, maxWidth: u(1400) }}>
          <WordReveal text={slide.title} delay={6} stagger={4} />
        </h1>
        {slide.subtitle ? (
          <Reveal delay={20}>
            <p style={{ margin: `${u(30)}px 0 0`, fontSize: u(38), color: theme.colors.muted, maxWidth: u(1200) }}>{slide.subtitle}</p>
          </Reveal>
        ) : null}
        <div style={{ position: "absolute", left: u(140), right: u(140), bottom: u(110), height: u(2), background: alpha(theme.colors.text, 0.12) }}>
          <div style={{ height: "100%", width: `${interpolate(frame, [4, 40], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}%`, background: theme.colors.accent }} />
        </div>
      </Stage>
    );

  return (
    <Stage style={{ justifyContent: "center" }}>
      {slide.number ? (
        <div
          style={{
            position: "absolute",
            right: u(100),
            top: "50%",
            transform: `translateY(-50%) translateX(${(1 - p) * u(200)}px)`,
            fontFamily: fontStack(theme.fonts.heading),
            fontSize: u(520),
            fontWeight: 800,
            lineHeight: 1,
            color: "transparent",
            WebkitTextStroke: `${u(3)}px ${alpha(theme.colors.accent, 0.35)}`,
            opacity: p,
          }}
        >
          {slide.number}
        </div>
      ) : null}
      <div
        style={{
          width: u(10),
          height: interpolate(frame, [0, 20], [0, u(220)], { extrapolateRight: "clamp" }),
          background: lk.accentFill(180),
          borderRadius: u(10),
          position: "absolute",
          left: u(90),
          top: `calc(50% - ${u(110)}px)`,
        }}
      />
      <h1 style={{ margin: 0, fontFamily: fontStack(theme.fonts.heading), fontSize: u(fitSize(slide.title, 110, 22)), fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, maxWidth: u(1300) }}>
        <WordReveal text={slide.title} delay={6} stagger={4} />
      </h1>
      {slide.subtitle ? (
        <Reveal delay={20}>
          <p style={{ margin: `${u(30)}px 0 0`, fontSize: u(40), color: theme.colors.muted, maxWidth: u(1200) }}>{slide.subtitle}</p>
        </Reveal>
      ) : null}
    </Stage>
  );
};

export const BulletsSlide: React.FC<{ slide: Of<"bullets"> }> = ({ slide }) => {
  const u = useU();
  const theme = useTheme();
  const lk = useLook();
  const n = slide.bullets.length;
  const size = n > 5 ? 36 : n > 3 ? 42 : 48;
  return (
    <Stage>
      <Kicker text={slide.kicker} />
      <Heading text={slide.title} delay={2} />
      <div style={{ display: "flex", flexDirection: "column", gap: u(n > 5 ? 22 : 34), flex: 1, justifyContent: "center" }}>
        {slide.bullets.map((b, i) => {
          const { text, sub } = bulletText(b);
          const delay = 18 + i * 9;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: u(30),
                // Minimal: hairline dividers between rows instead of filled markers.
                borderTop: lk.minimal ? `${u(1.5)}px solid ${alpha(theme.colors.text, 0.1)}` : undefined,
                paddingTop: lk.minimal ? u(n > 5 ? 16 : 24) : undefined,
              }}
            >
              <Marker index={i} delay={delay} />
              <Reveal delay={delay + 2} from="left" distance={u(50)} style={{ flex: 1 }}>
                <div style={{ fontSize: u(fitSize(text, size, 60)), fontWeight: lk.minimal ? 500 : 600, lineHeight: 1.25, paddingTop: u(4), letterSpacing: lk.minimal ? "-0.015em" : undefined }}>
                  {text}
                </div>
                {sub ? <div style={{ fontSize: u(size * 0.62), color: theme.colors.muted, marginTop: u(8), lineHeight: 1.35 }}>{sub}</div> : null}
              </Reveal>
            </div>
          );
        })}
      </div>
    </Stage>
  );
};

export const StatementSlide: React.FC<{ slide: Of<"statement"> }> = ({ slide }) => {
  const u = useU();
  const theme = useTheme();
  const lk = useLook();
  const p = useSpring(0);
  const frame = useCurrentFrame();
  const text = (
    <p
      style={{
        margin: 0,
        fontFamily: fontStack(theme.fonts.heading),
        fontSize: u(fitSize(slide.text, lk.minimal ? 80 : 72, 70, 40)),
        fontWeight: lk.minimal ? 500 : 600,
        lineHeight: 1.18,
        letterSpacing: lk.minimal ? "-0.03em" : "-0.015em",
        maxWidth: u(1500),
      }}
    >
      <WordReveal text={slide.text} delay={8} stagger={2} />
    </p>
  );
  const attribution = slide.attribution ? (
    <Reveal delay={30}>
      <div style={{ marginTop: u(50), display: "flex", alignItems: "center", gap: u(20), fontSize: u(32), color: theme.colors.muted }}>
        <AccentLine delay={30} width={u(60)} height={u(4)} />
        {slide.attribution}
      </div>
    </Reveal>
  ) : null;

  if (lk.minimal)
    return (
      <Stage style={{ justifyContent: "center" }}>
        <div style={{ display: "flex", gap: u(56) }}>
          <div style={{ width: u(4), background: theme.colors.accent, height: `${interpolate(frame, [0, 24], [0, 100], { extrapolateRight: "clamp" })}%` }} />
          <div>
            {text}
            {attribution}
          </div>
        </div>
      </Stage>
    );

  return (
    <Stage center>
      <div
        style={{
          fontFamily: fontStack(theme.fonts.heading),
          fontSize: u(260),
          lineHeight: 0.6,
          height: u(120),
          color: theme.colors.accent,
          opacity: p * 0.9,
          transform: `scale(${0.6 + 0.4 * p})`,
        }}
      >
        “
      </div>
      {text}
      {attribution}
    </Stage>
  );
};

export const EndSlide: React.FC<{ slide: Of<"end"> }> = ({ slide }) => {
  const u = useU();
  const theme = useTheme();
  const lk = useLook();
  const frame = useCurrentFrame();
  const pulse = lk.glow ? 1 + Math.sin(frame / 12) * 0.02 : 1;
  const center = lk.titleAlign === "center";
  return (
    <Stage center={center} style={center ? undefined : { justifyContent: "center" }}>
      <h1
        style={{
          margin: 0,
          fontFamily: fontStack(theme.fonts.heading),
          fontSize: u(fitSize(slide.title, lk.minimal ? 128 : 120, 22)),
          fontWeight: lk.minimal ? 600 : 800,
          letterSpacing: lk.minimal ? "-0.045em" : "-0.03em",
        }}
      >
        <WordReveal text={slide.title} delay={4} stagger={4} />
      </h1>
      {slide.subtitle ? (
        <Reveal delay={18}>
          <p style={{ margin: `${u(30)}px 0 0`, fontSize: u(40), color: theme.colors.muted }}>{slide.subtitle}</p>
        </Reveal>
      ) : null}
      {slide.cta ? (
        <Reveal delay={30} from="scale">
          <div
            style={{
              marginTop: u(60),
              padding: `${u(22)}px ${u(52)}px`,
              borderRadius: lk.minimal ? u(4) : u(999),
              fontSize: u(34),
              fontWeight: lk.minimal ? 500 : 700,
              color: theme.dark && !lk.minimal ? theme.colors.bg : "#fff",
              background: lk.accentFill(120),
              transform: `scale(${pulse})`,
              boxShadow: lk.glow ? `0 ${u(20)}px ${u(60)}px ${alpha(theme.colors.accent, 0.35)}` : undefined,
              display: "inline-block",
            }}
          >
            {slide.cta}
            {lk.minimal ? "  →" : ""}
          </div>
        </Reveal>
      ) : null}
    </Stage>
  );
};
