// Inline SVG with frame-driven animation: strokes draw on, fills and text fade in, in steps.
//
// Sequencing: elements marked data-step="1", "2", … animate in step order (same step = together;
// unmarked content is visible from the start). Without data-step, the top-level children of the SVG
// (descending through a single wrapping <g>) animate one after another.
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { fontStack } from "../themes";
import { prepareSvg } from "../svg-utils";
import { useTheme } from "./anim";

export type SvgAnimate = "draw" | "fade" | "none";

const SKIP = new Set(["defs", "style", "title", "desc", "metadata", "lineargradient", "radialgradient", "clippath", "mask", "pattern", "marker", "symbol"]);
const GEOMETRY = "path, line, polyline, polygon, circle, ellipse, rect";

type Prepared = {
  groups: Element[][];
  shapes: Map<Element, { len: number; stroked: boolean; fillOpacity: number }>;
};

function prepare(root: SVGSVGElement): Prepared {
  const stepped = [...root.querySelectorAll("[data-step]")];
  let groups: Element[][];
  if (stepped.length) {
    const byStep = new Map<number, Element[]>();
    for (const el of stepped) {
      const k = parseFloat(el.getAttribute("data-step") ?? "0") || 0;
      byStep.set(k, [...(byStep.get(k) ?? []), el]);
    }
    groups = [...byStep.entries()].sort((a, b) => a[0] - b[0]).map(([, els]) => els);
  } else {
    let container: Element = root;
    for (;;) {
      const kids = [...container.children].filter((c) => !SKIP.has(c.tagName.toLowerCase()));
      if (kids.length === 1 && kids[0].tagName.toLowerCase() === "g" && kids[0].children.length > 1) container = kids[0];
      else {
        groups = kids.map((k) => [k]);
        break;
      }
    }
  }
  const shapes = new Map<Element, { len: number; stroked: boolean; fillOpacity: number }>();
  for (const g of groups)
    for (const el of g) {
      const list = el.matches(GEOMETRY) ? [el, ...el.querySelectorAll(GEOMETRY)] : [...el.querySelectorAll(GEOMETRY)];
      for (const s of list) {
        const cs = getComputedStyle(s);
        const stroked = cs.stroke !== "none" && cs.stroke !== "" && parseFloat(cs.strokeWidth || "1") > 0;
        let len = 0;
        try {
          len = stroked ? (s as SVGGeometryElement).getTotalLength() : 0;
        } catch {
          len = 0;
        }
        shapes.set(s, { len, stroked: stroked && len > 0, fillOpacity: parseFloat(cs.fillOpacity || "1") });
      }
    }
  return { groups, shapes };
}

export const SvgVisual: React.FC<{
  svg: string;
  animate?: SvgAnimate;
  delay?: number;
  /** Seconds between steps. Default spreads steps over ~2s. */
  stepSec?: number;
  style?: React.CSSProperties;
}> = ({ svg, animate = "draw", delay = 0, stepSec, style }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const html = useMemo(() => prepareSvg(svg, theme), [svg, theme]);
  const ref = useRef<HTMLDivElement>(null);
  const prepared = useRef<{ html: string; data: Prepared } | null>(null);

  useLayoutEffect(() => {
    const root = ref.current?.querySelector("svg");
    if (!root) return;
    if (!prepared.current || prepared.current.html !== html) prepared.current = { html, data: prepare(root) };
    const { groups, shapes } = prepared.current.data;
    const n = Math.max(1, groups.length);
    const step = stepSec !== undefined ? stepSec * fps : Math.max(3, Math.min(12, Math.round((2 * fps) / n)));
    const dur = animate === "draw" ? Math.round(0.9 * fps) : Math.round(0.5 * fps);

    groups.forEach((els, gi) => {
      const start = delay + gi * step;
      const p = animate === "none" ? 1 : interpolate(frame, [start, start + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
      for (const el of els) {
        const h = el as SVGElement;
        if (animate !== "draw") {
          h.style.opacity = String(p);
          continue;
        }
        // Draw: strokes trace in, then fills fade in; elements without stroke simply fade.
        const pStroke = Math.min(1, p / 0.75);
        const pFill = Math.max(0, (p - 0.35) / 0.65);
        const list = el.matches(GEOMETRY) ? [el, ...el.querySelectorAll(GEOMETRY)] : [...el.querySelectorAll(GEOMETRY)];
        for (const s of list) {
          const info = shapes.get(s);
          if (!info) continue;
          const ss = (s as SVGElement).style;
          if (info.stroked) {
            ss.strokeDasharray = `${info.len} ${info.len}`;
            ss.strokeDashoffset = String(info.len * (1 - pStroke));
            ss.fillOpacity = String(info.fillOpacity * pFill);
          } else {
            ss.opacity = String(pFill);
          }
        }
        for (const t of el.matches("text") ? [el] : [...el.querySelectorAll("text, image, use")]) (t as SVGElement).style.opacity = String(pFill);
        if (!list.length && !el.matches("text")) h.style.opacity = String(pFill);
      }
    });
  }, [frame, html, animate, delay, stepSec, fps]);

  return (
    <div
      ref={ref}
      style={{ width: "100%", height: "100%", color: "inherit", fontFamily: fontStack(theme.fonts.body), ...style }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
