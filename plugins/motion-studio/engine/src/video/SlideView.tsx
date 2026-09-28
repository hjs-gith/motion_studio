import React from "react";
import { AbsoluteFill, Html5Audio, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import type { SlideSpec } from "../spec";
import { alpha, fontStack } from "../themes";
import { captionCues, type TimedSlide } from "../timeline";
import { useAsset, useTheme } from "./anim";
import { Background, useU } from "./Background";
import { BulletsSlide, EndSlide, SectionSlide, StatementSlide, TitleSlide } from "./layouts/text";
import { ChartSlide, StatSlide } from "./layouts/data";
import { CodeSlide, ImageSlide, SplitSlide, TimelineSlide } from "./layouts/media";
import { AgendaSlide, BigNumberSlide, CardsSlide, ComparisonSlide, ImageTextSlide, QuoteSlide, VisualSlide } from "./layouts/extra";

export const Layout: React.FC<{ slide: SlideSpec }> = ({ slide }) => {
  switch (slide.layout) {
    case "title":
      return <TitleSlide slide={slide} />;
    case "section":
      return <SectionSlide slide={slide} />;
    case "bullets":
      return <BulletsSlide slide={slide} />;
    case "statement":
      return <StatementSlide slide={slide} />;
    case "stat":
      return <StatSlide slide={slide} />;
    case "chart":
      return <ChartSlide slide={slide} />;
    case "image":
      return <ImageSlide slide={slide} />;
    case "split":
      return <SplitSlide slide={slide} />;
    case "timeline":
      return <TimelineSlide slide={slide} />;
    case "code":
      return <CodeSlide slide={slide} />;
    case "end":
      return <EndSlide slide={slide} />;
    case "agenda":
      return <AgendaSlide slide={slide} />;
    case "cards":
      return <CardsSlide slide={slide} />;
    case "big-number":
      return <BigNumberSlide slide={slide} />;
    case "image-text":
      return <ImageTextSlide slide={slide} />;
    case "quote":
      return <QuoteSlide slide={slide} />;
    case "comparison":
      return <ComparisonSlide slide={slide} />;
    case "visual":
      return <VisualSlide slide={slide} />;
  }
};

/** One slide: optional own background, the layout, narration audio and burned-in captions. */
export const SlideView: React.FC<{
  timed: TimedSlide;
  /** Render a background even when the slide doesn't override it (single-slide renders). */
  forceBackground?: boolean;
  withAudio?: boolean;
  captions?: boolean;
}> = ({ timed, forceBackground, withAudio, captions }) => {
  const { slide } = timed;
  const { fps } = useVideoConfig();
  const captionFrames = timed.audio
    ? Math.round(timed.audio.durationSec * fps)
    : timed.durationInFrames - timed.audioStart - timed.transitionOut;
  return (
    <AbsoluteFill>
      {slide.background || forceBackground ? <Background kind={slide.background} frameOffset={timed.from} /> : null}
      <Layout slide={slide} />
      {withAudio && timed.audio ? <NarrationAudio file={timed.audio.file} from={timed.audioStart} /> : null}
      {captions && slide.narration ? (
        <Captions text={slide.narration} from={timed.audioStart} length={captionFrames} />
      ) : null}
    </AbsoluteFill>
  );
};

const NarrationAudio: React.FC<{ file: string; from: number }> = ({ file, from }) => {
  const src = useAsset(file);
  return (
    <Sequence from={from} layout="none">
      <Html5Audio src={src} />
    </Sequence>
  );
};

const Captions: React.FC<{ text: string; from: number; length: number }> = ({ text, from, length }) => {
  const frame = useCurrentFrame();
  const u = useU();
  const theme = useTheme();
  const cue = captionCues(text, from, length).find((c) => frame >= c.from && frame < c.to);
  if (!cue) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: u(48), pointerEvents: "none" }}>
      <div
        style={{
          maxWidth: u(1500),
          padding: `${u(12)}px ${u(28)}px`,
          borderRadius: u(14),
          background: alpha("#000", 0.62),
          color: "#fff",
          fontSize: u(34),
          lineHeight: 1.35,
          textAlign: "center",
          fontFamily: fontStack(theme.fonts.body),
          fontWeight: 500,
        }}
      >
        {cue.text}
      </div>
    </AbsoluteFill>
  );
};
