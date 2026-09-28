// Bundling and rendering through Remotion's Node APIs.
import { bundle } from "@remotion/bundler";
import { ensureBrowser, openBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeTimeline, type AudioManifest } from "../timeline";
import { svgAspect, svgKey } from "../svg-utils";
import { log, type Project } from "./project";

const here = path.dirname(fileURLToPath(import.meta.url));
const ENTRY = path.resolve(here, "../video/index.ts");

export async function bundleProject(p: Project): Promise<string> {
  log("• Bundling video project…");
  let last = -1;
  return bundle({
    entryPoint: ENTRY,
    publicDir: p.assetsDir,
    onProgress: (pct) => {
      if (pct >= last + 25) {
        last = pct;
        log(`  bundle ${pct}%`);
      }
    },
  });
}

export async function prepareBrowser() {
  log("• Checking headless Chrome (downloads once on first use)…");
  await ensureBrowser();
}

export async function renderVideo(
  p: Project,
  serveUrl: string,
  audio: AudioManifest,
  opts: { draft?: boolean; output: string },
): Promise<string> {
  const inputProps = { deck: p.deck, audio };
  const composition = await selectComposition({ serveUrl, id: "Deck", inputProps });
  const secs = (composition.durationInFrames / composition.fps).toFixed(1);
  log(`• Rendering video: ${composition.durationInFrames} frames (${secs}s) at ${composition.width}x${composition.height}${opts.draft ? " [draft, half size]" : ""}`);
  mkdirSync(path.dirname(opts.output), { recursive: true });
  let last = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: opts.output,
    inputProps,
    scale: opts.draft ? 0.5 : 1,
    crf: opts.draft ? 28 : 18,
    jpegQuality: opts.draft ? 70 : 90,
    // Keep audio tracks even when every slide is silent, so muxing into editors behaves.
    enforceAudioTrack: Object.keys(audio).length > 0 || !!p.deck.music,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 100);
      if (pct >= last + 10) {
        last = pct;
        log(`  render ${pct}%`);
      }
    },
  });
  return opts.output;
}

/** Renders the settled final frame of each slide as PNG. Returns paths in slide order. */
export async function renderStills(
  p: Project,
  serveUrl: string,
  opts: { dir: string; only?: number[]; at?: "end" | number; scale?: number },
): Promise<string[]> {
  mkdirSync(opts.dir, { recursive: true });
  const timeline = computeTimeline(p.deck);
  const browser = await openBrowser("chrome");
  const out: string[] = [];
  try {
    for (const t of timeline.slides) {
      if (opts.only && !opts.only.includes(t.index + 1)) continue;
      const inputProps = { deck: p.deck, audio: {}, index: t.index };
      const composition = await selectComposition({ serveUrl, id: "Slide", inputProps, puppeteerInstance: browser });
      const frame =
        opts.at === undefined || opts.at === "end"
          ? composition.durationInFrames - 1
          : Math.min(composition.durationInFrames - 1, Math.round(opts.at * composition.fps));
      const file = path.join(opts.dir, `${String(t.index + 1).padStart(2, "0")}-${t.id}.png`);
      await renderStill({ composition, serveUrl, output: file, inputProps, frame, puppeteerInstance: browser, scale: opts.scale ?? 1 });
      log(`  still ${t.index + 1}/${timeline.slides.length} → ${path.basename(file)}`);
      out.push(file);
    }
  } finally {
    await browser.close({ silent: true });
  }
  return out;
}

/** Rasterizes deck SVGs to transparent PNGs (longest side 2000px). Returns svgKey → file path. */
export async function renderSvgPngs(p: Project, serveUrl: string, svgs: string[], dir: string): Promise<Record<string, string>> {
  mkdirSync(dir, { recursive: true });
  const out: Record<string, string> = {};
  if (!svgs.length) return out;
  const browser = await openBrowser("chrome");
  try {
    for (const svg of svgs) {
      const ar = svgAspect(svg);
      const width = Math.round(ar >= 1 ? 2000 : 2000 * ar);
      const height = Math.round(ar >= 1 ? 2000 / ar : 2000);
      const inputProps = { deck: p.deck, svg, width, height };
      const composition = await selectComposition({ serveUrl, id: "Svg", inputProps, puppeteerInstance: browser });
      const file = path.join(dir, `${svgKey(svg)}.png`);
      await renderStill({ composition, serveUrl, output: file, inputProps, frame: 0, imageFormat: "png", puppeteerInstance: browser });
      out[svgKey(svg)] = file;
    }
    log(`  rasterized ${svgs.length} SVG visual(s) for PowerPoint`);
  } finally {
    await browser.close({ silent: true });
  }
  return out;
}
