// Narration script (Markdown) and subtitles (SRT) from the deck timeline.
import type { DeckSpec, SlideSpec } from "../spec";
import { bulletText } from "../spec";
import { captionCues, formatTimestamp, type Timeline } from "../timeline";

export function slideHeadline(s: SlideSpec): string {
  switch (s.layout) {
    case "statement":
      return s.text.length > 60 ? s.text.slice(0, 57) + "…" : s.text;
    case "stat":
      return s.title ?? s.stats.map((x) => `${x.prefix ?? ""}${x.value}${x.suffix ?? ""} ${x.label}`).join(" · ");
    case "image":
      return s.title ?? s.caption ?? s.src ?? s.generate?.prompt ?? "Image";
    case "code":
      return s.title ?? "Code";
    case "big-number":
      return `${s.prefix ?? ""}${s.value}${s.suffix ?? ""} ${s.label}`;
    case "quote":
      return `“${s.text.length > 50 ? s.text.slice(0, 47) + "…" : s.text}” — ${s.author}`;
    case "visual":
      return s.title ?? s.caption ?? "Visual";
    default:
      return s.title;
  }
}

/** On-screen text of a slide, for the script's "On screen" line. */
export function onScreenText(s: SlideSpec): string[] {
  switch (s.layout) {
    case "title":
    case "section":
    case "end":
      return [s.title, "subtitle" in s ? s.subtitle : undefined, "cta" in s ? s.cta : undefined].filter(Boolean) as string[];
    case "bullets":
      return s.bullets.map((b) => bulletText(b).text);
    case "statement":
      return [s.text + (s.attribution ? ` — ${s.attribution}` : "")];
    case "stat":
      return s.stats.map((x) => `${x.prefix ?? ""}${x.value}${x.suffix ?? ""} — ${x.label}`);
    case "chart":
      return [`${s.chart.type} chart: ${s.chart.series.map((x) => x.name).join(", ")} over ${s.chart.labels.join(", ")}`];
    case "timeline":
      return s.items.map((i) => `${i.label}: ${i.title}`);
    case "split":
      return [s.left.heading, s.right.heading].filter(Boolean) as string[];
    case "image":
      return [s.caption ?? ""].filter(Boolean);
    case "code":
      return [`${s.code.split("\n").length} lines of ${s.language ?? "code"}`];
    case "agenda":
      return s.items;
    case "cards":
      return s.cards.map((c) => c.title);
    case "big-number":
      return [`${s.prefix ?? ""}${s.value}${s.suffix ?? ""} — ${s.label}`, s.context ?? ""].filter(Boolean);
    case "image-text":
      return [s.title, ...(s.bullets ?? []).map((b) => bulletText(b).text)];
    case "quote":
      return [`“${s.text}” — ${s.author}${s.role ? `, ${s.role}` : ""}`];
    case "comparison":
      return [`Table: ${s.columns.join(" vs ")} across ${s.rows.map((r) => r.label).join(", ")}`];
    case "visual":
      return [s.caption ?? "SVG visual", ...(s.bullets ?? []).map((b) => bulletText(b).text)].filter(Boolean);
  }
}

export function scriptMarkdown(deck: DeckSpec, tl: Timeline): string {
  const total = formatTimestamp(tl.totalFrames, tl.fps);
  const words = deck.slides.reduce((a, s) => a + (s.narration?.split(/\s+/).filter(Boolean).length ?? 0), 0);
  const lines = [
    `# ${deck.title} — Script`,
    "",
    `${deck.author ? `**Author:** ${deck.author} · ` : ""}**Runtime:** ${total} · **Slides:** ${deck.slides.length} · **Narration:** ~${words} words`,
    "",
  ];
  for (const t of tl.slides) {
    const s = t.slide;
    lines.push(`## ${t.index + 1}. ${slideHeadline(s)}`);
    lines.push(`\`${formatTimestamp(t.from, tl.fps)} – ${formatTimestamp(t.from + t.durationInFrames, tl.fps)}\` · layout: ${s.layout}`);
    lines.push("");
    const screen = onScreenText(s);
    if (screen.length) lines.push(`**On screen:** ${screen.join(" / ")}`, "");
    if (s.narration) lines.push(`**Narration:**`, "", `> ${s.narration.replace(/\n+/g, "\n> ")}`, "");
    if (s.notes) lines.push(`**Notes:** ${s.notes}`, "");
  }
  return lines.join("\n");
}

export function srt(tl: Timeline): string {
  const cues: string[] = [];
  let n = 1;
  for (const t of tl.slides) {
    if (!t.slide.narration) continue;
    const len = t.audio ? Math.round(t.audio.durationSec * tl.fps) : t.durationInFrames - t.audioStart - t.transitionOut;
    for (const c of captionCues(t.slide.narration, t.from + t.audioStart, len)) {
      cues.push(`${n++}\n${formatTimestamp(c.from, tl.fps, true)} --> ${formatTimestamp(c.to, tl.fps, true)}\n${c.text}\n`);
    }
  }
  return cues.join("\n");
}
