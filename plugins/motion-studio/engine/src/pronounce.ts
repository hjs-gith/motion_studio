// Turns narration into what the TTS should actually say, for mixed-language text.
//
// Supertonic voices one language per call, so "오늘은 AI에서 Prompt를…" would read the English with
// Korean rules. Before synthesis we:
//   1. apply the deck's lexicon (spoken respellings: "Prompt" → "프롬프트"),
//   2. spell all-caps acronyms with the deck language's letter names (AI → 에이아이),
//   3. voice longer Latin-script phrases (≥ voice.splitLatinPhrases words) as separate English segments,
//   4. report leftover Latin words so a lexicon entry can be added.
// Only the audio changes; slides, script, captions and SRT keep the original text.

export type SpeechSegment = { text: string; lang: string };

/** Languages whose segments the Supertonic worker paces sentence by sentence (see tts/synth.py). */
export const PACED_LANGS = ["ko"];
/** Bump when pacing behavior changes: it is part of the clip hash, so affected clips regenerate once. */
export const PACE_VERSION = 1;

/** Whether sentence pacing applies to these segments for this voice setup. */
export function pacingApplies(engine: string, pace: boolean, segments: SpeechSegment[]): boolean {
  if (engine !== "supertonic" || !pace || process.env.MOTION_STUDIO_TTS_PACE === "0") return false;
  return segments.some((s) => PACED_LANGS.includes(s.lang.split("-")[0].toLowerCase()));
}
export type PreparedSpeech = { segments: SpeechSegment[]; unknownWords: string[] };

export type PronounceOptions = {
  lang: string;
  lexicon?: Record<string, string>;
  spellAcronyms?: boolean;
  splitLatinPhrases?: number;
};

/** Languages written mainly in Latin script: no segmentation or acronym spelling needed. */
const LATIN_LANGS = new Set(["en", "es", "fr", "de", "it", "pt", "nl", "sv", "da", "fi", "et", "lv", "lt", "pl", "cs", "sk", "sl", "hr", "hu", "ro", "tr", "id", "vi"]);

const LETTER_NAMES: Record<string, Record<string, string>> = {
  ko: {
    A: "에이", B: "비", C: "씨", D: "디", E: "이", F: "에프", G: "지", H: "에이치", I: "아이", J: "제이", K: "케이", L: "엘", M: "엠",
    N: "엔", O: "오", P: "피", Q: "큐", R: "알", S: "에스", T: "티", U: "유", V: "브이", W: "더블유", X: "엑스", Y: "와이", Z: "지",
  },
  ja: {
    A: "エー", B: "ビー", C: "シー", D: "ディー", E: "イー", F: "エフ", G: "ジー", H: "エイチ", I: "アイ", J: "ジェー", K: "ケー", L: "エル", M: "エム",
    N: "エヌ", O: "オー", P: "ピー", Q: "キュー", R: "アール", S: "エス", T: "ティー", U: "ユー", V: "ブイ", W: "ダブリュー", X: "エックス", Y: "ワイ", Z: "ゼット",
  },
};

/** Built-in spoken forms for common terms, used when the deck lexicon has no entry. */
const DEFAULT_LEXICON: Record<string, Record<string, string>> = {
  ko: { NASA: "나사", UNESCO: "유네스코", COVID: "코비드", NATO: "나토", OPEC: "오펙", LED: "엘이디", SaaS: "사스", iPhone: "아이폰", YouTube: "유튜브", ChatGPT: "챗지피티", OpenAI: "오픈에이아이", GitHub: "깃허브" },
  ja: {},
};

const LATIN_WORD = String.raw`[A-Za-z][A-Za-z0-9'’.+\-]*`;
/** A run of Latin words separated by spaces or in-sentence punctuation (numbers may sit between them), plus closing punctuation. */
const LATIN_RUN = new RegExp(String.raw`${LATIN_WORD}(?:[,;:]?[ \t]+(?:${LATIN_WORD}|\d[\d.,]*))*[.!?]?`, "g");

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Replaces lexicon words (whole-word, case-insensitive; longest keys first). */
export function applyLexicon(text: string, lexicon: Record<string, string>): string {
  const keys = Object.keys(lexicon).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!keys.length) return text;
  const lower = new Map(keys.map((k) => [k.toLowerCase(), lexicon[k]]));
  const re = new RegExp(`(?<![A-Za-z0-9])(?:${keys.map(escapeRe).join("|")})(?![A-Za-z0-9])`, "gi");
  return text.replace(re, (m) => lower.get(m.toLowerCase()) ?? m);
}

/** Strips stage directions like [pause] and markdown emphasis. */
export function cleanNarration(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function spellAcronym(word: string, letters: Record<string, string>): string | undefined {
  // "AI", "GPU", "GPT-4" → letters (+ number kept); "iPhone" or "Prompt" aren't acronyms.
  const m = /^([A-Z]{1,6})(?:[-]?(\d+[A-Za-z]?))?$/.exec(word);
  if (!m) return undefined;
  const spelled = [...m[1]].map((c) => letters[c]).join("");
  return m[2] ? `${spelled} ${m[2]}` : spelled;
}

export function prepareSpeech(narration: string, opts: PronounceOptions): PreparedSpeech {
  const lang = (opts.lang || "en").split("-")[0].toLowerCase();
  const lexicon = { ...(DEFAULT_LEXICON[lang] ?? {}), ...(opts.lexicon ?? {}) };
  let text = applyLexicon(cleanNarration(narration), lexicon);
  if (LATIN_LANGS.has(lang)) return { segments: [{ text, lang }], unknownWords: [] };

  const letters = LETTER_NAMES[lang];
  const splitAt = opts.splitLatinPhrases ?? 4;
  const unknown = new Set<string>();
  const segments: SpeechSegment[] = [];
  let cursor = 0;
  const pushNative = (s: string) => {
    if (!s) return;
    const last = segments[segments.length - 1];
    if (last && last.lang === lang) last.text += s;
    else segments.push({ text: s, lang });
  };

  for (const m of text.matchAll(LATIN_RUN)) {
    const run = m[0];
    const start = m.index!;
    const words = run.split(/[ \t,;:]+/).filter((w) => /[A-Za-z]/.test(w));
    if (splitAt > 0 && words.length >= splitAt) {
      pushNative(text.slice(cursor, start));
      segments.push({ text: run, lang: "en" });
      cursor = start + run.length;
      continue;
    }
    // Short run: spell acronyms; leave other words (and report them) for the lexicon.
    const spoken = run.replace(new RegExp(LATIN_WORD, "g"), (w) => {
      const bare = w.replace(/[.’'+\-]+$/, "");
      if (opts.spellAcronyms !== false && letters) {
        const s = spellAcronym(bare, letters);
        if (s) return s + w.slice(bare.length);
      }
      unknown.add(bare);
      return w;
    });
    pushNative(text.slice(cursor, start) + spoken);
    cursor = start + run.length;
  }
  pushNative(text.slice(cursor));
  // Fold punctuation-only pieces into the previous segment so nothing is voiced on its own.
  const cleaned: SpeechSegment[] = [];
  for (const seg of segments) {
    const t = seg.text.replace(/\s+/g, " ").trim();
    if (!t) continue;
    if (!/[\p{L}\p{N}]/u.test(t) && cleaned.length) cleaned[cleaned.length - 1].text += t;
    else cleaned.push({ ...seg, text: t });
  }
  return { segments: cleaned.length ? cleaned : [{ text, lang }], unknownWords: [...unknown] };
}

/** Human-readable preview, e.g. `오늘은 에이아이에서 ⟦en: the quick brown fox⟧ …`. */
export function describeSegments(p: PreparedSpeech, deckLang: string): string {
  return p.segments.map((s) => (s.lang === deckLang.split("-")[0] ? s.text : `⟦${s.lang}: ${s.text}⟧`)).join(" ");
}
