import { openai } from "./openai";
import { placeholder } from "./placeholder";
import type { ImageProvider } from "./types";

/** Registered image providers. To add one (e.g. Gemini, Recraft, FLUX), implement ImageProvider and list it here. */
export const PROVIDERS: Record<string, ImageProvider> = {
  [openai.id]: openai,
  [placeholder.id]: placeholder,
};

export function getProvider(id: string): ImageProvider {
  const p = PROVIDERS[id];
  if (!p) throw new Error(`Unknown image provider "${id}". Available: ${Object.keys(PROVIDERS).join(", ")}`);
  return p;
}

export type { ImageProvider } from "./types";
