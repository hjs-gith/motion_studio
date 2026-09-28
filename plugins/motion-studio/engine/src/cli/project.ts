// Locating a deck project on disk: deck.json, assets/, assets/audio/, out/.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ZodError } from "zod";
import { parseDeck, type DeckSpec, type SlideSpec } from "../spec";
import type { AudioManifest } from "../timeline";
import { applyGeneratedImages, type ImageJob } from "../images/jobs";
import { prepareSpeech, type PreparedSpeech } from "../pronounce";

export type Project = {
  deckPath: string;
  dir: string;
  assetsDir: string;
  audioDir: string;
  outDir: string;
  slug: string;
  deck: DeckSpec;
  /** Generated images not created yet (the slides currently show placeholders). */
  pendingImages: ImageJob[];
};

export function loadProject(target: string, outDir?: string): Project {
  let deckPath = path.resolve(target);
  if (existsSync(deckPath) && statSync(deckPath).isDirectory()) deckPath = path.join(deckPath, "deck.json");
  if (!existsSync(deckPath)) throw new Error(`Deck not found: ${deckPath}`);
  const raw = JSON.parse(readFileSync(deckPath, "utf8"));
  let deck: DeckSpec;
  try {
    deck = parseDeck(raw);
  } catch (e) {
    if (e instanceof ZodError) throw new Error(`Invalid deck ${deckPath}:\n${formatZod(e, raw)}`);
    throw e;
  }
  const dir = path.dirname(deckPath);
  const assetsDir = path.join(dir, "assets");
  mkdirSync(assetsDir, { recursive: true });
  inlineSvgFiles(deck, assetsDir);
  const pendingImages = applyGeneratedImages(deck, assetsDir);
  return {
    deckPath,
    dir,
    assetsDir,
    audioDir: path.join(assetsDir, "audio"),
    outDir: path.resolve(outDir ?? path.join(dir, "out")),
    slug: slugify(deck.title) || "deck",
    deck,
    pendingImages,
  };
}

/** Reads referenced .svg files into the deck so the renderer can animate them inline. */
function inlineSvgFiles(deck: DeckSpec, assetsDir: string) {
  const read = (ref: string, where: string) => {
    const file = path.join(assetsDir, ref.replace(/^\.?\/?(assets\/)?/, ""));
    if (!existsSync(file)) throw new Error(`${where}: SVG file not found in assets/: ${ref}`);
    return readFileSync(file, "utf8");
  };
  deck.slides.forEach((s, i) => {
    const where = `Slide ${i + 1} (${s.id}, ${s.layout})`;
    if (s.layout === "visual" && !s.svg && s.src) {
      if (!/\.svg$/i.test(s.src)) throw new Error(`${where}: "visual" needs an SVG; use the "image" or "image-text" layout for ${s.src}`);
      s.svg = read(s.src, where);
    }
    if (s.layout === "image-text" && !s.svg && s.src && /\.svg$/i.test(s.src)) s.svg = read(s.src, where);
    if (s.layout === "cards") for (const c of s.cards) if (c.icon && /\.svg$/i.test(c.icon.trim())) c.icon = read(c.icon.trim(), where);
  });
}

function formatZod(e: ZodError, raw: { slides?: SlideSpec[] }): string {
  return e.issues
    .map((i) => {
      const p = i.path.join(".");
      const m = /^slides\.(\d+)/.exec(p);
      const where = m && raw.slides?.[+m[1]] ? ` (slide ${+m[1] + 1}, layout "${raw.slides[+m[1]].layout}")` : "";
      return `  - ${p || "(root)"}${where}: ${i.message}`;
    })
    .join("\n");
}

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60);
}

/** What the TTS will actually say for a narration (lexicon, acronyms, language segments applied). */
export function speechFor(deck: DeckSpec, narration: string): PreparedSpeech {
  const v = deck.voice;
  const prepared = prepareSpeech(narration, { lang: deck.lang, lexicon: v.lexicon, spellAcronyms: v.spellAcronyms, splitLatinPhrases: v.splitLatinPhrases });
  // macOS `say` renders one voice per file, so segments are joined.
  if (v.engine === "say") return { ...prepared, segments: [{ text: prepared.segments.map((s) => s.text).join(" "), lang: deck.lang }] };
  return prepared;
}

/** Cache key for a clip: hashes the spoken segments, so lexicon edits only re-voice affected slides. */
export function narrationHash(deck: DeckSpec, narration: string): string {
  const v = deck.voice;
  return createHash("sha1")
    .update(JSON.stringify([v.engine, v.voice ?? "", v.speed, deck.lang, speechFor(deck, narration).segments]))
    .digest("hex")
    .slice(0, 16);
}

export function manifestPath(p: Project) {
  return path.join(p.audioDir, "manifest.json");
}

export function readManifest(p: Project): AudioManifest {
  const f = manifestPath(p);
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {};
}

export function writeManifest(p: Project, m: AudioManifest) {
  mkdirSync(p.audioDir, { recursive: true });
  writeFileSync(manifestPath(p), JSON.stringify(m, null, 2));
}

/** Audio clips that still match the current narration text and voice settings. */
export function currentAudio(p: Project, warn = true): AudioManifest {
  if (p.deck.voice.engine === "none") return {};
  const m = readManifest(p);
  const out: AudioManifest = {};
  const stale: string[] = [];
  for (const s of p.deck.slides) {
    if (!s.narration) continue;
    const clip = m[s.id!];
    if (!clip) continue;
    if (clip.hash !== narrationHash(p.deck, s.narration) || !existsSync(path.join(p.assetsDir, clip.file))) {
      stale.push(s.id!);
      continue;
    }
    out[s.id!] = clip;
  }
  if (warn && stale.length) console.warn(`! Narration audio is stale for: ${stale.join(", ")} — run \`motionstudio tts\` to refresh.`);
  const missing = p.deck.slides.filter((s) => s.narration && !out[s.id!] && !stale.includes(s.id!)).map((s) => s.id);
  if (warn && missing.length) console.warn(`! No narration audio for: ${missing.join(", ")} — run \`motionstudio tts\`.`);
  return out;
}

/** Duration of a PCM WAV file in seconds, read from its header. */
export function wavDuration(file: string): number {
  const buf = readFileSync(file);
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") throw new Error(`Not a WAV file: ${file}`);
  let off = 12;
  let byteRate = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    let size = buf.readUInt32LE(off + 4);
    if (id === "fmt ") byteRate = buf.readUInt32LE(off + 16);
    if (id === "data") {
      if (size === 0 || size === 0xffffffff || off + 8 + size > buf.length) size = buf.length - off - 8;
      return size / byteRate;
    }
    off += 8 + size + (size % 2);
  }
  throw new Error(`No data chunk in ${file}`);
}

export function log(msg: string) {
  process.stderr.write(msg + "\n");
}
