import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import type { SlideSpec } from "../../spec";
import { alpha, fontStack, type Theme } from "../../themes";
import { Reveal, fitSize, useCountUp, useLook, useTheme } from "../anim";
import { useU } from "../Background";
import { Heading, Stage } from "./common";

type Of<L extends SlideSpec["layout"]> = Extract<SlideSpec, { layout: L }>;

export function seriesColors(theme: Theme): string[] {
  const c = theme.colors;
  return [c.accent, c.accent2, alpha(c.text, 0.75), alpha(c.accent, 0.55), alpha(c.accent2, 0.55), c.muted];
}

const StatCard: React.FC<{ stat: Of<"stat">["stats"][number]; index: number; count: number }> = ({ stat, index, count }) => {
  const u = useU();
  const theme = useTheme();
  const lk = useLook();
  const delay = 10 + index * 10;
  const value = useCountUp(stat.value, delay, 45, stat.decimals ?? (Number.isInteger(stat.value) ? 0 : 1));
  const big = count === 1 ? 220 : count === 2 ? 170 : count === 3 ? 130 : 110;
  return (
    <Reveal delay={delay} from="up" style={{ flex: 1, display: "flex" }}>
      <div
        style={{
          ...lk.card(u, lk.minimal && index > 0 ? "none" : "accent"),
          padding: lk.cardPad(u),
          textAlign: lk.minimal ? "left" : "center",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: fontStack(theme.fonts.heading),
            fontSize: u(big),
            fontWeight: lk.minimal ? 500 : 800,
            lineHeight: 1,
            letterSpacing: lk.minimal ? "-0.05em" : "-0.04em",
            ...lk.numberText(),
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {stat.prefix ?? ""}
          {value}
          {stat.suffix ?? ""}
        </div>
        <div style={{ marginTop: u(24), fontSize: u(fitSize(stat.label, 34, 40)), color: theme.colors.muted, lineHeight: 1.3 }}>{stat.label}</div>
      </div>
    </Reveal>
  );
};

export const StatSlide: React.FC<{ slide: Of<"stat"> }> = ({ slide }) => {
  const u = useU();
  return (
    <Stage style={{ justifyContent: slide.title ? "flex-start" : "center" }}>
      {slide.title ? <Heading text={slide.title} delay={0} /> : null}
      <div style={{ flex: slide.title ? 1 : undefined, display: "flex", alignItems: "center" }}>
        <div style={{ flex: 1, display: "flex", alignItems: "stretch", gap: u(40) }}>
          {slide.stats.map((s, i) => (
            <StatCard key={i} stat={s} index={i} count={slide.stats.length} />
          ))}
        </div>
      </div>
    </Stage>
  );
};

export const ChartSlide: React.FC<{ slide: Of<"chart"> }> = ({ slide }) => {
  const u = useU();
  const theme = useTheme();
  const { chart } = slide;
  const colors = seriesColors(theme);
  return (
    <Stage>
      <Heading text={slide.title} delay={0} size={64} />
      <div style={{ flex: 1, display: "flex", gap: u(50), minHeight: 0 }}>
        <div style={{ flex: 1, position: "relative" }}>
          {chart.type === "bar" ? <BarChart slide={slide} /> : chart.type === "line" ? <LineChart slide={slide} /> : <DonutChart slide={slide} />}
        </div>
        {chart.series.length > 1 || chart.type === "donut" ? (
          <div style={{ width: u(340), display: "flex", flexDirection: "column", justifyContent: "center", gap: u(20) }}>
            {(chart.type === "donut" ? chart.labels : chart.series.map((s) => s.name)).map((name, i) => (
              <Reveal key={i} delay={30 + i * 6} from="right" distance={u(30)}>
                <div style={{ display: "flex", alignItems: "center", gap: u(16), fontSize: u(28) }}>
                  <div style={{ width: u(22), height: u(22), borderRadius: u(6), background: colors[i % colors.length] }} />
                  <span>{name}</span>
                </div>
              </Reveal>
            ))}
          </div>
        ) : null}
      </div>
      {slide.caption ? (
        <Reveal delay={40}>
          <div style={{ marginTop: u(20), fontSize: u(28), color: theme.colors.muted }}>{slide.caption}</div>
        </Reveal>
      ) : null}
    </Stage>
  );
};

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((x) => n <= x) ?? 10;
  return step * p;
}

function fmt(v: number, unit?: string) {
  const s = Math.abs(v) >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : String(Math.round(v * 10) / 10);
  return unit ? `${s}${unit}` : s;
}

const Axis: React.FC<{ W: number; H: number; max: number; unit?: string }> = ({ W, H, max, unit }) => {
  const u = useU();
  const theme = useTheme();
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <g>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={u(90)} x2={W} y1={H - t * H} y2={H - t * H} stroke={alpha(theme.colors.text, 0.1)} strokeWidth={u(2)} />
          <text x={u(75)} y={H - t * H + u(9)} textAnchor="end" fontSize={u(24)} fill={theme.colors.muted}>
            {fmt(max * t, unit)}
          </text>
        </g>
      ))}
    </g>
  );
};

function useChartBox() {
  const u = useU();
  const { width, height } = useVideoConfig();
  const scale = u(1);
  // Plot box inside the layout's free area (approximate; SVG uses viewBox so it scales to fit).
  return { W: 1400 * scale, H: 560 * scale, labelH: 60 * scale, width, height };
}

const BarChart: React.FC<{ slide: Of<"chart"> }> = ({ slide }) => {
  const u = useU();
  const theme = useTheme();
  const lk = useLook();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { W, H, labelH } = useChartBox();
  const { labels, series, unit } = slide.chart;
  const colors = seriesColors(theme);
  const max = niceMax(Math.max(...series.flatMap((s) => s.values)));
  const left = u(100);
  const groupW = (W - left) / labels.length;
  const barW = Math.min(u(110), (groupW * 0.7) / series.length);
  return (
    <svg viewBox={`0 0 ${W} ${H + labelH}`} style={{ width: "100%", height: "100%", overflow: "visible", fontFamily: fontStack(theme.fonts.body) }}>
      <Axis W={W} H={H} max={max} unit={unit} />
      {labels.map((label, li) => {
        const gx = left + li * groupW + groupW / 2 - (barW * series.length) / 2;
        return (
          <g key={li}>
            {series.map((s, si) => {
              const v = s.values[li] ?? 0;
              const p = spring({ frame: frame - 14 - li * 5 - si * 3, fps, config: { damping: 16, stiffness: 90 } });
              const h = (v / max) * H * p;
              const x = gx + si * barW;
              return (
                <g key={si}>
                  <rect x={x + u(4)} y={H - h} width={barW - u(8)} height={h} rx={lk.radius(u, 10)} fill={colors[si % colors.length]} />
                  <text
                    x={x + barW / 2}
                    y={H - h - u(14)}
                    textAnchor="middle"
                    fontSize={u(24)}
                    fontWeight={700}
                    fill={theme.colors.text}
                    opacity={interpolate(p, [0.7, 1], [0, 1], { extrapolateLeft: "clamp" })}
                  >
                    {fmt(v, unit)}
                  </text>
                </g>
              );
            })}
            <text x={left + li * groupW + groupW / 2} y={H + u(44)} textAnchor="middle" fontSize={u(26)} fill={theme.colors.muted}>
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const LineChart: React.FC<{ slide: Of<"chart"> }> = ({ slide }) => {
  const u = useU();
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { W, H, labelH } = useChartBox();
  const { labels, series, unit } = slide.chart;
  const colors = seriesColors(theme);
  const max = niceMax(Math.max(...series.flatMap((s) => s.values)));
  const left = u(130);
  const step = labels.length > 1 ? (W - left - u(40)) / (labels.length - 1) : 0;
  const progress = interpolate(frame, [12, 12 + 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  return (
    <svg viewBox={`0 0 ${W} ${H + labelH}`} style={{ width: "100%", height: "100%", overflow: "visible", fontFamily: fontStack(theme.fonts.body) }}>
      <defs>
        {series.map((_, si) => (
          <linearGradient key={si} id={`fill${si}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={colors[si % colors.length]} stopOpacity={0.3} />
            <stop offset="100%" stopColor={colors[si % colors.length]} stopOpacity={0} />
          </linearGradient>
        ))}
        <clipPath id="reveal">
          <rect x={0} y={-u(60)} width={left + (W - left) * progress} height={H + u(120)} />
        </clipPath>
      </defs>
      <Axis W={W} H={H} max={max} unit={unit} />
      {labels.map((l, i) => (
        <text key={i} x={left + i * step} y={H + u(44)} textAnchor="middle" fontSize={u(26)} fill={theme.colors.muted}>
          {l}
        </text>
      ))}
      <g clipPath="url(#reveal)">
        {series.map((s, si) => {
          const pts = s.values.map((v, i) => [left + i * step, H - (v / max) * H] as const);
          const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
          const area = `${d} L${pts[pts.length - 1][0]},${H} L${pts[0][0]},${H} Z`;
          const color = colors[si % colors.length];
          return (
            <g key={si}>
              {series.length === 1 ? <path d={area} fill={`url(#fill${si})`} /> : null}
              <path d={d} fill="none" stroke={color} strokeWidth={u(7)} strokeLinecap="round" strokeLinejoin="round" />
              {pts.map(([x, y], i) => (
                <g key={i}>
                  <circle cx={x} cy={y} r={u(11)} fill={theme.colors.bg} stroke={color} strokeWidth={u(5)} />
                  {series.length === 1 ? (
                    <text x={x} y={y - u(26)} textAnchor="middle" fontSize={u(24)} fontWeight={700} fill={theme.colors.text}>
                      {fmt(s.values[i], unit)}
                    </text>
                  ) : null}
                </g>
              ))}
            </g>
          );
        })}
      </g>
    </svg>
  );
};

const DonutChart: React.FC<{ slide: Of<"chart"> }> = ({ slide }) => {
  const u = useU();
  const theme = useTheme();
  const frame = useCurrentFrame();
  const { W, H, labelH } = useChartBox();
  const values = slide.chart.series[0].values;
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const colors = seriesColors(theme);
  const cx = W / 2;
  const cy = (H + labelH) / 2;
  const r = Math.min(W, H + labelH) * 0.38;
  const sw = r * 0.34;
  const C = 2 * Math.PI * r;
  const progress = interpolate(frame, [10, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  let acc = 0;
  return (
    <svg viewBox={`0 0 ${W} ${H + labelH}`} style={{ width: "100%", height: "100%", fontFamily: fontStack(theme.fonts.heading) }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={alpha(theme.colors.text, 0.08)} strokeWidth={sw} />
      {values.map((v, i) => {
        const frac = v / total;
        const start = acc;
        acc += frac;
        const visible = Math.max(0, Math.min(frac, progress - start));
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={colors[i % colors.length]}
            strokeWidth={sw}
            strokeDasharray={`${visible * C} ${C}`}
            strokeDashoffset={-start * C}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        );
      })}
      <text x={cx} y={cy + u(10)} textAnchor="middle" dominantBaseline="middle" fontSize={u(84)} fontWeight={800} fill={theme.colors.text} opacity={progress}>
        {Math.round((values[0] / total) * 100)}%
      </text>
      <text x={cx} y={cy + u(70)} textAnchor="middle" fontSize={u(26)} fill={theme.colors.muted} opacity={progress}>
        {slide.chart.labels[0]}
      </text>
    </svg>
  );
};
