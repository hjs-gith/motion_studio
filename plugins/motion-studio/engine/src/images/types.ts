// Image-model provider interface. Add a provider by implementing ImageProvider and registering it in ./index.ts.

export type ImageQuality = "low" | "medium" | "high" | "xhigh" | "max" | "auto";

export type ImageRequest = {
  prompt: string;
  model: string;
  quality: ImageQuality;
  width: number;
  height: number;
  background: "opaque" | "transparent" | "auto";
  /** Theme colors [bg, bg2, accent], for providers that can use them (the placeholder does). */
  palette?: [string, string, string];
};

export type ImageUsage = { inputTokens?: number; outputTokens?: number; totalTokens?: number };

export type ImageResult = {
  data: Buffer;
  /** File extension without dot, e.g. "png". */
  ext: string;
  revisedPrompt?: string;
  usage?: ImageUsage;
};

export interface ImageProvider {
  id: string;
  label: string;
  defaultModel: string;
  models: string[];
  /** Env var(s) holding the API key, shown in setup messages. Empty for local providers. */
  keyEnv: string[];
  /** True when the provider costs money per image (plans require --yes). */
  paid: boolean;
  isConfigured(): boolean;
  /** Snap a desired size to one the model accepts. */
  normalizeSize(width: number, height: number): { width: number; height: number };
  generate(req: ImageRequest): Promise<ImageResult>;
  /** Estimated USD for a finished generation, when pricing is known. */
  costUSD?(model: string, usage: ImageUsage): number | undefined;
}
