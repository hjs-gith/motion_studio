// Which images a deck wants generated, the exact request for each, and where results live.
// Results are cached in assets/generated/manifest.json keyed by a hash of the request, so an image is
// only (re)generated — and billed — when its prompt, style, model, quality or size changes.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { DeckSpec, GenerateSpec } from "../spec";
import { resolveTheme, type Theme } from "../themes";
import { getProvider } from "./index";
import { placeholder, gradientPng } from "./placeholder";
import type { ImageQuality, ImageRequest, ImageUsage } from "./types";

export type ImageTarget = {
  /** Stable key: slide id, or "<id>.left" / "<id>.right" for split columns. */
  key: string;
  slideIndex: number;
  where: string;
  gen: GenerateSpec;
  /** True when the deck also sets `src` explicitly (then src wins and nothing is generated). */
  hasSrc: boolean;
  aspect: number;
  composition: string;
  setSrc: (src: string) => void;
};

export type ImageJob = ImageTarget & { providerId: string; request: ImageRequest; hash: string };

export type ManifestEntry = {
  file: string;
  hash: string;
  provider: string;
  model: string;
  quality: string;
  width: number;
  height: number;
  prompt: string;
  revisedPrompt?: string;
  usage?: ImageUsage;
  costUSD?: number;
  createdAt: string;
};
export type ImageManifest = Record<string, ManifestEntry>;

export const GENERATED_DIR = "generated";

/** Slide/column objects whose `src` was filled in by applyGeneratedImages (not written by the author). */
const autoSrc = new WeakSet<object>();
function srcSetter(owner: { src?: string }) {
  return (src: string) => {
    owner.src = src;
    autoSrc.add(owner);
  };
}
const explicitSrc = (owner: { src?: string }) => !!owner.src && !autoSrc.has(owner);

export function collectTargets(deck: DeckSpec): ImageTarget[] {
  const { width, height } = deck.format;
  const out: ImageTarget[] = [];
  deck.slides.forEach((s, i) => {
    const where = `slide ${i + 1} (${s.id}, ${s.layout})`;
    if (s.layout === "image" && s.generate)
      out.push({
        key: s.id!,
        slideIndex: i,
        where,
        gen: s.generate,
        hasSrc: explicitSrc(s),
        aspect: s.fit === "contain" ? 16 / 10 : width / height,
        composition:
          s.fit === "contain"
            ? "Framed landscape image with a clear focal subject."
            : `Full-bleed ${width >= height ? "widescreen landscape" : "vertical"} background image.${s.title || s.caption ? " Keep the lower third calm and low-detail so overlaid white text stays readable." : ""}`,
        setSrc: srcSetter(s),
      });
    if (s.layout === "image-text" && s.generate && !s.svg)
      out.push({
        key: s.id!,
        slideIndex: i,
        where,
        gen: s.generate,
        hasSrc: explicitSrc(s),
        // The media panel is 46% of the slide width and full height (inset when fit=contain).
        aspect: s.fit === "contain" ? (0.46 * width - 110) / (height - 220) : (0.46 * width) / height,
        composition: "Portrait-oriented image for a half-slide panel; subject centered with some breathing room.",
        setSrc: srcSetter(s),
      });
    if (s.layout === "split")
      for (const side of ["left", "right"] as const) {
        const col = s[side];
        if (col.generate)
          out.push({
            key: `${s.id}.${side}`,
            slideIndex: i,
            where: `${where} ${side} column`,
            gen: col.generate,
            hasSrc: explicitSrc(col),
            aspect: 4 / 3,
            composition: "Landscape image for a card in a two-column comparison; simple, readable at small size.",
            setSrc: srcSetter(col),
          });
      }
  });
  return out;
}

/** House style derived from the theme when deck.images.style isn't set. */
export function themeStyle(theme: Theme): string {
  const c = theme.colors;
  const tone = theme.dark ? "dark, low-key" : "light, airy";
  return theme.style === "minimal"
    ? `Modern minimal editorial look: clean composition, generous negative space, soft natural light, ${tone} tones, restrained muted palette with a single accent color close to ${c.accent}. Understated, calm, uncluttered.`
    : `Bold, vivid, cinematic look: dramatic lighting, rich color and depth, ${tone} overall with accents harmonizing with ${c.accent} and ${c.accent2}.`;
}

export function buildPrompt(deck: DeckSpec, theme: Theme, t: ImageTarget): string {
  const style = t.gen.style ?? deck.images.style ?? themeStyle(theme);
  const parts = [t.gen.prompt.trim(), `Style: ${style}`, `Composition: ${t.composition}`];
  if (!t.gen.allowText) parts.push("Do not include any text, letters, numbers, captions, logos or watermarks.");
  return parts.join("\n\n");
}

export function planJobs(deck: DeckSpec, opts: { providerOverride?: string } = {}): ImageJob[] {
  const theme = resolveTheme(deck);
  return collectTargets(deck).map((t) => {
    const providerId = opts.providerOverride ?? t.gen.provider ?? deck.images.provider;
    const provider = getProvider(providerId);
    const model = t.gen.model ?? (providerId === deck.images.provider ? deck.images.model : undefined) ?? provider.defaultModel;
    const quality = (t.gen.quality ?? deck.images.quality) as ImageQuality;
    const base = 1600;
    const size = provider.normalizeSize(t.aspect >= 1 ? base : base * t.aspect, t.aspect >= 1 ? base / t.aspect : base);
    const request: ImageRequest = {
      prompt: buildPrompt(deck, theme, t),
      model,
      quality,
      width: size.width,
      height: size.height,
      background: t.gen.background ?? "opaque",
      palette: [theme.colors.bg2, theme.colors.bg, theme.colors.accent],
    };
    const hash = createHash("sha1")
      .update(JSON.stringify([providerId, request.model, request.quality, request.width, request.height, request.background, request.prompt]))
      .digest("hex")
      .slice(0, 12);
    return { ...t, providerId, request, hash };
  });
}

export function manifestFile(assetsDir: string) {
  return path.join(assetsDir, GENERATED_DIR, "manifest.json");
}

export function readImageManifest(assetsDir: string): ImageManifest {
  const f = manifestFile(assetsDir);
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {};
}

export function writeImageManifest(assetsDir: string, m: ImageManifest) {
  mkdirSync(path.join(assetsDir, GENERATED_DIR), { recursive: true });
  writeFileSync(manifestFile(assetsDir), JSON.stringify(m, null, 2) + "\n");
}

export function isReady(job: ImageJob, manifest: ImageManifest, assetsDir: string): boolean {
  const e = manifest[job.key];
  return !!e && e.hash === job.hash && existsSync(path.join(assetsDir, e.file));
}

/**
 * Points every `generate` slide at its generated image, or at a local placeholder when the image hasn't
 * been generated yet (so the deck always renders). Returns the jobs still waiting for generation.
 */
export function applyGeneratedImages(deck: DeckSpec, assetsDir: string): ImageJob[] {
  const targets = collectTargets(deck);
  if (!targets.length) return [];
  let jobs: ImageJob[];
  try {
    jobs = planJobs(deck);
  } catch (e) {
    // Unknown provider etc.: fall back to placeholders; `motionstudio images` reports the error.
    jobs = planJobs(deck, { providerOverride: "placeholder" });
    void e;
  }
  const manifest = readImageManifest(assetsDir);
  const theme = resolveTheme(deck);
  const pending: ImageJob[] = [];
  for (const job of jobs) {
    if (job.hasSrc) continue;
    if (isReady(job, manifest, assetsDir)) {
      job.setSrc(manifest[job.key].file);
      continue;
    }
    pending.push(job);
    const ph = placeholder.normalizeSize(job.request.width, job.request.height);
    const tag = createHash("sha1").update(`${theme.colors.bg}${theme.colors.bg2}${theme.colors.accent}${ph.width}x${ph.height}`).digest("hex").slice(0, 8);
    const rel = `${GENERATED_DIR}/placeholder-${job.key.replace(/[^\w.-]/g, "_")}-${tag}.png`;
    const abs = path.join(assetsDir, rel);
    if (!existsSync(abs)) {
      mkdirSync(path.dirname(abs), { recursive: true });
      writeFileSync(abs, gradientPng(ph.width, ph.height, theme.colors.bg2, theme.colors.bg, theme.colors.accent));
    }
    job.setSrc(rel);
  }
  return pending;
}
