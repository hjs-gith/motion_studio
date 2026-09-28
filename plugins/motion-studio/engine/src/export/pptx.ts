// Native, editable PowerPoint export. Mirrors the video layouts with real text boxes, shapes and charts.
import pptxgen from "pptxgenjs";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { bulletText, type ColumnSpec, type DeckSpec, type SlideSpec } from "../spec";
import { resolveTheme, type Theme } from "../themes";
import { looksLikeSvg, svgAspect, svgKey } from "../svg-utils";

type PSlide = ReturnType<pptxgen["addSlide"]>;
const hex = (c: string) => c.replace("#", "").slice(0, 6).toUpperCase();

/** `svgImages` maps svgKey(svg) → rasterized PNG path (rendered by the CLI with headless Chrome). */
export async function exportPptx(deck: DeckSpec, assetsDir: string, output: string, svgImages: Record<string, string> = {}): Promise<string> {
  const theme = resolveTheme(deck);
  const pptx = new pptxgen();
  const { width, height } = deck.format;
  const W = width >= height ? 13.333 : 7.5;
  const H = (W * height) / width;
  pptx.defineLayout({ name: "DECK", width: W, height: H });
  pptx.layout = "DECK";
  pptx.title = deck.title;
  if (deck.author) pptx.author = deck.author;
  pptx.theme = { headFontFace: theme.fonts.heading, bodyFontFace: theme.fonts.body };

  const k = Math.min(W / 13.333, H / 7.5); // font scale for non-16:9 formats
  const ctx: Ctx = { pptx, theme, W, H, k, assetsDir, padX: 0.9 * k, padY: 0.7 * k, minimal: theme.style === "minimal", svgImages };

  for (const s of deck.slides) {
    const slide = pptx.addSlide();
    decorate(ctx, slide, s);
    LAYOUTS[s.layout](ctx, slide, s as never);
    const notes = [s.narration, s.notes ? `[Notes] ${s.notes}` : undefined].filter(Boolean).join("\n\n");
    if (notes) slide.addNotes(notes);
  }
  await pptx.writeFile({ fileName: output });
  return output;
}

type Ctx = {
  pptx: pptxgen;
  theme: Theme;
  W: number;
  H: number;
  k: number;
  assetsDir: string;
  padX: number;
  padY: number;
  minimal: boolean;
  svgImages: Record<string, string>;
};
type Of<L extends SlideSpec["layout"]> = Extract<SlideSpec, { layout: L }>;

function decorate(ctx: Ctx, slide: PSlide, s: SlideSpec) {
  const { pptx, theme, W, H } = ctx;
  const c = theme.colors;
  slide.background = { color: hex(c.bg) };
  const kind = s.background ?? theme.background;
  if (s.layout === "image" || ctx.minimal) return;
  if (kind === "orbs" || kind === "gradient") {
    slide.addShape(pptx.ShapeType.ellipse, { x: -W * 0.2, y: -H * 0.35, w: W * 0.6, h: W * 0.6, fill: { color: hex(c.accent), transparency: 94 }, line: { type: "none" } });
    slide.addShape(pptx.ShapeType.ellipse, { x: W * 0.62, y: H * 0.45, w: W * 0.55, h: W * 0.55, fill: { color: hex(c.accent2), transparency: 94 }, line: { type: "none" } });
  } else if (kind === "grid" || kind === "dots") {
    slide.addShape(pptx.ShapeType.ellipse, { x: W * 0.7, y: -H * 0.3, w: W * 0.45, h: W * 0.45, fill: { color: hex(c.accent), transparency: 94 }, line: { type: "none" } });
  }
}

function heading(ctx: Ctx, slide: PSlide, text: string, y?: number, size = 36) {
  const { theme, padX, padY, W, k } = ctx;
  const top = y ?? padY;
  slide.addText(text, {
    x: padX,
    y: top,
    w: W - padX * 2,
    h: 1.0 * k,
    fontFace: theme.fonts.heading,
    fontSize: fit(text, size, 38) * k,
    bold: true,
    color: hex(theme.colors.text),
    valign: "top",
    margin: 0,
  });
  slide.addShape(ctx.pptx.ShapeType.roundRect, {
    x: padX,
    y: top + 1.05 * k,
    w: (ctx.minimal ? 0.6 : 0.9) * k,
    h: (ctx.minimal ? 0.03 : 0.06) * k,
    fill: { color: hex(theme.colors.accent) },
    line: { type: "none" },
    rectRadius: 0.03,
  });
  return top + 1.45 * k;
}

function kicker(ctx: Ctx, slide: PSlide, text: string | undefined, y: number, align: "left" | "center" = "left", x = ctx.padX, w = ctx.W - ctx.padX * 2) {
  if (!text) return y;
  slide.addText(text.toUpperCase(), {
    x,
    y,
    w,
    h: 0.4 * ctx.k,
    fontSize: 13 * ctx.k,
    bold: true,
    charSpacing: 4,
    color: hex(ctx.theme.colors.accent),
    fontFace: ctx.theme.fonts.body,
    align,
    margin: 0,
  });
  return y + 0.5 * ctx.k;
}

function fit(text: string, base: number, chars: number) {
  const len = [...text].length;
  return len <= chars ? base : Math.max(base * 0.55, base * Math.sqrt(chars / len));
}

function imagePath(ctx: Ctx, src: string): string | undefined {
  if (/^https?:/.test(src)) return src;
  const p = path.join(ctx.assetsDir, src.replace(/^\.?\/?(assets\/)?/, ""));
  return existsSync(p) ? p : undefined;
}

/** Reads PNG/JPEG pixel size so images can be cropped to cover a box. */
function imageSize(file: string): { w: number; h: number } | undefined {
  try {
    const b = readFileSync(file);
    if (b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    if (b[0] === 0xff && b[1] === 0xd8) {
      let o = 2;
      while (o < b.length) {
        if (b[o] !== 0xff) return;
        const m = b[o + 1];
        const len = b.readUInt16BE(o + 2);
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: b.readUInt16BE(o + 5), w: b.readUInt16BE(o + 7) };
        o += 2 + len;
      }
    }
  } catch {
    /* fall through */
  }
  return undefined;
}

function addImage(ctx: Ctx, slide: PSlide, src: string, box: { x: number; y: number; w: number; h: number }, fitMode: "cover" | "contain") {
  const p = imagePath(ctx, src);
  if (!p) {
    slide.addText(`[missing image: ${src}]`, { ...box, color: hex(ctx.theme.colors.muted), align: "center", fontSize: 14 });
    return;
  }
  const size = /^https?:/.test(p) ? undefined : imageSize(p);
  if (!size) {
    slide.addImage({ path: p, ...box, sizing: { type: "contain", w: box.w, h: box.h } });
    return;
  }
  const ar = size.w / size.h;
  if (fitMode === "contain") {
    const w = Math.min(box.w, box.h * ar);
    const h = w / ar;
    slide.addImage({ path: p, x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h });
  } else {
    // For "cover", pptxgenjs reads the image's natural aspect from w/h and crops it to sizing.w/h.
    slide.addImage({ path: p, x: box.x, y: box.y, w: size.w / 96, h: size.h / 96, sizing: { type: "cover", w: box.w, h: box.h } });
  }
}

const LAYOUTS: { [L in SlideSpec["layout"]]: (ctx: Ctx, slide: PSlide, s: Of<L>) => void } = {
  title(ctx, slide, s) {
    const { theme, W, H, k, padX } = ctx;
    const align = ctx.minimal ? "left" : "center";
    let y = H * 0.3;
    y = kicker(ctx, slide, s.kicker, y, align);
    slide.addText(s.title, { x: padX, y, w: W - padX * 2, h: 1.7 * k, fontFace: theme.fonts.heading, fontSize: fit(s.title, 56, 24) * k, bold: true, color: hex(theme.colors.text), align, valign: "middle", margin: 0 });
    const lineW = (ctx.minimal ? 0.8 : 1.2) * k;
    slide.addShape(ctx.pptx.ShapeType.rect, { x: ctx.minimal ? padX : W / 2 - lineW / 2, y: y + 1.85 * k, w: lineW, h: (ctx.minimal ? 0.035 : 0.07) * k, fill: { color: hex(theme.colors.accent) }, line: { type: "none" } });
    if (s.subtitle)
      slide.addText(s.subtitle, { x: ctx.minimal ? padX : padX * 1.5, y: y + 2.1 * k, w: W - padX * 3, h: 0.9 * k, fontSize: 20 * k, color: hex(theme.colors.muted), align, fontFace: theme.fonts.body, margin: 0 });
  },
  section(ctx, slide, s) {
    const { theme, W, H, k, padX } = ctx;
    if (ctx.minimal) {
      if (s.number) slide.addText(`${s.number} —`, { x: padX, y: H / 2 - 1.35 * k, w: 3 * k, h: 0.45 * k, fontFace: theme.fonts.mono, fontSize: 15 * k, color: hex(theme.colors.accent), margin: 0 });
      slide.addText(s.title, { x: padX, y: H / 2 - 0.85 * k, w: W - padX * 2, h: 1.2 * k, fontSize: fit(s.title, 50, 22) * k, bold: true, color: hex(theme.colors.text), fontFace: theme.fonts.heading, valign: "middle", margin: 0 });
      if (s.subtitle) slide.addText(s.subtitle, { x: padX, y: H / 2 + 0.45 * k, w: W - padX * 2, h: 0.6 * k, fontSize: 19 * k, color: hex(theme.colors.muted), fontFace: theme.fonts.body, valign: "top", margin: 0 });
      slide.addShape(ctx.pptx.ShapeType.rect, { x: padX, y: H - ctx.padY, w: W - padX * 2, h: 0.02 * k, fill: { color: hex(theme.colors.accent) }, line: { type: "none" } });
      return;
    }
    if (s.number)
      slide.addText(s.number, { x: W * 0.55, y: H * 0.1, w: W * 0.4, h: H * 0.8, fontSize: 220 * k, bold: true, color: hex(theme.colors.accent), transparency: 80, align: "right", valign: "middle", fontFace: theme.fonts.heading, margin: 0 });
    slide.addShape(ctx.pptx.ShapeType.roundRect, { x: padX * 0.6, y: H / 2 - 1.0 * k, w: 0.09 * k, h: 2.0 * k, fill: { color: hex(theme.colors.accent) }, line: { type: "none" }, rectRadius: 0.04 });
    slide.addText(s.title, { x: padX, y: H / 2 - 1.0 * k, w: W * 0.65, h: 1.4 * k, fontSize: fit(s.title, 48, 22) * k, bold: true, color: hex(theme.colors.text), fontFace: theme.fonts.heading, valign: "bottom", margin: 0 });
    if (s.subtitle) slide.addText(s.subtitle, { x: padX, y: H / 2 + 0.5 * k, w: W * 0.6, h: 0.7 * k, fontSize: 20 * k, color: hex(theme.colors.muted), fontFace: theme.fonts.body, valign: "top", margin: 0 });
  },
  bullets(ctx, slide, s) {
    const { theme, W, H, k, padX, padY } = ctx;
    const y0 = heading(ctx, slide, s.title, kicker(ctx, slide, s.kicker, padY));
    const n = s.bullets.length;
    const rowH = Math.min(1.0 * k, (H - y0 - padY) / n);
    const size = (n > 5 ? 17 : n > 3 ? 20 : 23) * k;
    s.bullets.forEach((b, i) => {
      const { text, sub } = bulletText(b);
      const y = y0 + i * rowH;
      slide.addShape(ctx.pptx.ShapeType.roundRect, { x: padX, y: y + 0.05 * k, w: 0.42 * k, h: 0.42 * k, fill: { color: hex(i % 2 ? theme.colors.accent2 : theme.colors.accent) }, line: { type: "none" }, rectRadius: 0.08 });
      slide.addText(String(i + 1).padStart(2, "0"), { x: padX, y: y + 0.05 * k, w: 0.42 * k, h: 0.42 * k, fontSize: 11 * k, bold: true, color: hex(theme.dark ? theme.colors.bg : "#FFFFFF"), align: "center", valign: "middle", fontFace: theme.fonts.mono, margin: 0 });
      const runs: pptxgen.TextProps[] = [{ text, options: { fontSize: size, bold: true, color: hex(theme.colors.text), breakLine: !!sub } }];
      if (sub) runs.push({ text: sub, options: { fontSize: size * 0.68, color: hex(theme.colors.muted) } });
      slide.addText(runs, { x: padX + 0.65 * k, y, w: W - padX * 2 - 0.65 * k, h: rowH, valign: "top", fontFace: theme.fonts.body, margin: 0 });
    });
  },
  statement(ctx, slide, s) {
    const { theme, W, H, k, padX } = ctx;
    slide.addText("“", { x: W / 2 - 1 * k, y: H * 0.1, w: 2 * k, h: 1.4 * k, fontSize: 120 * k, color: hex(theme.colors.accent), align: "center", fontFace: theme.fonts.heading, margin: 0 });
    slide.addText(s.text, { x: padX * 1.3, y: H * 0.28, w: W - padX * 2.6, h: H * 0.4, fontSize: fit(s.text, 34, 70) * k, bold: true, color: hex(theme.colors.text), align: "center", valign: "middle", fontFace: theme.fonts.heading, margin: 0 });
    if (s.attribution) slide.addText(`— ${s.attribution}`, { x: padX, y: H * 0.72, w: W - padX * 2, h: 0.5 * k, fontSize: 16 * k, color: hex(theme.colors.muted), align: "center", fontFace: theme.fonts.body, margin: 0 });
  },
  stat(ctx, slide, s) {
    const { theme, W, H, k, padX, padY } = ctx;
    const y0 = s.title ? heading(ctx, slide, s.title) : H * 0.25;
    const n = s.stats.length;
    const gap = 0.35 * k;
    const cw = (W - padX * 2 - gap * (n - 1)) / n;
    const ch = Math.min(3.2 * k, H - y0 - padY);
    s.stats.forEach((st, i) => {
      const x = padX + i * (cw + gap);
      slide.addShape(ctx.pptx.ShapeType.roundRect, { x, y: y0, w: cw, h: ch, fill: { color: hex(theme.colors.surface), transparency: theme.dark ? 30 : 0 }, line: { color: hex(theme.colors.accent), width: 1, transparency: 60 }, rectRadius: 0.15 });
      const val = `${st.prefix ?? ""}${st.value.toLocaleString("en-US", { minimumFractionDigits: st.decimals ?? 0, maximumFractionDigits: st.decimals ?? 2 })}${st.suffix ?? ""}`;
      slide.addText(val, { x, y: y0 + 0.3 * k, w: cw, h: ch * 0.55, fontSize: (n === 1 ? 96 : n === 2 ? 72 : n === 3 ? 56 : 44) * k, bold: true, color: hex(theme.colors.accent), align: "center", valign: "middle", fontFace: theme.fonts.heading, margin: 0 });
      slide.addText(st.label, { x: x + 0.2 * k, y: y0 + ch * 0.62, w: cw - 0.4 * k, h: ch * 0.3, fontSize: 16 * k, color: hex(theme.colors.muted), align: "center", valign: "top", fontFace: theme.fonts.body, margin: 0 });
    });
  },
  chart(ctx, slide, s) {
    const { pptx, theme, W, H, k, padX, padY } = ctx;
    const y0 = heading(ctx, slide, s.title, undefined, 32);
    const c = theme.colors;
    const colors = [c.accent, c.accent2, c.muted, c.text].map(hex);
    const type = s.chart.type === "bar" ? pptx.ChartType.bar : s.chart.type === "line" ? pptx.ChartType.line : pptx.ChartType.doughnut;
    const data =
      s.chart.type === "donut"
        ? [{ name: s.chart.series[0].name, labels: s.chart.labels, values: s.chart.series[0].values }]
        : s.chart.series.map((ser) => ({ name: ser.name, labels: s.chart.labels, values: ser.values }));
    const bottom = s.caption ? 0.6 * k : 0;
    slide.addChart(type, data, {
      x: padX,
      y: y0,
      w: W - padX * 2,
      h: H - y0 - padY - bottom,
      chartColors: s.chart.type === "donut" ? [c.accent, c.accent2, c.muted, c.text, c.surface].map(hex) : colors,
      showLegend: s.chart.series.length > 1 || s.chart.type === "donut",
      legendPos: "r",
      legendColor: hex(c.text),
      legendFontSize: 12 * k,
      catAxisLabelColor: hex(c.muted),
      valAxisLabelColor: hex(c.muted),
      catAxisLabelFontSize: 12 * k,
      valAxisLabelFontSize: 11 * k,
      valGridLine: { color: hex(c.muted), style: "dash", size: 0.5 },
      catGridLine: { style: "none" },
      showValue: s.chart.series.length === 1,
      dataLabelColor: hex(c.text),
      dataLabelFontSize: 11 * k,
      barGapWidthPct: 60,
      lineSize: 3,
      lineDataSymbolSize: 8,
      holeSize: 60,
      showPercent: s.chart.type === "donut",
      valAxisLabelFormatCode: s.chart.unit ? `#,##0"${s.chart.unit}"` : undefined,
    });
    if (s.caption) slide.addText(s.caption, { x: padX, y: H - padY - 0.5 * k, w: W - padX * 2, h: 0.5 * k, fontSize: 14 * k, color: hex(c.muted), fontFace: theme.fonts.body, margin: 0 });
  },
  image(ctx, slide, s) {
    const { theme, W, H, k, padX } = ctx;
    if (s.fit === "contain") {
      slide.background = { color: hex(theme.colors.bg) };
      addImage(ctx, slide, s.src ?? "", { x: padX, y: 0.5 * k, w: W - padX * 2, h: H - (s.title || s.caption ? 2.0 : 1.0) * k }, "contain");
    } else {
      addImage(ctx, slide, s.src ?? "", { x: 0, y: 0, w: W, h: H }, "cover");
      if (s.title || s.caption) slide.addShape(ctx.pptx.ShapeType.rect, { x: 0, y: H * 0.62, w: W, h: H * 0.38, fill: { color: "000000", transparency: 45 }, line: { type: "none" } });
    }
    const textColor = s.fit === "contain" ? hex(theme.colors.text) : "FFFFFF";
    if (s.title) slide.addText(s.title, { x: padX, y: H - 1.7 * k, w: W - padX * 2, h: 0.8 * k, fontSize: fit(s.title, 34, 36) * k, bold: true, color: textColor, fontFace: theme.fonts.heading, margin: 0 });
    if (s.caption) slide.addText(s.caption, { x: padX, y: H - 0.9 * k, w: W - padX * 2, h: 0.5 * k, fontSize: 16 * k, color: textColor, fontFace: theme.fonts.body, margin: 0 });
  },
  split(ctx, slide, s) {
    const { W, H, k, padX, padY } = ctx;
    const y0 = heading(ctx, slide, s.title, undefined, 32);
    const gap = 0.4 * k;
    const cw = (W - padX * 2 - gap) / 2;
    column(ctx, slide, s.left, { x: padX, y: y0, w: cw, h: H - y0 - padY }, ctx.theme.colors.accent);
    column(ctx, slide, s.right, { x: padX + cw + gap, y: y0, w: cw, h: H - y0 - padY }, ctx.theme.colors.accent2);
  },
  timeline(ctx, slide, s) {
    const { pptx, theme, W, H, k, padX } = ctx;
    heading(ctx, slide, s.title, undefined, 32);
    const lineY = H * 0.6;
    slide.addShape(pptx.ShapeType.rect, { x: padX, y: lineY - 0.03 * k, w: W - padX * 2, h: 0.06 * k, fill: { color: hex(theme.colors.accent) }, line: { type: "none" } });
    const n = s.items.length;
    const step = (W - padX * 2) / n;
    s.items.forEach((it, i) => {
      const cx = padX + step * (i + 0.5);
      slide.addShape(pptx.ShapeType.ellipse, { x: cx - 0.15 * k, y: lineY - 0.15 * k, w: 0.3 * k, h: 0.3 * k, fill: { color: hex(theme.colors.bg) }, line: { color: hex(i % 2 ? theme.colors.accent2 : theme.colors.accent), width: 4 } });
      const up = i % 2 === 0;
      const boxH = 1.5 * k;
      const y = up ? lineY - 0.35 * k - boxH : lineY + 0.35 * k;
      const runs: pptxgen.TextProps[] = [
        { text: it.label, options: { fontSize: 12 * k, bold: true, color: hex(theme.colors.accent), fontFace: theme.fonts.mono, breakLine: true } },
        { text: it.title, options: { fontSize: fit(it.title, 17, 18) * k, bold: true, color: hex(theme.colors.text), fontFace: theme.fonts.heading, breakLine: !!it.text } },
      ];
      if (it.text) runs.push({ text: it.text, options: { fontSize: 11 * k, color: hex(theme.colors.muted) } });
      slide.addText(runs, { x: cx - step / 2 + 0.05 * k, y, w: step - 0.1 * k, h: boxH, align: "center", valign: up ? "bottom" : "top", fontFace: theme.fonts.body, margin: 0 });
    });
  },
  code(ctx, slide, s) {
    const { pptx, theme, W, H, k, padX, padY } = ctx;
    const y0 = s.title ? heading(ctx, slide, s.title, undefined, 30) : padY;
    const lines = s.code.replace(/\s+$/, "").split("\n");
    const hl = new Set(s.highlight ?? []);
    slide.addShape(pptx.ShapeType.roundRect, { x: padX, y: y0, w: W - padX * 2, h: H - y0 - padY, fill: { color: "0F172A" }, line: { color: hex(theme.colors.accent), width: 1, transparency: 60 }, rectRadius: 0.12 });
    const size = (lines.length > 16 ? 11 : lines.length > 10 ? 13 : 16) * k;
    slide.addText(
      lines.map((l, i) => ({
        text: `${String(i + 1).padStart(2, " ")}  ${l || " "}`,
        options: { color: hl.has(i + 1) ? hex(theme.colors.accent) : "E5E7EB", bold: hl.has(i + 1), breakLine: i < lines.length - 1 },
      })),
      { x: padX + 0.3 * k, y: y0 + 0.25 * k, w: W - padX * 2 - 0.6 * k, h: H - y0 - padY - 0.5 * k, fontFace: theme.fonts.mono, fontSize: size, valign: "top", margin: 0, lineSpacingMultiple: 1.25 },
    );
  },
  end(ctx, slide, s) {
    const { pptx, theme, W, H, k, padX } = ctx;
    const align = ctx.minimal ? "left" : "center";
    slide.addText(s.title, { x: padX, y: H * 0.28, w: W - padX * 2, h: 1.4 * k, fontSize: fit(s.title, 54, 22) * k, bold: true, color: hex(theme.colors.text), align, valign: "middle", fontFace: theme.fonts.heading, margin: 0 });
    if (s.subtitle) slide.addText(s.subtitle, { x: padX, y: H * 0.28 + 1.5 * k, w: W - padX * 2, h: 0.6 * k, fontSize: 20 * k, color: hex(theme.colors.muted), align, fontFace: theme.fonts.body, margin: 0 });
    if (s.cta) {
      const w = Math.min(W - padX * 2, (0.4 + [...s.cta].length * 0.16) * k);
      slide.addText(ctx.minimal ? `${s.cta}  →` : s.cta, {
        shape: ctx.minimal ? pptx.ShapeType.rect : pptx.ShapeType.roundRect,
        x: ctx.minimal ? padX : W / 2 - w / 2,
        y: H * 0.68,
        w,
        h: 0.7 * k,
        fill: { color: hex(theme.colors.accent) },
        rectRadius: ctx.minimal ? 0 : 0.35,
        color: hex(theme.dark && !ctx.minimal ? theme.colors.bg : "#FFFFFF"),
        bold: true,
        fontSize: 18 * k,
        align: "center",
        valign: "middle",
        fontFace: theme.fonts.body,
      });
    }
  },
  agenda(ctx, slide, s) {
    const { theme, W, H, k, padX, padY } = ctx;
    const y0 = heading(ctx, slide, s.title, undefined, 32);
    const n = s.items.length;
    const twoCol = n > 5;
    const perCol = twoCol ? Math.ceil(n / 2) : n;
    const colW = twoCol ? (W - padX * 2 - 0.6 * k) / 2 : W - padX * 2;
    const rowH = Math.min(0.85 * k, (H - y0 - padY) / perCol);
    s.items.forEach((item, i) => {
      const col = twoCol ? Math.floor(i / perCol) : 0;
      const row = twoCol ? i % perCol : i;
      const x = padX + col * (colW + 0.6 * k);
      const y = y0 + row * rowH;
      const on = s.active === i + 1;
      const dim = !!s.active && !on;
      slide.addShape(ctx.pptx.ShapeType.rect, { x, y, w: colW, h: (on ? 0.03 : 0.012) * k, fill: { color: hex(on ? theme.colors.accent : theme.colors.muted), transparency: on ? 0 : 70 }, line: { type: "none" } });
      slide.addText(
        [
          { text: String(i + 1).padStart(2, "0") + "   ", options: { fontFace: theme.fonts.mono, fontSize: 13 * k, color: hex(theme.colors.accent) } },
          { text: item, options: { fontSize: (n > 5 ? 18 : 22) * k, bold: on, color: hex(dim ? theme.colors.muted : theme.colors.text) } },
        ],
        { x, y: y + 0.08 * k, w: colW, h: rowH - 0.1 * k, valign: "middle", fontFace: theme.fonts.body, margin: 0 },
      );
    });
  },
  cards(ctx, slide, s) {
    const { pptx, theme, W, H, k, padX, padY } = ctx;
    const y0 = heading(ctx, slide, s.title, kicker(ctx, slide, s.kicker, padY), 32);
    const n = s.cards.length;
    const gap = 0.3 * k;
    const cw = (W - padX * 2 - gap * (n - 1)) / n;
    const ch = Math.min(3.6 * k, H - y0 - padY);
    const y = y0 + (H - y0 - padY - ch) / 2;
    s.cards.forEach((c, i) => {
      const x = padX + i * (cw + gap);
      if (ctx.minimal)
        slide.addShape(pptx.ShapeType.rect, { x, y, w: cw, h: 0.025 * k, fill: { color: hex(i === 0 ? theme.colors.accent : theme.colors.muted) }, line: { type: "none" } });
      else
        slide.addShape(pptx.ShapeType.roundRect, { x, y, w: cw, h: ch, fill: { color: hex(theme.colors.surface), transparency: theme.dark ? 30 : 0 }, line: { color: hex(theme.colors.muted), width: 0.75, transparency: 70 }, rectRadius: 0.12 });
      const inset = ctx.minimal ? 0 : 0.3 * k;
      let ty = y + (ctx.minimal ? 0.3 : 0.35) * k;
      if (looksLikeSvg(c.icon)) {
        addSvg(ctx, slide, c.icon, { x: x + inset, y: ty, w: 0.7 * k, h: 0.7 * k }, "left");
        ty += 0.9 * k;
      } else if (c.label) {
        slide.addText(c.label, { x: x + inset, y: ty, w: cw - inset * 2, h: 0.35 * k, fontFace: theme.fonts.mono, fontSize: 12 * k, color: hex(theme.colors.accent), margin: 0 });
        ty += 0.45 * k;
      }
      const runs: pptxgen.TextProps[] = [{ text: c.title, options: { fontSize: fit(c.title, n === 4 ? 17 : 20, 22) * k, bold: true, color: hex(theme.colors.text), fontFace: theme.fonts.heading, breakLine: !!c.text, paraSpaceAfter: 6 } }];
      if (c.text) runs.push({ text: c.text, options: { fontSize: (n === 4 ? 12 : 14) * k, color: hex(theme.colors.muted) } });
      slide.addText(runs, { x: x + inset, y: ty, w: cw - inset * 2, h: y + ch - ty - 0.2 * k, valign: "top", fontFace: theme.fonts.body, margin: 0 });
    });
  },
  "big-number"(ctx, slide, s) {
    const { theme, W, H, k, padX } = ctx;
    let y = kicker(ctx, slide, s.kicker, H * 0.2);
    const val = `${s.prefix ?? ""}${s.value.toLocaleString("en-US", { minimumFractionDigits: s.decimals ?? 0, maximumFractionDigits: s.decimals ?? 2 })}${s.suffix ?? ""}`;
    slide.addText(val, { x: padX, y, w: W * 0.55, h: 2.2 * k, fontSize: fit(val, 150, 5) * k, bold: !ctx.minimal, color: hex(ctx.minimal ? theme.colors.text : theme.colors.accent), fontFace: theme.fonts.heading, valign: "bottom", margin: 0 });
    slide.addText(s.label, { x: padX + W * 0.55, y: y + 1.2 * k, w: W - padX * 2 - W * 0.55, h: 1.0 * k, fontSize: fit(s.label, 24, 40) * k, bold: true, color: hex(theme.colors.text), fontFace: theme.fonts.heading, valign: "bottom", margin: 0 });
    y += 2.5 * k;
    slide.addShape(ctx.pptx.ShapeType.rect, { x: padX, y, w: ctx.minimal ? W - padX * 2 : 1.2 * k, h: (ctx.minimal ? 0.015 : 0.06) * k, fill: { color: hex(ctx.minimal ? theme.colors.muted : theme.colors.accent), transparency: ctx.minimal ? 60 : 0 }, line: { type: "none" } });
    if (s.context) slide.addText(s.context, { x: padX, y: y + 0.3 * k, w: W * 0.7, h: 1.2 * k, fontSize: 18 * k, color: hex(theme.colors.muted), fontFace: theme.fonts.body, valign: "top", margin: 0 });
  },
  "image-text"(ctx, slide, s) {
    const { theme, W, H, k, padX } = ctx;
    const mw = W * 0.46;
    const left = s.side === "left";
    const mx = left ? 0 : W - mw;
    if (looksLikeSvg(s.svg)) addSvg(ctx, slide, s.svg, { x: mx + 0.5 * k, y: 0.7 * k, w: mw - 1.0 * k, h: H - 1.4 * k }, "center");
    else if (s.src) {
      if (s.fit === "contain") addImage(ctx, slide, s.src, { x: mx + 0.5 * k, y: 0.7 * k, w: mw - 1.0 * k, h: H - 1.4 * k }, "contain");
      else addImage(ctx, slide, s.src, { x: mx, y: 0, w: mw, h: H }, "cover");
    }
    const tx = left ? mw + 0.6 * k : padX;
    const tw = W - mw - padX - 0.6 * k;
    let y = kicker(ctx, slide, s.kicker, H * 0.22, "left", tx, tw);
    slide.addText(s.title, { x: tx, y, w: tw, h: 1.3 * k, fontSize: fit(s.title, 32, 30) * k, bold: true, color: hex(theme.colors.text), fontFace: theme.fonts.heading, valign: "bottom", margin: 0 });
    y += 1.5 * k;
    const runs: pptxgen.TextProps[] = [];
    if (s.text) runs.push({ text: s.text, options: { fontSize: 16 * k, color: hex(theme.colors.muted), breakLine: true, paraSpaceAfter: 10 } });
    for (const b of s.bullets ?? []) runs.push({ text: bulletText(b).text, options: { fontSize: 17 * k, color: hex(theme.colors.text), bullet: { characterCode: ctx.minimal ? "2014" : "203A" }, breakLine: true, paraSpaceAfter: 6 } });
    if (runs.length) slide.addText(runs, { x: tx, y, w: tw, h: H - y - 0.7 * k, valign: "top", fontFace: theme.fonts.body, margin: 0 });
  },
  quote(ctx, slide, s) {
    const { theme, W, H, k, padX } = ctx;
    let x = padX;
    if (s.src) {
      const d = 2.4 * k;
      const p = imagePath(ctx, s.src);
      if (p) {
        const size = /^https?:/.test(p) ? undefined : imageSize(p);
        slide.addImage({ path: p, x: padX, y: H / 2 - d / 2, w: size ? size.w / 96 : d, h: size ? size.h / 96 : d, sizing: { type: "cover", w: d, h: d }, rounding: true });
      }
      x = padX + d + 0.7 * k;
    }
    const w = W - x - padX;
    slide.addText("“", { x, y: H * 0.18, w: 1 * k, h: 1 * k, fontSize: 80 * k, color: hex(theme.colors.accent), fontFace: theme.fonts.heading, margin: 0 });
    slide.addText(s.text, { x, y: H * 0.3, w, h: H * 0.36, fontSize: fit(s.text, 28, 110) * k, bold: !ctx.minimal, color: hex(theme.colors.text), fontFace: theme.fonts.heading, valign: "top", margin: 0 });
    slide.addText(
      [
        { text: s.author, options: { bold: true, fontSize: 16 * k, color: hex(theme.colors.text), breakLine: !!s.role } },
        ...(s.role ? [{ text: s.role, options: { fontSize: 13 * k, color: hex(theme.colors.muted) } }] : []),
      ],
      { x, y: H * 0.7, w, h: 0.8 * k, fontFace: theme.fonts.body, valign: "top", margin: 0 },
    );
  },
  comparison(ctx, slide, s) {
    const { theme, W, H, k, padX, padY } = ctx;
    const y0 = heading(ctx, slide, s.title, undefined, 32);
    const hl = s.highlight ? s.highlight - 1 : -1;
    const cols = s.columns.length;
    const labelW = (W - padX * 2) * 0.32;
    const colW = (W - padX * 2 - labelW) / cols;
    const rowH = Math.min(0.62 * k, (H - y0 - padY) / (s.rows.length + 1));
    const fmt = (v: string | number | boolean | undefined) => (v === true ? "✓" : v === false || v === undefined || v === "" ? "—" : String(v));
    const line: pptxgen.BorderProps = { type: "solid", pt: 0.5, color: hex(theme.colors.muted) };
    const none: pptxgen.BorderProps = { type: "none" };
    // Only a bottom hairline per cell (top, right, bottom, left).
    const rule: [pptxgen.BorderProps, pptxgen.BorderProps, pptxgen.BorderProps, pptxgen.BorderProps] = [none, none, line, none];
    const header: pptxgen.TableRow = [
      { text: "", options: { border: rule } },
      ...s.columns.map((c, ci) => ({
        text: c,
        options: { bold: true, align: "center" as const, color: hex(ci === hl ? theme.colors.accent : theme.colors.muted), border: rule },
      })),
    ];
    const rows: pptxgen.TableRow[] = s.rows.map((r) => [
      { text: r.label, options: { bold: true, color: hex(theme.colors.text), border: rule } },
      ...s.columns.map((_, ci) => {
        const v = r.values[ci];
        return {
          text: fmt(v),
          options: {
            align: "center" as const,
            bold: ci === hl,
            color: hex(v === true ? theme.colors.accent : v === false || v === undefined ? theme.colors.muted : theme.colors.text),
            fill: ci === hl ? { color: hex(theme.colors.accent), transparency: theme.dark ? 85 : 92 } : undefined,
            border: rule,
          },
        };
      }),
    ]);
    slide.addTable([header, ...rows], {
      x: padX,
      y: y0,
      w: W - padX * 2,
      colW: [labelW, ...s.columns.map(() => colW)],
      rowH,
      fontFace: theme.fonts.body,
      fontSize: 14 * k,
      color: hex(theme.colors.text),
      valign: "middle",
      margin: 0.05,
    });
  },
  visual(ctx, slide, s) {
    const { theme, W, H, k, padX, padY } = ctx;
    let y = kicker(ctx, slide, s.kicker, padY);
    if (s.title) y = heading(ctx, slide, s.title, y, 30);
    const bottom = s.caption ? 0.5 * k : 0;
    const box = { x: padX, y, w: W - padX * 2, h: H - y - padY - bottom };
    const hasNotes = !!(s.text || s.bullets?.length);
    if (s.position !== "center" && hasNotes) {
      const vw = box.w * 0.58;
      const nx = s.position === "left" ? box.x + vw + 0.5 * k : box.x;
      const vx = s.position === "left" ? box.x : box.x + box.w - vw;
      if (s.svg) addSvg(ctx, slide, s.svg, { x: vx, y: box.y, w: vw, h: box.h }, "center");
      const runs: pptxgen.TextProps[] = [];
      if (s.text) runs.push({ text: s.text, options: { fontSize: 16 * k, color: hex(theme.colors.muted), breakLine: true, paraSpaceAfter: 10 } });
      for (const b of s.bullets ?? []) runs.push({ text: bulletText(b).text, options: { fontSize: 17 * k, color: hex(theme.colors.text), bullet: { characterCode: "2014" }, breakLine: true, paraSpaceAfter: 6 } });
      slide.addText(runs, { x: nx, y: box.y, w: box.w - vw - 0.5 * k, h: box.h, valign: "middle", fontFace: theme.fonts.body, margin: 0 });
    } else if (s.svg) addSvg(ctx, slide, s.svg, box, "center");
    if (s.caption) slide.addText(s.caption, { x: padX, y: H - padY - 0.45 * k, w: W - padX * 2, h: 0.45 * k, fontSize: 13 * k, color: hex(theme.colors.muted), align: s.position === "center" ? "center" : "left", fontFace: theme.fonts.body, margin: 0 });
  },
};

/** Places a rasterized SVG (contain-fit) or a note when it wasn't rendered. */
function addSvg(ctx: Ctx, slide: PSlide, svg: string, box: { x: number; y: number; w: number; h: number }, align: "left" | "center") {
  const png = ctx.svgImages[svgKey(svg)];
  if (!png) {
    slide.addText("[SVG visual — render with the pptx format via motionstudio render]", { ...box, fontSize: 12, color: hex(ctx.theme.colors.muted), align: "center", valign: "middle" });
    return;
  }
  const ar = svgAspect(svg);
  const w = Math.min(box.w, box.h * ar);
  const h = w / ar;
  slide.addImage({ path: png, x: align === "center" ? box.x + (box.w - w) / 2 : box.x, y: box.y + (box.h - h) / 2, w, h });
}

function column(ctx: Ctx, slide: PSlide, col: ColumnSpec, box: { x: number; y: number; w: number; h: number }, color: string) {
  const { pptx, theme, k } = ctx;
  slide.addShape(pptx.ShapeType.roundRect, { ...box, fill: { color: hex(theme.colors.surface), transparency: theme.dark ? 30 : 0 }, line: { color: hex(color), width: 1, transparency: 50 }, rectRadius: 0.15 });
  const inner = { x: box.x + 0.35 * k, w: box.w - 0.7 * k };
  let y = box.y + 0.3 * k;
  if (col.heading) {
    slide.addText(col.heading, { ...inner, y, h: 0.6 * k, fontSize: 22 * k, bold: true, color: hex(color), fontFace: theme.fonts.heading, margin: 0 });
    y += 0.7 * k;
  }
  const runs: pptxgen.TextProps[] = [];
  if (col.text) runs.push({ text: col.text, options: { fontSize: 18 * k, color: hex(theme.colors.text), breakLine: true, paraSpaceAfter: 8 } });
  for (const b of col.bullets ?? []) {
    const { text, sub } = bulletText(b);
    runs.push({ text: sub ? `${text} — ${sub}` : text, options: { fontSize: 20 * k, color: hex(theme.colors.text), bullet: { characterCode: "203A" }, breakLine: true, paraSpaceAfter: 10 } });
  }
  const textH = runs.length ? Math.min(box.h - (y - box.y) - 0.3 * k, (col.src ? 0.45 : 1) * (box.h - (y - box.y) - 0.3 * k)) : 0;
  if (runs.length) slide.addText(runs, { ...inner, y, h: textH, valign: "top", fontFace: theme.fonts.body, margin: 0 });
  if (col.src) {
    const iy = y + textH + 0.15 * k;
    addImage(ctx, slide, col.src, { x: inner.x, y: iy, w: inner.w, h: box.y + box.h - iy - 0.3 * k }, "cover");
  }
}
