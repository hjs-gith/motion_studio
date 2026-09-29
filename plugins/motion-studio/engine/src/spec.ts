// The deck spec: one JSON file drives the video, HTML slides, PPTX, PDF and script.
import { z } from "zod";

export const TRANSITIONS = ["fade", "slide", "wipe", "flip", "clock-wipe", "iris", "none"] as const;
export const BACKGROUNDS = ["orbs", "grid", "dots", "gradient", "solid"] as const;
export const FONTS = [
  "Inter",
  "Space Grotesk",
  "Outfit",
  "Playfair Display",
  "DM Serif Display",
  "JetBrains Mono",
  "Geist",
  "Geist Mono",
  "Manrope",
  "DM Sans",
] as const;
export const STYLES = ["expressive", "minimal"] as const;

const Transition = z.object({
  type: z.enum(TRANSITIONS).default("fade"),
  direction: z.enum(["from-left", "from-right", "from-top", "from-bottom"]).optional(),
  durationSec: z.number().min(0).max(3).default(0.6),
});

const ThemeOverride = z.object({
  preset: z.string().default("midnight"),
  /** "expressive": gradients, glow, springy motion. "minimal": flat accents, hairlines, calm motion. Defaults to the preset's style. */
  style: z.enum(STYLES).optional(),
  colors: z
    .object({
      bg: z.string(),
      bg2: z.string(),
      surface: z.string(),
      text: z.string(),
      muted: z.string(),
      accent: z.string(),
      accent2: z.string(),
    })
    .partial()
    .optional(),
  fonts: z
    .object({ heading: z.enum(FONTS), body: z.enum(FONTS), mono: z.enum(FONTS) })
    .partial()
    .optional(),
  background: z.enum(BACKGROUNDS).optional(),
});

const Common = {
  id: z.string().optional(),
  /** Spoken voice-over for this slide. Becomes the script, speaker notes and TTS input. */
  narration: z.string().optional(),
  /** Extra presenter notes that are not spoken. */
  notes: z.string().optional(),
  /** Minimum on-screen time. Extended automatically to fit narration audio. */
  durationSec: z.number().positive().optional(),
  /** Transition INTO the next slide. */
  transition: Transition.partial().optional(),
  background: z.enum(BACKGROUNDS).optional(),
};

export const IMAGE_QUALITIES = ["low", "medium", "high", "xhigh", "max", "auto"] as const;

/** Ask an image model to create this slide's picture (see `motionstudio images`). */
const Generate = z.object({
  prompt: z.string().min(3),
  /** Provider id; defaults to deck.images.provider. */
  provider: z.string().optional(),
  model: z.string().optional(),
  quality: z.enum(IMAGE_QUALITIES).optional(),
  /** Replaces the deck's house style for this image. */
  style: z.string().optional(),
  background: z.enum(["opaque", "transparent", "auto"]).optional(),
  /** Allow text inside the image (off by default: slides render text natively). */
  allowText: z.boolean().optional(),
});

const Bullet = z.union([z.string(), z.object({ text: z.string(), sub: z.string().optional() })]);
const Column = z.object({
  heading: z.string().optional(),
  text: z.string().optional(),
  bullets: z.array(Bullet).optional(),
  src: z.string().optional(),
  generate: Generate.optional(),
});

export const Slide = z.discriminatedUnion("layout", [
  z.object({ layout: z.literal("title"), kicker: z.string().optional(), title: z.string(), subtitle: z.string().optional(), ...Common }),
  z.object({ layout: z.literal("section"), number: z.string().optional(), title: z.string(), subtitle: z.string().optional(), ...Common }),
  z.object({ layout: z.literal("bullets"), kicker: z.string().optional(), title: z.string(), bullets: z.array(Bullet).min(1).max(7), ...Common }),
  z.object({ layout: z.literal("statement"), text: z.string(), attribution: z.string().optional(), ...Common }),
  z.object({
    layout: z.literal("stat"),
    title: z.string().optional(),
    stats: z
      .array(
        z.object({
          value: z.number(),
          label: z.string(),
          prefix: z.string().optional(),
          suffix: z.string().optional(),
          decimals: z.number().int().min(0).max(4).optional(),
        }),
      )
      .min(1)
      .max(4),
    ...Common,
  }),
  z.object({
    layout: z.literal("chart"),
    title: z.string(),
    chart: z.object({
      type: z.enum(["bar", "line", "donut"]),
      labels: z.array(z.string()).min(1),
      series: z.array(z.object({ name: z.string(), values: z.array(z.number()) })).min(1),
      unit: z.string().optional(),
    }),
    caption: z.string().optional(),
    ...Common,
  }),
  z.object({
    layout: z.literal("image"),
    title: z.string().optional(),
    /** Image file in assets/ or URL. Filled in automatically when `generate` is used. */
    src: z.string().optional(),
    generate: Generate.optional(),
    caption: z.string().optional(),
    fit: z.enum(["cover", "contain"]).default("cover"),
    kenBurns: z.boolean().default(true),
    ...Common,
  }),
  z.object({ layout: z.literal("split"), title: z.string(), left: Column, right: Column, ...Common }),
  z.object({
    layout: z.literal("timeline"),
    title: z.string(),
    items: z.array(z.object({ label: z.string(), title: z.string(), text: z.string().optional() })).min(2).max(6),
    ...Common,
  }),
  z.object({
    layout: z.literal("code"),
    title: z.string().optional(),
    code: z.string(),
    language: z.string().optional(),
    highlight: z.array(z.number().int().positive()).optional(),
    ...Common,
  }),
  z.object({ layout: z.literal("end"), title: z.string(), subtitle: z.string().optional(), cta: z.string().optional(), ...Common }),
  z.object({
    layout: z.literal("agenda"),
    title: z.string().default("Agenda"),
    items: z.array(z.string()).min(2).max(8),
    /** 1-based item to highlight (reuse the agenda as a chapter marker). */
    active: z.number().int().positive().optional(),
    ...Common,
  }),
  z.object({
    layout: z.literal("cards"),
    kicker: z.string().optional(),
    title: z.string(),
    cards: z
      .array(
        z.object({
          title: z.string(),
          text: z.string().optional(),
          /** Short tag shown above the title when there is no icon, e.g. "01" or "Fast". */
          label: z.string().optional(),
          /** Small SVG icon: inline markup or a .svg file in assets/. */
          icon: z.string().optional(),
        }),
      )
      .min(2)
      .max(4),
    ...Common,
  }),
  z.object({
    layout: z.literal("big-number"),
    kicker: z.string().optional(),
    value: z.number(),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
    decimals: z.number().int().min(0).max(4).optional(),
    label: z.string(),
    context: z.string().optional(),
    ...Common,
  }),
  z.object({
    layout: z.literal("image-text"),
    kicker: z.string().optional(),
    title: z.string(),
    text: z.string().optional(),
    bullets: z.array(Bullet).max(5).optional(),
    /** Image file/URL, or a .svg file (animated like `visual`). */
    src: z.string().optional(),
    /** Inline SVG markup instead of src. */
    svg: z.string().optional(),
    generate: Generate.optional(),
    side: z.enum(["left", "right"]).default("right"),
    fit: z.enum(["cover", "contain"]).default("cover"),
    animate: z.enum(["draw", "fade", "none"]).default("draw"),
    ...Common,
  }),
  z.object({
    layout: z.literal("quote"),
    text: z.string(),
    author: z.string(),
    role: z.string().optional(),
    /** Optional portrait image in assets/. */
    src: z.string().optional(),
    ...Common,
  }),
  z.object({
    layout: z.literal("comparison"),
    title: z.string(),
    columns: z.array(z.string()).min(2).max(4),
    rows: z
      .array(z.object({ label: z.string(), values: z.array(z.union([z.string(), z.number(), z.boolean()])) }))
      .min(1)
      .max(8),
    /** 1-based column to emphasize (e.g. "us"). */
    highlight: z.number().int().positive().optional(),
    ...Common,
  }),
  z.object({
    layout: z.literal("visual"),
    kicker: z.string().optional(),
    title: z.string().optional(),
    /** Inline SVG markup. Use var(--accent), var(--text), var(--muted)… or currentColor for theme colors. */
    svg: z.string().optional(),
    /** A .svg file in assets/ (preferred for anything non-trivial). */
    src: z.string().optional(),
    caption: z.string().optional(),
    /** Optional notes beside the visual (used when position is left/right). */
    text: z.string().optional(),
    bullets: z.array(Bullet).max(5).optional(),
    position: z.enum(["center", "left", "right"]).default("center"),
    animate: z.enum(["draw", "fade", "none"]).default("draw"),
    /** Seconds between animation steps (data-step groups). */
    stepSec: z.number().min(0).max(10).optional(),
    ...Common,
  }),
]);

export const Deck = z.object({
  title: z.string(),
  author: z.string().optional(),
  /** BCP-47-ish language code of the content, e.g. "en", "ko". Used for TTS and fonts. */
  lang: z.string().default("en"),
  format: z
    .object({
      width: z.number().int().default(1920),
      height: z.number().int().default(1080),
      fps: z.number().int().default(30),
    })
    .default({ width: 1920, height: 1080, fps: 30 }),
  theme: ThemeOverride.default({ preset: "midnight" }),
  transition: Transition.default({ type: "fade", durationSec: 0.6 }),
  voice: z
    .object({
      engine: z.enum(["none", "supertonic", "say"]).default("none"),
      /** Engine-specific voice: supertonic M1-M5/F1-F5, or a macOS `say` voice. */
      voice: z.string().optional(),
      speed: z.number().min(0.5).max(2).default(1),
      /**
       * Spoken respellings applied before TTS only (slides, script and captions keep the original),
       * e.g. { "Prompt": "프롬프트", "ChatGPT": "챗지피티" }. Whole-word, case-insensitive.
       */
      lexicon: z.record(z.string(), z.string()).default({}),
      /** Read all-caps acronyms letter by letter in the deck language (AI → 에이아이). */
      spellAcronyms: z.boolean().default(true),
      /** In non-Latin-script decks, Latin phrases of at least this many words are voiced in English. 0 = never. */
      splitLatinPhrases: z.number().int().min(0).default(4),
      /**
       * Even out speaking rate between sentences (Supertonic, paced languages such as Korean): voice
       * sentence by sentence and re-voice outliers toward a calibrated rate. Env MOTION_STUDIO_TTS_PACE=0 disables.
       */
      pace: z.boolean().default(true),
    })
    .default({ engine: "none", speed: 1, lexicon: {}, spellAcronyms: true, splitLatinPhrases: 4, pace: true }),
  images: z
    .object({
      provider: z.string().default("openai"),
      model: z.string().optional(),
      quality: z.enum(IMAGE_QUALITIES).default("medium"),
      /** House style appended to every prompt. Defaults to a style derived from the theme. */
      style: z.string().optional(),
    })
    .default({ provider: "openai", quality: "medium" }),
  captions: z.boolean().default(false),
  music: z.object({ src: z.string(), volume: z.number().min(0).max(1).default(0.12) }).optional(),
  slides: z.array(Slide).min(1),
});

export type DeckSpec = z.infer<typeof Deck>;
export type SlideSpec = z.infer<typeof Slide>;
export type BulletSpec = z.infer<typeof Bullet>;
export type ColumnSpec = z.infer<typeof Column>;
export type TransitionSpec = z.infer<typeof Transition>;
export type GenerateSpec = z.infer<typeof Generate>;

export function parseDeck(raw: unknown): DeckSpec {
  const deck = Deck.parse(raw);
  deck.slides.forEach((s, i) => {
    s.id ??= `s${String(i + 1).padStart(2, "0")}`;
  });
  for (const [i, s] of deck.slides.entries()) {
    if (s.layout === "visual" && !s.svg && !s.src) throw new Error(`Slide ${i + 1} (${s.id}, visual) needs "svg" or "src"`);
    if (s.layout === "image-text" && !s.svg && !s.src && !s.generate)
      throw new Error(`Slide ${i + 1} (${s.id}, image-text) needs "src", "svg" or "generate"`);
    if (s.layout === "image" && !s.src && !s.generate) throw new Error(`Slide ${i + 1} (${s.id}, image) needs "src" or "generate"`);
  }
  const ids = new Set<string>();
  for (const s of deck.slides) {
    if (ids.has(s.id!)) throw new Error(`Duplicate slide id "${s.id}"`);
    ids.add(s.id!);
  }
  return deck;
}

export function bulletText(b: BulletSpec): { text: string; sub?: string } {
  return typeof b === "string" ? { text: b } : b;
}
