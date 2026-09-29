// Generates narration audio per slide and records it in assets/audio/manifest.json.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { log, narrationHash, readManifest, speechFor, wavDuration, writeManifest, type Project } from "./project";
import { PACED_LANGS, PACE_VERSION, describeSegments, pacingApplies, type SpeechSegment } from "../pronounce";

const here = path.dirname(fileURLToPath(import.meta.url));
const SYNTH = path.resolve(here, "../../tts/synth.py");

export function studioHome(): string {
  return process.env.MOTION_STUDIO_HOME ?? path.join(os.homedir(), ".cache", "motion-studio");
}

export function venvPython(): string | undefined {
  const py = path.join(studioHome(), "venv", "bin", "python");
  return existsSync(py) ? py : undefined;
}

/** Prints what each slide will sound like, without synthesizing. */
export function previewNarration(p: Project, only?: string[]) {
  const deck = p.deck;
  let unknownTotal = 0;
  for (const s of deck.slides) {
    if (!s.narration?.trim() || (only && !only.includes(s.id!))) continue;
    const sp = speechFor(deck, s.narration);
    console.log(`${s.id}:\n  ${describeSegments(sp, deck.lang)}`);
    if (sp.unknownWords.length) {
      unknownTotal += sp.unknownWords.length;
      console.log(`  ! read with ${deck.lang} rules: ${sp.unknownWords.join(", ")}`);
    }
  }
  if (unknownTotal) console.log(`\nAdd spoken forms for flagged words to voice.lexicon in deck.json, e.g. { "Prompt": "프롬프트" }.`);
}

export async function generateNarration(p: Project, opts: { force?: boolean; only?: string[] } = {}) {
  const deck = p.deck;
  const engine = deck.voice.engine;
  if (engine === "none") {
    log('Voice engine is "none". Set deck.voice.engine to "supertonic" or "say" in deck.json.');
    return;
  }
  mkdirSync(p.audioDir, { recursive: true });
  const manifest = readManifest(p);
  const jobs: { id: string; segments: SpeechSegment[]; out: string; hash: string }[] = [];
  for (const s of deck.slides) {
    if (!s.narration?.trim()) continue;
    if (opts.only && !opts.only.includes(s.id!)) continue;
    const hash = narrationHash(deck, s.narration);
    const file = `audio/${s.id}.wav`;
    const out = path.join(p.assetsDir, file);
    if (!opts.force && manifest[s.id!]?.hash === hash && existsSync(out)) continue;
    jobs.push({ id: s.id!, segments: speechFor(deck, s.narration).segments, out, hash });
  }
  if (!jobs.length) {
    log("• Narration audio is up to date.");
    return;
  }
  log(`• Synthesizing ${jobs.length} narration clip(s) with ${engine}${deck.voice.voice ? ` (voice ${deck.voice.voice})` : ""}…`);

  if (engine === "say") {
    if (process.platform !== "darwin") throw new Error('The "say" engine is only available on macOS.');
    for (const j of jobs) {
      const args = ["-o", j.out, "--file-format=WAVE", "--data-format=LEI16@24000", "-r", String(Math.round(185 * deck.voice.speed))];
      if (deck.voice.voice) args.push("-v", deck.voice.voice);
      args.push(j.segments.map((x) => x.text).join(" "));
      const r = spawnSync("say", args, { stdio: "inherit" });
      if (r.status !== 0) throw new Error(`say failed for ${j.id}`);
      log(`  say: ${j.id}`);
    }
  } else {
    const py = venvPython();
    if (!py) throw new Error(`Python TTS environment not found. Run: motionstudio setup --tts ${engine}`);
    const tmp = mkdtempSync(path.join(os.tmpdir(), "motion-studio-tts-"));
    const jobFile = path.join(tmp, "jobs.json");
    writeFileSync(
      jobFile,
      JSON.stringify({
        engine,
        voice: deck.voice.voice,
        lang: deck.lang,
        speed: deck.voice.speed,
        // Calibrated target rates are cached per voice/speed/steps so runs that re-voice only some
        // slides keep the same tempo as earlier runs.
        pace: jobs.some((j) => pacingApplies(engine, deck.voice.pace, j.segments))
          ? { version: PACE_VERSION, langs: PACED_LANGS, cache: path.join(p.audioDir, "pace-calibration.json") }
          : null,
        jobs: jobs.map(({ id, segments, out }) => ({ id, segments, out })),
      }),
    );
    try {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(py, [SYNTH, jobFile], { stdio: ["ignore", "pipe", "inherit"] });
        let buf = "";
        child.stdout.on("data", (d: Buffer) => {
          buf += d.toString("utf8");
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (line) reportPace(line);
          }
        });
        child.on("error", reject);
        child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`TTS worker exited with code ${code}`))));
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }

  for (const j of jobs) {
    if (!existsSync(j.out)) throw new Error(`TTS produced no file for ${j.id}`);
    manifest[j.id] = { file: `audio/${j.id}.wav`, durationSec: Math.round(wavDuration(j.out) * 1000) / 1000, hash: j.hash };
  }
  // Drop entries for slides that no longer exist.
  const ids = new Set(deck.slides.map((s) => s.id!));
  for (const id of Object.keys(manifest)) if (!ids.has(id)) delete manifest[id];
  writeManifest(p, manifest);
  const total = jobs.reduce((a, j) => a + manifest[j.id].durationSec, 0);
  log(`• Wrote ${jobs.length} clip(s), ${total.toFixed(1)}s of narration.`);
}

/** Logs how much pacing evened out a slide's sentence rates (worker prints one JSON line per clip). */
function reportPace(line: string) {
  let msg: { id?: string; pace?: { before: number; after: number }[] };
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  const stats = msg.pace;
  if (!stats || stats.length < 2) return;
  const spread = (xs: number[]) => {
    const sorted = [...xs].sort((a, b) => a - b);
    return ((sorted[sorted.length - 1] - sorted[0]) / sorted[Math.floor(sorted.length / 2)]) * 100;
  };
  log(
    `  ${msg.id}: paced ${stats.length} sentences, rate spread ${spread(stats.map((s) => s.before)).toFixed(0)}% → ${spread(stats.map((s) => s.after)).toFixed(0)}%`,
  );
}
