// SVG helpers shared by the renderer, the HTML player and the exporters (browser-safe, no Node APIs).
import type { Theme } from "./themes";

/** Removes scripts, event handlers, foreignObject and javascript: URLs from untrusted SVG markup. */
export function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/(href\s*=\s*["'])\s*javascript:[^"']*/gi, "$1#")
    .trim();
}

const TOKENS = ["accent2", "accent", "text", "muted", "bg2", "bg", "surface"] as const;

/**
 * Replaces theme tokens with the theme's hex colors so the SVG also works outside the page
 * (rasterized for PPTX): var(--accent), var(--accent2), var(--text), var(--muted), var(--bg), var(--bg2), var(--surface).
 */
export function themeSvg(svg: string, theme: Theme): string {
  let out = svg;
  for (const t of TOKENS) out = out.replace(new RegExp(`var\\(\\s*--${t}\\s*\\)`, "g"), theme.colors[t]);
  return out;
}

/** Makes the root <svg> fill its container while keeping its aspect ratio. */
export function fitSvgRoot(svg: string): string {
  return svg.replace(/<svg\b([^>]*)>/i, (_m, attrs: string) => {
    let a = attrs.replace(/\s(width|height)\s*=\s*("[^"]*"|'[^']*')/gi, "");
    if (!/preserveAspectRatio/i.test(a)) a += ' preserveAspectRatio="xMidYMid meet"';
    return `<svg${a} width="100%" height="100%" style="display:block;overflow:visible">`;
  });
}

export function prepareSvg(svg: string, theme: Theme): string {
  return fitSvgRoot(themeSvg(sanitizeSvg(svg), theme));
}

/** Aspect ratio (w/h) from the root viewBox, or from width/height attributes; defaults to 16:9. */
export function svgAspect(svg: string): number {
  const root = /<svg\b[^>]*>/i.exec(svg)?.[0] ?? "";
  const vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(root);
  if (vb && +vb[1] > 0 && +vb[2] > 0) return +vb[1] / +vb[2];
  const w = /\swidth\s*=\s*["']([\d.]+)/i.exec(root);
  const h = /\sheight\s*=\s*["']([\d.]+)/i.exec(root);
  if (w && h && +w[1] > 0 && +h[1] > 0) return +w[1] / +h[1];
  return 16 / 9;
}

export function looksLikeSvg(s: string | undefined): s is string {
  return !!s && /<svg[\s>]/i.test(s);
}

/** Stable short key for an SVG string (FNV-1a), used to look up its rasterized PNG. */
export function svgKey(svg: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < svg.length; i++) {
    h ^= svg.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0") + svg.length.toString(16);
}

/** Every SVG in the deck (visual, image-text, card icons), for rasterizing. */
export function collectSvgs(deck: { slides: Array<Record<string, unknown>> }): string[] {
  const out = new Set<string>();
  for (const s of deck.slides) {
    if ((s.layout === "visual" || s.layout === "image-text") && looksLikeSvg(s.svg as string)) out.add(s.svg as string);
    if (s.layout === "cards") for (const c of s.cards as Array<{ icon?: string }>) if (looksLikeSvg(c.icon)) out.add(c.icon!);
  }
  return [...out];
}
