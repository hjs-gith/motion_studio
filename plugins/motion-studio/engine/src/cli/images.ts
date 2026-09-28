// `motionstudio images`: plan, then (with --yes) generate the deck's images through the configured provider.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { getProvider, PROVIDERS } from "../images/index";
import { GENERATED_DIR, isReady, planJobs, readImageManifest, writeImageManifest, type ImageJob } from "../images/jobs";
import { log, type Project } from "./project";

export async function runImages(
  p: Project,
  opts: { yes?: boolean; force?: boolean; only?: string[]; provider?: string; showPrompts?: boolean },
): Promise<void> {
  const all = planJobs(p.deck, { providerOverride: opts.provider });
  if (!all.length) {
    console.log('No slides ask for generated images. Add `"generate": { "prompt": "…" }` to an image, image-text or split-column slide.');
    return;
  }
  const manifest = readImageManifest(p.assetsDir);
  const selected = all.filter((j) => !opts.only || opts.only.includes(j.key) || opts.only.includes(j.key.split(".")[0]));
  const todo = selected.filter((j) => !j.hasSrc && (opts.force || !isReady(j, manifest, p.assetsDir)));

  console.log(`Images in "${p.deck.title}":`);
  for (const j of selected) {
    const state = j.hasSrc ? "uses src" : todo.includes(j) ? (manifest[j.key] ? "STALE → regenerate" : "PENDING") : "ready";
    console.log(`  ${state.padEnd(20)} ${j.key.padEnd(18)} ${j.providerId}/${j.request.model} ${j.request.quality} ${j.request.width}x${j.request.height}  “${j.gen.prompt.slice(0, 60)}${j.gen.prompt.length > 60 ? "…" : ""}”`);
    if (opts.showPrompts) console.log(`\n${indent(j.request.prompt)}\n`);
  }
  if (!todo.length) {
    console.log("\n✔ All generated images are up to date.");
    return;
  }

  const byProvider = groupBy(todo, (j) => j.providerId);
  for (const [id] of byProvider) {
    const prov = getProvider(id);
    if (!prov.isConfigured()) {
      console.log(
        `\n✗ ${prov.label} is not configured: set ${prov.keyEnv.join(" or ")} in your environment ` +
          `(e.g. in ~/.zshrc, or "env" in ~/.claude/settings.json), then re-run.\n` +
          `  Until then, slides render with placeholder gradients.`,
      );
      process.exitCode = 2;
      return;
    }
  }

  const paid = todo.filter((j) => getProvider(j.providerId).paid);
  if (paid.length && !opts.yes) {
    console.log(
      `\n${paid.length} image(s) would be generated with a paid API (billed per token to your account; OpenAI gpt-image-2.5: ` +
        `$5/1M text-input tokens, $30/1M image-output tokens — higher quality and larger sizes use more tokens).\n` +
        `Nothing was generated. Re-run with --yes to proceed.`,
    );
    return;
  }

  let spent = 0;
  let known = true;
  for (const j of todo) {
    const prov = getProvider(j.providerId);
    log(`• ${j.key}: generating with ${prov.label} (${j.request.model}, ${j.request.quality}, ${j.request.width}x${j.request.height})…`);
    const t0 = Date.now();
    const result = await prov.generate(j.request);
    const rel = `${GENERATED_DIR}/${j.key.replace(/[^\w.-]/g, "_")}-${j.hash.slice(0, 8)}.${result.ext}`;
    writeFileSync(path.join(p.assetsDir, rel), result.data);
    const cost = result.usage ? prov.costUSD?.(j.request.model, result.usage) : undefined;
    if (cost === undefined && prov.paid) known = false;
    spent += cost ?? 0;
    manifest[j.key] = {
      file: rel,
      hash: j.hash,
      provider: j.providerId,
      model: j.request.model,
      quality: j.request.quality,
      width: j.request.width,
      height: j.request.height,
      prompt: j.request.prompt,
      revisedPrompt: result.revisedPrompt,
      usage: result.usage,
      costUSD: cost,
      createdAt: new Date().toISOString(),
    };
    // Save after every image so a failure midway keeps what was already paid for.
    writeImageManifest(p.assetsDir, manifest);
    log(`  → assets/${rel} in ${((Date.now() - t0) / 1000).toFixed(1)}s${cost !== undefined ? ` (~$${cost.toFixed(3)})` : ""}`);
  }
  console.log(`\n✔ Generated ${todo.length} image(s)${paid.length ? `; estimated cost ${known ? "" : "≥ "}$${spent.toFixed(2)}` : ""}.`);
  console.log("  Review them with `motionstudio stills`, then render.");
}

export function describeProviders(): string[] {
  return Object.values(PROVIDERS).map(
    (p) => `${p.isConfigured() ? "✔" : "✗"} ${p.label} [${p.id}] models: ${p.models.join(", ")}${p.keyEnv.length && !p.isConfigured() ? ` (set ${p.keyEnv[0]})` : ""}`,
  );
}

function groupBy<T>(xs: T[], f: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) m.set(f(x), [...(m.get(f(x)) ?? []), x]);
  return m;
}

function indent(s: string) {
  return s
    .split("\n")
    .map((l) => `      ${l}`)
    .join("\n");
}

export type { ImageJob };
