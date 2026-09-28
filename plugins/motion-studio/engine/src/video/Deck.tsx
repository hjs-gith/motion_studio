import React, { useMemo } from "react";
import { AbsoluteFill, Html5Audio, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming, type TransitionPresentation } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide as slidePresentation } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { flip } from "@remotion/transitions/flip";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { iris } from "@remotion/transitions/iris";
import type { DeckSpec, TransitionSpec } from "../spec";
import { resolveTheme } from "../themes";
import { computeTimeline, type AudioManifest } from "../timeline";
import { AssetContext, ThemeContext, useAsset } from "./anim";
import { SlideView } from "./SlideView";
import { ensureFonts } from "./fonts";
import { SvgVisual } from "./SvgVisual";

export type DeckProps = {
  deck: DeckSpec;
  audio: AudioManifest;
  /** Optional src -> URL overrides (the HTML exporter inlines assets as data URIs). */
  assets?: Record<string, string>;
};

export type SingleSlideProps = DeckProps & { index: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function presentation(t: TransitionSpec, width: number, height: number): TransitionPresentation<any> {
  switch (t.type) {
    case "slide":
      return slidePresentation({ direction: t.direction ?? "from-right" });
    case "wipe":
      return wipe({ direction: t.direction ?? "from-left" });
    case "flip":
      return flip({ direction: t.direction ?? "from-right" });
    case "clock-wipe":
      return clockWipe({ width, height });
    case "iris":
      return iris({ width, height });
    default:
      return fade();
  }
}

export const DeckComposition: React.FC<DeckProps> = ({ deck, audio, assets }) => {
  const { width, height } = useVideoConfig();
  const theme = useMemo(() => resolveTheme(deck), [deck]);
  const timeline = useMemo(() => computeTimeline(deck, audio), [deck, audio]);
  ensureFonts(theme);

  const children: React.ReactNode[] = [];
  for (const t of timeline.slides) {
    children.push(
      <TransitionSeries.Sequence key={`s-${t.id}`} durationInFrames={t.durationInFrames}>
        {/* Slides are opaque (own background, offset to the global frame) so transitions never show two layers of text. */}
        <SlideView timed={t} forceBackground withAudio captions={deck.captions} />
      </TransitionSeries.Sequence>,
    );
    if (t.transitionOut > 0) {
      children.push(
        <TransitionSeries.Transition
          key={`t-${t.id}`}
          presentation={presentation(t.transition, width, height)}
          timing={linearTiming({ durationInFrames: t.transitionOut })}
        />,
      );
    }
  }

  return (
    <AssetContext.Provider value={assets ?? null}>
      <ThemeContext.Provider value={theme}>
        <AbsoluteFill>
          <TransitionSeries>{children}</TransitionSeries>
          {deck.music ? <Music src={deck.music.src} volume={deck.music.volume} /> : null}
        </AbsoluteFill>
      </ThemeContext.Provider>
    </AssetContext.Provider>
  );
};

const Music: React.FC<{ src: string; volume: number }> = ({ src, volume }) => {
  const url = useAsset(src);
  return <Html5Audio src={url} volume={volume} loop />;
};

/** A single slide on its own, used for stills, PDF pages and the HTML player. */
export const SingleSlideComposition: React.FC<SingleSlideProps & { withAudio?: boolean }> = ({ deck, audio, assets, index, withAudio }) => {
  const theme = useMemo(() => resolveTheme(deck), [deck]);
  const timeline = useMemo(() => computeTimeline(deck, audio), [deck, audio]);
  ensureFonts(theme);
  const t = timeline.slides[index];
  return (
    <AssetContext.Provider value={assets ?? null}>
      <ThemeContext.Provider value={theme}>
        <SlideView timed={{ ...t, from: 0 }} forceBackground withAudio={withAudio} />
      </ThemeContext.Provider>
    </AssetContext.Provider>
  );
};

export type SvgAssetProps = { deck: DeckSpec; svg: string; width: number; height: number };

/** A deck SVG on a transparent canvas, fully drawn; rasterized to PNG for the PPTX export. */
export const SvgAssetComposition: React.FC<SvgAssetProps> = ({ deck, svg }) => {
  const theme = useMemo(() => resolveTheme(deck), [deck]);
  ensureFonts(theme);
  return (
    <ThemeContext.Provider value={theme}>
      <AbsoluteFill style={{ color: theme.colors.text }}>
        <SvgVisual svg={svg} animate="none" />
      </AbsoluteFill>
    </ThemeContext.Provider>
  );
};
