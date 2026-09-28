import React from "react";
import { Composition, type CalculateMetadataFunction } from "remotion";
import { parseDeck } from "../spec";
import { computeTimeline } from "../timeline";
import { DeckComposition, SingleSlideComposition, SvgAssetComposition, type DeckProps, type SingleSlideProps, type SvgAssetProps } from "./Deck";

const PLACEHOLDER: DeckProps = {
  deck: parseDeck({ title: "Placeholder", slides: [{ layout: "title", title: "motion-studio" }] }),
  audio: {},
};

const deckMetadata: CalculateMetadataFunction<DeckProps> = ({ props }) => {
  const tl = computeTimeline(props.deck, props.audio);
  return { durationInFrames: tl.totalFrames, fps: tl.fps, width: props.deck.format.width, height: props.deck.format.height };
};

const slideMetadata: CalculateMetadataFunction<SingleSlideProps> = ({ props }) => {
  const tl = computeTimeline(props.deck, props.audio);
  const s = tl.slides[props.index] ?? tl.slides[0];
  return { durationInFrames: s.durationInFrames, fps: tl.fps, width: props.deck.format.width, height: props.deck.format.height };
};

const svgMetadata: CalculateMetadataFunction<SvgAssetProps> = ({ props }) => ({ width: props.width, height: props.height, durationInFrames: 1, fps: 30 });

export const Root: React.FC = () => (
  <>
    <Composition
      id="Deck"
      component={DeckComposition as React.FC<Record<string, unknown>>}
      defaultProps={PLACEHOLDER as unknown as Record<string, unknown>}
      calculateMetadata={deckMetadata as unknown as CalculateMetadataFunction<Record<string, unknown>>}
      durationInFrames={120}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="Slide"
      component={SingleSlideComposition as unknown as React.FC<Record<string, unknown>>}
      defaultProps={{ ...PLACEHOLDER, index: 0 } as unknown as Record<string, unknown>}
      calculateMetadata={slideMetadata as unknown as CalculateMetadataFunction<Record<string, unknown>>}
      durationInFrames={120}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="Svg"
      component={SvgAssetComposition as unknown as React.FC<Record<string, unknown>>}
      defaultProps={{ deck: PLACEHOLDER.deck, svg: "<svg viewBox='0 0 10 10'/>", width: 160, height: 90 } as unknown as Record<string, unknown>}
      calculateMetadata={svgMetadata as unknown as CalculateMetadataFunction<Record<string, unknown>>}
      durationInFrames={1}
      fps={30}
      width={160}
      height={90}
    />
  </>
);
