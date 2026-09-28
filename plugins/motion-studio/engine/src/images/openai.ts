// OpenAI Image API provider (gpt-image-2.5-flare / gpt-image-2.5-sunburst, gpt-image-2).
import type { ImageProvider, ImageRequest, ImageResult, ImageUsage } from "./types";

const KEY_ENV = ["OPENAI_API_KEY", "MOTION_STUDIO_OPENAI_API_KEY"];

// USD per 1M tokens (text input, image output). Source: OpenAI model pages, Sept 2026.
const PRICING: Record<string, { textIn: number; imageOut: number }> = {
  "gpt-image-2.5-flare": { textIn: 5, imageOut: 30 },
  "gpt-image-2.5-sunburst": { textIn: 5, imageOut: 30 },
};

function apiKey(): string | undefined {
  for (const k of KEY_ENV) if (process.env[k]) return process.env[k];
  return undefined;
}

/** Custom sizes: multiples of 16, aspect 1:3–3:1, ≤3840 px per edge, 655,360–8,294,400 total pixels. */
function normalizeSize(width: number, height: number) {
  let ar = width / height;
  ar = Math.min(3, Math.max(1 / 3, ar));
  const target = 2_100_000; // ≈1920×1088; sharp at 1080p without paying for 4K
  let h = Math.sqrt(target / ar);
  let w = h * ar;
  const scale = Math.min(1, 3840 / Math.max(w, h));
  w *= scale;
  h *= scale;
  const snap = (n: number) => Math.max(16, Math.round(n / 16) * 16);
  return { width: snap(w), height: snap(h) };
}

async function generate(req: ImageRequest): Promise<ImageResult> {
  const key = apiKey();
  if (!key) throw new Error(`OpenAI API key not set. Export ${KEY_ENV[0]} (see: motionstudio images --help).`);
  const base = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  if (process.env.OPENAI_ORG_ID) headers["OpenAI-Organization"] = process.env.OPENAI_ORG_ID;
  if (process.env.OPENAI_PROJECT_ID) headers["OpenAI-Project"] = process.env.OPENAI_PROJECT_ID;
  const body = JSON.stringify({
    model: req.model,
    prompt: req.prompt,
    size: `${req.width}x${req.height}`,
    quality: req.quality,
    background: req.background,
    output_format: "png",
    n: 1,
  });

  let lastErr: Error | undefined;
  for (let attempt = 0; attempt < 4; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${base}/images/generations`, { method: "POST", headers, body, signal: AbortSignal.timeout(300_000) });
    } catch (e) {
      lastErr = new Error(`Network error calling OpenAI: ${e instanceof Error ? e.message : String(e)}`);
      await sleep(2000 * (attempt + 1));
      continue;
    }
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(text);
    } catch {
      /* non-JSON error body */
    }
    if (res.ok) {
      const item = (json.data as Array<{ b64_json?: string; revised_prompt?: string }> | undefined)?.[0];
      if (!item?.b64_json) throw new Error("OpenAI returned no image data");
      const u = json.usage as { input_tokens?: number; output_tokens?: number; total_tokens?: number } | undefined;
      return {
        data: Buffer.from(item.b64_json, "base64"),
        ext: "png",
        revisedPrompt: item.revised_prompt,
        usage: u ? { inputTokens: u.input_tokens, outputTokens: u.output_tokens, totalTokens: u.total_tokens } : undefined,
      };
    }
    const msg = (json.error as { message?: string } | undefined)?.message ?? text.slice(0, 300);
    if (res.status === 401) throw new Error(`OpenAI rejected the API key (401): ${msg}`);
    if (res.status === 400) throw new Error(`OpenAI refused the request (400): ${msg}`);
    if (res.status === 429 || res.status >= 500) {
      lastErr = new Error(`OpenAI ${res.status}: ${msg}`);
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 4000 * 2 ** attempt);
      continue;
    }
    throw new Error(`OpenAI ${res.status}: ${msg}`);
  }
  throw lastErr ?? new Error("OpenAI request failed");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const openai: ImageProvider = {
  id: "openai",
  label: "OpenAI GPT Image",
  defaultModel: "gpt-image-2.5-flare",
  models: ["gpt-image-2.5-flare", "gpt-image-2.5-sunburst", "gpt-image-2"],
  keyEnv: KEY_ENV,
  paid: true,
  isConfigured: () => !!apiKey(),
  normalizeSize,
  generate,
  costUSD(model: string, usage: ImageUsage) {
    const p = PRICING[model];
    if (!p || usage.outputTokens === undefined) return undefined;
    return ((usage.inputTokens ?? 0) * p.textIn + usage.outputTokens * p.imageOut) / 1_000_000;
  },
};
