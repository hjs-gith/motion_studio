// Pure timing math shared by the renderer, the HTML player and the script/SRT exporters.
import type { DeckSpec, SlideSpec, TransitionSpec } from "./spec";

export type AudioClip = { file: string; durationSec: number };
export type AudioManifest = Record<string, AudioClip & { hash: string }>;

export type TimedSlide = {
  index: number;
  id: string;
  slide: SlideSpec;
  /** Absolute start frame in the full video. */
  from: number;
  durationInFrames: number;
  /** Frames of the outgoing transition that overlap the next slide (0 for the last slide). */
  transitionOut: number;
  transition: TransitionSpec;
  audio?: AudioClip;
  /** Frame (relative to slide start) at which narration begins. */
  audioStart: number;
};

export type Timeline = { fps: number; totalFrames: number; slides: TimedSlide[] };

/** Narration starts this long after the slide appears. */
export const AUDIO_LEAD_SEC = 0.35;
/** Silence kept after narration ends, before the next transition starts. */
export const AUDIO_TAIL_SEC = 0.6;

/**
 * Whether narration subtitles are burned into the video. `deck.captions` decides when set; otherwise
 * they are on for videos without voice (no audio clips) so the narration still reaches the viewer.
 */
export function captionsOn(deck: DeckSpec, audio: AudioManifest): boolean {
  return deck.captions ?? Object.keys(audio).length === 0;
}

/** Default on-screen time when there is no narration, by layout. */
export function defaultDuration(s: SlideSpec): number {
  switch (s.layout) {
    case "title":
    case "end":
    case "section":
      return 4;
    case "bullets":
      return 3 + s.bullets.length * 1.2;
    case "timeline":
      return 3 + s.items.length * 1.2;
    case "stat":
      return 3 + s.stats.length;
    case "chart":
      return 6;
    case "code":
      return 4 + Math.min(8, s.code.split("\n").length * 0.35);
    case "agenda":
      return 3 + s.items.length * 0.7;
    case "cards":
      return 3 + s.cards.length * 1.3;
    case "comparison":
      return 4 + s.rows.length * 0.8;
    case "visual":
      return 7;
    default:
      return 5;
  }
}

/** Rough reading-speed estimate used when no TTS audio exists (~2.6 words/s, CJK ~7 chars/s). */
export function estimateSpeechSec(text: string): number {
  const cjk = (text.match(/[぀-ヿ㐀-鿿가-힯]/g) ?? []).length;
  const words = text.replace(/[぀-ヿ㐀-鿿가-힯]/g, " ").split(/\s+/).filter(Boolean).length;
  return words / 2.6 + cjk / 7;
}

/** Slides with narration but no audio clip are paced by estimated reading time unless estimateNarration is false. */
export function computeTimeline(deck: DeckSpec, audio: AudioManifest = {}, opts: { estimateNarration?: boolean } = {}): Timeline {
  const fps = deck.format.fps;
  const leadFrames = Math.round(AUDIO_LEAD_SEC * fps);
  let cursor = 0;
  const slides: TimedSlide[] = deck.slides.map((slide, index) => {
    const id = slide.id!;
    const isLast = index === deck.slides.length - 1;
    const transition: TransitionSpec = { ...deck.transition, ...(slide.transition ?? {}) } as TransitionSpec;
    const transitionOut = isLast || transition.type === "none" ? 0 : Math.round(transition.durationSec * fps);

    const clip = audio[id];
    let speech = clip?.durationSec ?? 0;
    if (!clip && opts.estimateNarration !== false && slide.narration) speech = estimateSpeechSec(slide.narration);

    const minSec = slide.durationSec ?? defaultDuration(slide);
    const fitSpeechFrames = speech > 0 ? leadFrames + Math.ceil((speech + AUDIO_TAIL_SEC) * fps) + transitionOut : 0;
    const durationInFrames = Math.max(Math.round(minSec * fps), fitSpeechFrames, transitionOut + fps);

    const t: TimedSlide = {
      index,
      id,
      slide,
      from: cursor,
      durationInFrames,
      transitionOut,
      transition,
      audio: clip ? { file: clip.file, durationSec: clip.durationSec } : undefined,
      audioStart: leadFrames,
    };
    cursor += durationInFrames - transitionOut;
    return t;
  });
  return { fps, totalFrames: Math.max(1, cursor), slides };
}

export function formatTimestamp(frames: number, fps: number, srt = false): string {
  const totalMs = Math.round((frames / fps) * 1000);
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return srt ? `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}` : `${h ? pad(h) + ":" : ""}${pad(m)}:${pad(s)}`;
}

/** Splits narration into caption cues with durations proportional to their length. */
export function captionCues(text: string, startFrame: number, lengthFrames: number): { text: string; from: number; to: number }[] {
  const sentences = text
    // Stage directions like [pause] and markdown emphasis are for the voice, not the viewer.
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\*\*|__/g, "")
    .split(/(?<=[.!?。！？])\s+|\n+/)
    .flatMap((s) => chunk(s.trim(), 90))
    .filter(Boolean);
  const total = sentences.reduce((a, s) => a + s.length, 0) || 1;
  let at = startFrame;
  return sentences.map((s) => {
    const len = Math.max(1, Math.round((s.length / total) * lengthFrames));
    const cue = { text: s, from: at, to: at + len };
    at += len;
    return cue;
  });
}

function chunk(s: string, max: number): string[] {
  if (s.length <= max) return [s];
  const words = s.split(" ");
  if (words.length === 1) return s.match(new RegExp(`.{1,${max}}`, "g")) ?? [s];
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max && cur) {
      out.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) out.push(cur);
  return out;
}
