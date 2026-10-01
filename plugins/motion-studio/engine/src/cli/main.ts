// motion-studio CLI. Invoked through the plugin's bin/motionstudio wrapper.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { Deck, annotationParts, bulletText, type DeckSpec } from "../spec";
import { PRESETS } from "../themes";
import { captionsOn, computeTimeline, estimateSpeechSec, formatTimestamp } from "../timeline";
import { exportHtml } from "../export/html";
import { exportPdf } from "../export/pdf";
import { exportPptx } from "../export/pptx";
import { scriptMarkdown, slideHeadline, srt } from "../export/script";
import { currentAudio, loadProject, log, speechFor, type Project } from "./project";
import { bundleProject, prepareBrowser, renderStills, renderSvgPngs, renderVideo } from "./remotion";
import { collectSvgs, looksLikeSvg, svgAspect } from "../svg-utils";
import { generateNarration, previewNarration, studioHome, venvPython } from "./tts";
import { STARTER_DECK } from "./starter";
import { describeProviders, runImages } from "./images";

/** Directory the user invoked the CLI from (the wrapper runs us from the engine dir). */
const USER_CWD = process.env.MOTION_STUDIO_CWD ?? process.cwd();
const userPath = (p: string) => path.resolve(USER_CWD, p);

const ALL_FORMATS = ["video", "html", "pptx", "pdf", "script"] as const;
type Format = (typeof ALL_FORMATS)[number];

const HELP = `motionstudio — presentations, scripts and motion-graphics video from one deck.json

Usage:
  motionstudio init <dir> [--title "…"] [--theme midnight]   Scaffold a deck project
  motionstudio validate <deck.json>                           Check the deck and print a timing summary
  motionstudio tts <deck.json> [--force] [--only s01,s02] [--preview]
                                                              Generate narration audio (--preview: show spoken text only)
  motionstudio images <deck.json> [--yes] [--force] [--only id] [--provider id] [--prompts]
                                                              Plan / generate images for slides with "generate" (paid: needs --yes)
  motionstudio stills <deck.json> [--slides 1,3] [--at 2.5] [--scale 0.5]
                                                              Render PNG previews of slides (for review)
  motionstudio render <deck.json> [--formats video,html,pptx,pdf,script] [--draft] [--html-audio] [--no-voice] [--out dir]
                                                              Render outputs (default: all formats; --no-voice: leave
                                                              narration audio out, subtitles on, timing from the text)
  motionstudio schema                                         Print the deck JSON schema
  motionstudio themes                                         List theme presets
  motionstudio doctor                                         Check the rendering and TTS environment
  motionstudio setup [--tts supertonic]                       Install the engine / Supertonic TTS (wrapper)
`;

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      title: { type: "string" },
      theme: { type: "string" },
      formats: { type: "string" },
      out: { type: "string" },
      draft: { type: "boolean" },
      "html-audio": { type: "boolean" },
      "no-voice": { type: "boolean" },
      force: { type: "boolean" },
      only: { type: "string" },
      slides: { type: "string" },
      yes: { type: "boolean" },
      provider: { type: "string" },
      prompts: { type: "boolean" },
      preview: { type: "boolean" },
      at: { type: "string" },
      scale: { type: "string" },
    },
  });
  const target = userPath(positionals[0] ?? ".");
  const outDir = values.out ? userPath(values.out) : undefined;

  switch (cmd) {
    case "init":
      return init(target, values.title, values.theme);
    case "validate":
      return validate(loadProject(target));
    case "tts":
      if (values.preview) return previewNarration(loadProject(target), values.only?.split(",").map((s) => s.trim()));
      return generateNarration(loadProject(target), { force: values.force, only: values.only?.split(",").map((s) => s.trim()) });
    case "images":
      return runImages(loadProject(target), {
        yes: values.yes,
        force: values.force,
        only: values.only?.split(",").map((s) => s.trim()),
        provider: values.provider,
        showPrompts: values.prompts,
      });
    case "stills": {
      const p = loadProject(target, outDir);
      await prepareBrowser();
      const serveUrl = await bundleProject(p);
      const files = await renderStills(p, serveUrl, {
        dir: path.join(p.outDir, "stills"),
        only: values.slides?.split(",").map((n) => parseInt(n, 10)),
        at: values.at ? parseFloat(values.at) : "end",
        scale: values.scale ? parseFloat(values.scale) : 0.5,
      });
      console.log(files.join("\n"));
      return;
    }
    case "render":
      return render(loadProject(target, outDir), {
        formats: parseFormats(values.formats),
        draft: values.draft,
        htmlAudio: values["html-audio"],
        noVoice: values["no-voice"],
      });
    case "schema":
      console.log(JSON.stringify(z.toJSONSchema(Deck, { io: "input" }), null, 2));
      return;
    case "themes":
      for (const t of Object.values(PRESETS))
        console.log(`${t.name.padEnd(13)} ${t.style.padEnd(10)} ${t.dark ? "dark " : "light"}  bg ${t.colors.bg}  accent ${t.colors.accent}/${t.colors.accent2}  fonts ${t.fonts.heading} + ${t.fonts.body}  background ${t.background}`);
      return;
    case "doctor":
      return doctor();
    case "ensure-browser":
      return prepareBrowser();
    case undefined:
    case "help":
    case "--help":
    case "-h":
      console.log(HELP);
      return;
    default:
      console.error(`Unknown command: ${cmd}\n\n${HELP}`);
      process.exit(2);
  }
}

function parseFormats(s?: string): Format[] {
  if (!s || s === "all") return [...ALL_FORMATS];
  const list = s.split(",").map((x) => x.trim()) as Format[];
  for (const f of list) if (!ALL_FORMATS.includes(f)) throw new Error(`Unknown format "${f}". Use: ${ALL_FORMATS.join(", ")}`);
  return list;
}

function init(dir: string, title?: string, theme?: string) {
  const abs = path.resolve(dir);
  const deckPath = path.join(abs, "deck.json");
  if (existsSync(deckPath)) throw new Error(`${deckPath} already exists`);
  mkdirSync(path.join(abs, "assets"), { recursive: true });
  const deck = structuredClone(STARTER_DECK) as Record<string, unknown> & { theme: { preset: string } };
  if (title) deck.title = title;
  if (theme) {
    if (!PRESETS[theme]) throw new Error(`Unknown theme "${theme}". Available: ${Object.keys(PRESETS).join(", ")}`);
    deck.theme.preset = theme;
  }
  writeFileSync(deckPath, JSON.stringify(deck, null, 2) + "\n");
  console.log(deckPath);
}

function validate(p: Project) {
  const { deck } = p;
  const audio = currentAudio(p, false);
  const tl = computeTimeline(deck, audio, { estimateNarration: true });
  const warnings = lint(p);
  const words = deck.slides.reduce((a, s) => a + (s.narration?.split(/\s+/).filter(Boolean).length ?? 0), 0);
  console.log(`✔ ${path.relative(USER_CWD, p.deckPath) || p.deckPath} is valid`);
  console.log(
    `  "${deck.title}" · ${deck.slides.length} slides · ${deck.format.width}x${deck.format.height}@${deck.format.fps} · theme ${deck.theme.preset} · voice ${deck.voice.engine}`,
  );
  const subs = captionsOn(deck, audio);
  console.log(
    `  Video subtitles ${subs ? "burned in" : "off"}${deck.captions === undefined ? ` (auto: ${subs ? "no voice audio" : "narrated"})` : ""} · SRT written with video/script`,
  );
  console.log(`  Estimated runtime ${formatTimestamp(tl.totalFrames, tl.fps)} · narration ~${words} words · audio clips ready ${Object.keys(audio).length}`);
  console.log("");
  for (const t of tl.slides) {
    const secs = (t.durationInFrames / tl.fps).toFixed(1).padStart(5);
    const src = t.audio ? "audio" : t.slide.narration ? "est. " : "     ";
    console.log(`  ${String(t.index + 1).padStart(2)} ${t.id!.padEnd(12)} ${t.slide.layout.padEnd(9)} ${secs}s ${src}  ${slideHeadline(t.slide).slice(0, 60)}`);
  }
  if (p.pendingImages.length)
    warnings.push(
      `${p.pendingImages.length} generated image(s) not created yet (${p.pendingImages.map((j) => j.key).join(", ")}); slides show placeholders — run \`motionstudio images\``,
    );
  if (warnings.length) {
    console.log(`\n  ${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`  ! ${w}`);
  }
}

/**
 * Korean respellings of English terms drop the plural -s and past-tense -ed ("Skills Map" → 스킬 맵,
 * not 스킬스 맵). Suggests entries for flagged inflected words, reusing the base word's respelling
 * when the lexicon already has it.
 */
function inflectionHint(lang: string, words: string[], lexicon: Record<string, string>): string {
  if (!lang.toLowerCase().startsWith("ko")) return "";
  const lower = new Map(Object.entries(lexicon).map(([k, v]) => [k.toLowerCase(), v]));
  const hints: string[] = [];
  for (const word of words) {
    const m = /^([A-Za-z][A-Za-z-]*?)(ies|es|s|ed)$/.exec(word);
    if (!m || /ss$/i.test(word) || m[1].length < 3) continue;
    const bases = m[2] === "ies" ? [m[1] + "y"] : m[2] === "es" ? [m[1], m[1] + "e"] : m[2] === "ed" ? [m[1], m[1] + "e"] : [m[1]];
    const known = bases.find((b) => lower.has(b.toLowerCase()));
    hints.push(known ? `"${word}": "${lower.get(known.toLowerCase())}"` : `${word} → spell as ${bases[0]}`);
  }
  if (!hints.length) return "";
  return `. Korean respellings drop -s/-ed (Skills → 스킬, Agents → 에이전트): ${hints.join(", ")}`;
}

function lint(p: Project): string[] {
  const { deck } = p;
  const w: string[] = [];
  const asset = (src: string) => /^(https?:|data:)/.test(src) || existsSync(path.join(p.assetsDir, src.replace(/^\.?\/?(assets\/)?/, "")));
  deck.slides.forEach((s, i) => {
    const at = `slide ${i + 1} (${s.id}, ${s.layout})`;
    if ("title" in s && s.title && [...s.title].length > 70) w.push(`${at}: title is ${[...s.title].length} chars; keep under ~60 for impact`);
    if (s.layout === "bullets") {
      if (s.bullets.length > 6) w.push(`${at}: ${s.bullets.length} bullets; 3–5 read best`);
      s.bullets.forEach((b, j) => {
        if ([...bulletText(b).text].length > 90) w.push(`${at}: bullet ${j + 1} is long; move detail to "sub" or narration`);
      });
    }
    if (s.layout === "image" && s.src && !asset(s.src)) w.push(`${at}: image not found in assets/: ${s.src}`);
    if (s.layout === "split") for (const c of [s.left, s.right]) if (c.src && !asset(c.src)) w.push(`${at}: image not found in assets/: ${c.src}`);
    if (s.layout === "chart") {
      for (const ser of s.chart.series)
        if (ser.values.length !== s.chart.labels.length) w.push(`${at}: series "${ser.name}" has ${ser.values.length} values for ${s.chart.labels.length} labels`);
    }
    if (s.layout === "statement" && [...s.text].length > 180) w.push(`${at}: statement is long; aim for one sentence`);
    if ((s.layout === "image-text" || s.layout === "quote") && s.src && !/\.svg$/i.test(s.src) && !asset(s.src)) w.push(`${at}: image not found in assets/: ${s.src}`);
    if (s.layout === "comparison")
      s.rows.forEach((r) => {
        if (r.values.length !== s.columns.length) w.push(`${at}: row "${r.label}" has ${r.values.length} values for ${s.columns.length} columns`);
      });
    if (s.layout === "agenda" && s.active && s.active > s.items.length) w.push(`${at}: active ${s.active} is beyond the ${s.items.length} items`);
    const svgs = [
      ...(s.layout === "visual" || s.layout === "image-text" ? [s.svg] : []),
      ...(s.layout === "cards" ? s.cards.map((c) => c.icon) : []),
    ].filter(looksLikeSvg);
    for (const svg of svgs) {
      if (!/viewBox/i.test(/<svg\b[^>]*>/i.exec(svg)?.[0] ?? "")) w.push(`${at}: SVG has no viewBox on the root <svg>; it may not scale correctly`);
      if (/<script|\son[a-z]+=/i.test(svg)) w.push(`${at}: SVG contains scripts/event handlers; they are stripped`);
      if (/font-family/i.test(svg)) w.push(`${at}: SVG sets font-family; omit it so text uses the theme font`);
      if (/#[0-9a-f]{6}\b/i.test(svg) && !/var\(--/.test(svg) && !/currentColor/.test(svg)) w.push(`${at}: SVG uses fixed hex colors only; use var(--accent), var(--text), var(--muted)… so it follows the theme`);
    }
    if (s.layout === "visual" && s.svg && s.position === "center" && svgAspect(s.svg) < 1.2) w.push(`${at}: tall SVG in a centered visual; use a wide viewBox (≈16:9) or position left/right with notes`);
    if (deck.voice.engine !== "none" && s.narration) {
      const unknown = speechFor(deck, s.narration).unknownWords;
      if (unknown.length)
        w.push(
          `${at}: English words will be read with ${deck.lang} rules: ${unknown.join(", ")}; add spoken forms to voice.lexicon (check with \`motionstudio tts --preview\`)` +
            inflectionHint(deck.lang, unknown, deck.voice.lexicon),
        );
    }
    const notes = (s.annotations ?? []).map((a) => annotationParts(a).display);
    if (notes.length > 3) w.push(`${at}: ${notes.length} annotations crowd the footer; keep 1–3 and move the rest to notes`);
    notes.forEach((t, j) => {
      if ([...t].length > 160) w.push(`${at}: annotation ${j + 1} is ${[...t].length} chars; shorten it (author, title, year) and put the full citation in notes`);
    });
    if (deck.voice.engine !== "none" && !s.narration) w.push(`${at}: no narration while a voice engine is set (slide will be silent)`);
    if (s.narration && s.durationSec && estimateSpeechSec(s.narration) > s.durationSec + 0.5)
      w.push(`${at}: narration (~${estimateSpeechSec(s.narration).toFixed(1)}s) is longer than durationSec ${s.durationSec}; the slide will be extended`);
  });
  if (deck.music && !asset(deck.music.src)) w.push(`music not found in assets/: ${deck.music.src}`);
  return w;
}

async function render(p: Project, opts: { formats: Format[]; draft?: boolean; htmlAudio?: boolean; noVoice?: boolean }) {
  mkdirSync(p.outDir, { recursive: true });
  if (p.pendingImages.length)
    log(`! ${p.pendingImages.length} slide image(s) are placeholders (not generated yet): ${p.pendingImages.map((j) => j.key).join(", ")}. Run \`motionstudio images\` first for final output.`);
  // --no-voice: render as if the deck had no voice (silent video with subtitles, no HTML audio).
  if (opts.noVoice) {
    p.deck.voice.engine = "none";
    log("• No voice: narration audio left out; timing follows the narration text and subtitles are on (unless captions is false).");
  }
  const audio = currentAudio(p);
  const tl = computeTimeline(p.deck, audio, { estimateNarration: true });
  const hasNarration = p.deck.slides.some((s) => s.narration);
  const out = (ext: string) => path.join(p.outDir, `${p.slug}${ext}`);
  const results: string[] = [];
  const t0 = Date.now();

  if (opts.formats.includes("script")) {
    writeFileSync(out("-script.md"), scriptMarkdown(p.deck, tl));
    results.push(out("-script.md"));
  }
  // Subtitles: a sidecar SRT matching the video's timing, written with the script and with every video.
  if (hasNarration && (opts.formats.includes("script") || opts.formats.includes("video"))) {
    writeFileSync(out(".srt"), srt(computeTimeline(p.deck, audio)));
    results.push(out(".srt"));
  }
  // Headless-Chrome work (video, PDF stills, SVG rasterizing for PPTX) shares one bundle.
  let serveUrl: string | undefined;
  const bundled = async () => {
    if (!serveUrl) {
      await prepareBrowser();
      serveUrl = await bundleProject(p);
    }
    return serveUrl;
  };
  if (opts.formats.includes("pptx")) {
    const svgs = collectSvgs(p.deck as unknown as { slides: Array<Record<string, unknown>> });
    const svgImages = svgs.length ? await renderSvgPngs(p, await bundled(), svgs, path.join(p.outDir, ".svg-png")) : {};
    log("• Writing PowerPoint…");
    results.push(await exportPptx(p.deck, p.assetsDir, out(".pptx"), svgImages));
  }
  if (opts.formats.includes("html")) {
    log("• Building HTML deck…");
    results.push(await exportHtml(p.deck, audio, p.assetsDir, out(".html"), { withAudio: opts.htmlAudio }));
  }
  if (opts.formats.includes("video") || opts.formats.includes("pdf")) {
    const serveUrl = await bundled();
    if (opts.formats.includes("pdf")) {
      log("• Rendering slide stills for PDF…");
      const stills = await renderStills(p, serveUrl, { dir: path.join(p.outDir, "stills"), scale: 1 });
      results.push(await exportPdf(p.deck, stills, out(".pdf")));
    }
    if (opts.formats.includes("video")) {
      results.push(await renderVideo(p, serveUrl, audio, { draft: opts.draft, output: out(opts.draft ? "-draft.mp4" : ".mp4") }));
    }
  }
  log(`✔ Done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  console.log(results.join("\n"));
}

function doctor() {
  const ok = (b: boolean) => (b ? "✔" : "✗");
  const node = process.versions.node;
  console.log(`${ok(+node.split(".")[0] >= 18)} Node ${node}`);
  console.log(`  Engine home: ${studioHome()}`);
  const py = venvPython();
  console.log(`${ok(!!py)} Python TTS venv ${py ?? "(not installed: motionstudio setup --tts supertonic)"}`);
  if (py) {
    const r = spawnSync(py, ["-c", "import supertonic"], { stdio: "ignore" });
    console.log(`  ${ok(r.status === 0)} Supertonic${r.status === 0 ? "" : " (motionstudio setup --tts supertonic)"}`);
  }
  const say = process.platform === "darwin" && spawnSync("which", ["say"]).status === 0;
  console.log(`${ok(say)} macOS say ${say ? "" : "(unavailable)"}`);
  console.log("Image providers:");
  for (const line of describeProviders()) console.log(`  ${line}`);
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});

export type { DeckSpec };
