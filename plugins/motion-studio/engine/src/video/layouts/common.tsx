import React from "react";
import { AbsoluteFill } from "remotion";
import { fontStack } from "../../themes";
import { AccentLine, Reveal, WordReveal, fitSize, useLook, useTheme } from "../anim";
import { useU } from "../Background";

/** Padded content area used by every layout. */
export const Stage: React.FC<{ children: React.ReactNode; center?: boolean; style?: React.CSSProperties }> = ({
  children,
  center,
  style,
}) => {
  const u = useU();
  const theme = useTheme();
  return (
    <AbsoluteFill
      style={{
        padding: `${u(110)}px ${u(140)}px`,
        color: theme.colors.text,
        fontFamily: fontStack(theme.fonts.body),
        display: "flex",
        flexDirection: "column",
        justifyContent: center ? "center" : "flex-start",
        alignItems: center ? "center" : "stretch",
        textAlign: center ? "center" : "left",
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export const Kicker: React.FC<{ text?: string; delay?: number }> = ({ text, delay = 0 }) => {
  const u = useU();
  const theme = useTheme();
  if (!text) return null;
  return (
    <Reveal delay={delay} from="left" distance={u(30)}>
      <div
        style={{
          fontSize: u(26),
          fontWeight: 600,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: theme.colors.accent,
          marginBottom: u(22),
        }}
      >
        {text}
      </div>
    </Reveal>
  );
};

/** Slide heading with word-by-word reveal and a drawing accent underline. */
export const Heading: React.FC<{ text: string; delay?: number; size?: number; underline?: boolean; center?: boolean }> = ({
  text,
  delay = 0,
  size = 76,
  underline = true,
  center,
}) => {
  const u = useU();
  const theme = useTheme();
  const lk = useLook();
  return (
    <div style={{ marginBottom: u(48), display: "flex", flexDirection: "column", alignItems: center ? "center" : "flex-start" }}>
      <h1
        style={{
          margin: 0,
          fontFamily: fontStack(theme.fonts.heading),
          fontSize: u(fitSize(text, size, 38)),
          fontWeight: lk.minimal ? 600 : 700,
          lineHeight: 1.08,
          letterSpacing: lk.minimal ? "-0.035em" : "-0.02em",
          maxWidth: u(1640),
        }}
      >
        <WordReveal text={text} delay={delay} />
      </h1>
      {underline ? (
        <div style={{ marginTop: u(26) }}>
          <AccentLine delay={delay + 8} width={u(140)} height={u(7)} />
        </div>
      ) : null}
    </div>
  );
};

/** Numbered or dotted marker for list items. */
export const Marker: React.FC<{ index: number; delay: number }> = ({ index, delay }) => {
  const u = useU();
  const theme = useTheme();
  const lk = useLook();
  if (lk.minimal)
    return (
      <Reveal delay={delay} from="up">
        <div style={{ width: u(52), paddingTop: u(10), fontSize: u(22), fontWeight: 500, fontFamily: fontStack(theme.fonts.mono), color: theme.colors.accent, flexShrink: 0 }}>
          {String(index + 1).padStart(2, "0")}
        </div>
      </Reveal>
    );
  return (
    <Reveal delay={delay} from="scale">
      <div
        style={{
          width: u(52),
          height: u(52),
          borderRadius: u(14),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: u(24),
          fontWeight: 700,
          fontFamily: fontStack(theme.fonts.mono),
          color: theme.dark ? theme.colors.bg : "#fff",
          background: lk.accentFill(135),
          flexShrink: 0,
        }}
      >
        {String(index + 1).padStart(2, "0")}
      </div>
    </Reveal>
  );
};
