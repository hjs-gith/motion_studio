// Free, offline stand-in images: soft theme-colored gradients, so decks lay out and render before any
// image is generated (or without an API key). Also usable as a provider ("placeholder") for testing.
import { deflateSync, crc32 } from "node:zlib";
import type { ImageProvider, ImageRequest, ImageResult } from "./types";

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}

/** Diagonal gradient between two colors with a soft accent glow; RGB PNG. */
export function gradientPng(width: number, height: number, from: string, to: string, glow: string): Buffer {
  const [r1, g1, b1] = hexRgb(from);
  const [r2, g2, b2] = hexRgb(to);
  const [r3, g3, b3] = hexRgb(glow);
  const row = width * 3 + 1;
  const raw = Buffer.alloc(row * height);
  const gx = width * 0.68;
  const gy = height * 0.38;
  const gr = Math.max(width, height) * 0.55;
  for (let y = 0; y < height; y++) {
    raw[y * row] = 0;
    for (let x = 0; x < width; x++) {
      const t = (x / width) * 0.55 + (y / height) * 0.45;
      const d = Math.hypot(x - gx, y - gy) / gr;
      const g = Math.max(0, 1 - d) ** 2 * 0.35;
      const o = y * row + 1 + x * 3;
      raw[o] = Math.round((r1 + (r2 - r1) * t) * (1 - g) + r3 * g);
      raw[o + 1] = Math.round((g1 + (g2 - g1) * t) * (1 - g) + g3 * g);
      raw[o + 2] = Math.round((b1 + (b2 - b1) * t) * (1 - g) + b3 * g);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 6 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export const placeholder: ImageProvider = {
  id: "placeholder",
  label: "Placeholder gradients (offline, free)",
  defaultModel: "gradient",
  models: ["gradient"],
  keyEnv: [],
  paid: false,
  isConfigured: () => true,
  normalizeSize: (w, h) => {
    const s = Math.min(1, 960 / Math.max(w, h));
    return { width: Math.round(w * s), height: Math.round(h * s) };
  },
  async generate(req: ImageRequest): Promise<ImageResult> {
    const [a, b, c] = req.palette ?? ["#e5e5e5", "#cfcfcf", "#999999"];
    return { data: gradientPng(req.width, req.height, a, b, c), ext: "png" };
  },
};
