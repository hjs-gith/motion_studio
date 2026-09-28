// Builds a single self-contained HTML file: the slide player bundle, deck data and inlined assets.
import { build } from "esbuild";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DeckSpec } from "../spec";
import type { AudioManifest } from "../timeline";
import { resolveTheme } from "../themes";

const here = path.dirname(fileURLToPath(import.meta.url));
const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
};

function collectAssetRefs(deck: DeckSpec, audio: AudioManifest, withAudio: boolean): string[] {
  const refs = new Set<string>();
  for (const s of deck.slides) {
    if (s.layout === "image" && s.src) refs.add(s.src);
    if (s.layout === "split") for (const c of [s.left, s.right]) if (c.src) refs.add(c.src);
    if ((s.layout === "image-text" && !s.svg && s.src) || (s.layout === "quote" && s.src)) refs.add(s.src);
  }
  if (withAudio) {
    for (const clip of Object.values(audio)) refs.add(clip.file);
    if (deck.music) refs.add(deck.music.src);
  }
  return [...refs].filter((r) => !/^(https?:|data:)/.test(r));
}

export async function exportHtml(
  deck: DeckSpec,
  audio: AudioManifest,
  assetsDir: string,
  output: string,
  opts: { withAudio?: boolean } = {},
): Promise<string> {
  const withAudio = !!opts.withAudio && Object.keys(audio).length > 0;
  const assets: Record<string, string> = {};
  for (const ref of collectAssetRefs(deck, audio, withAudio)) {
    const file = path.join(assetsDir, ref.replace(/^\.?\/?(assets\/)?/, ""));
    if (!existsSync(file)) {
      console.warn(`! Missing asset for HTML export: ${ref}`);
      continue;
    }
    const mime = MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
    assets[ref] = `data:${mime};base64,${readFileSync(file).toString("base64")}`;
  }

  const result = await build({
    entryPoints: [path.resolve(here, "../html/entry.tsx")],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: "es2020",
    minify: true,
    jsx: "automatic",
    legalComments: "none",
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "error",
  });
  const js = result.outputFiles[0].text;
  const theme = resolveTheme(deck);
  const payload = JSON.stringify({ deck, audio: withAudio ? audio : {}, assets, withAudio }).replace(/</g, "\\u003c");
  const title = deck.title.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const html = `<!doctype html>
<html lang="${deck.lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>html,body{margin:0;height:100%;background:${theme.colors.bg};overflow:hidden}#root{height:100%}</style>
</head>
<body>
<div id="root"></div>
<script>window.__MOTION_STUDIO__=${payload};</script>
<script>${js.replace(/<\/script/gi, "<\\/script")}</script>
</body>
</html>
`;
  writeFileSync(output, html);
  return output;
}
