# deck.json reference

`motionstudio schema` prints the full JSON Schema. This page is the practical guide.

## Top level

```json
{
  "title": "The Deck Title",
  "author": "Optional Name",
  "lang": "en",
  "format": { "width": 1920, "height": 1080, "fps": 30 },
  "theme": { "preset": "minimal", "style": "minimal" },
  "transition": { "type": "fade", "durationSec": 0.6 },
  "voice": { "engine": "none", "voice": "F1", "speed": 1.0 },
  "music": { "src": "music.mp3", "volume": 0.12 },
  "slides": [ ... ]
}
```

| Field | Notes |
|---|---|
| `lang` | Content language code (`en`, `ko`, `ja`, `zh`, `es`…). Drives TTS language. |
| `format` | 1920×1080 default. Vertical (1080×1920) and square (1080×1080) work; layouts scale, but keep text shorter. |
| `theme.preset` | **Minimal**: `minimal` (off-white, near-black text, one orange accent, Geist), `minimal-dark` (near-black, faint grid, Geist), `swiss` (white, red accent, Manrope), `corporate` (white, blue). **Expressive**: `midnight` (dark navy, teal/violet orbs), `aurora` (dark green/cyan gradient), `noir` (black, orange/yellow, grid), `paper` (warm light, serif headings). |
| `theme.style` | `minimal` or `expressive`; defaults to the preset's. **minimal**: flat single-color accents, hairline rules instead of cards, left-aligned editorial title/section/end slides, no glow, calm motion (no blur, no overshoot). **expressive**: gradient headlines and numbers, rounded cards, glow, springy motion. Any preset can take either style. |
| `theme.colors` | Optional overrides: `bg`, `bg2`, `surface`, `text`, `muted`, `accent`, `accent2` (hex). Use for brand colors. In minimal style, `accent` marks emphasis and `accent2` is a second chart series (a neutral gray works best). |
| `theme.fonts` | Optional `heading`/`body`/`mono` from: Geist, Geist Mono, Inter, Manrope, DM Sans, Space Grotesk, Outfit, Playfair Display, DM Serif Display, JetBrains Mono. |
| `theme.background` | `solid`, `grid`, `dots`, `gradient`, `orbs` (animated, except solid). Minimal style softens them. |
| `transition` | Default transition between slides: `fade`, `slide`, `wipe`, `flip`, `clock-wipe`, `iris`, `none`; `direction` (`from-left/right/top/bottom`) for slide/wipe/flip; `durationSec`. |
| `voice.engine` | `none` (no voice-over: timing follows the narration text, subtitles burn in, narration becomes presenter notes), `supertonic`, `say` (macOS, drafts only). See voices.md and "Decks without voice-over" below. |
| `voice.voice` | Supertonic `F1`–`F5`/`M1`–`M5`, or a `say` voice name. |
| `voice.lexicon` | Spoken respellings for TTS only, e.g. `{ "Prompt": "프롬프트" }`. See voices.md, "Mixed-language narration". |
| `voice.spellAcronyms` | Spell all-caps acronyms with the deck language's letter names (default true). |
| `voice.pace` | Even out speaking rate between sentences (Supertonic, Korean). Default `true`. See voices.md, "Even pacing". |
| `voice.splitLatinPhrases` | In non-Latin decks, voice English phrases of at least N words in English (default 4, 0 = off). |
| `images` | Image generation defaults: `{ "provider": "openai", "model": "gpt-image-2.5-flare", "quality": "medium", "style": "…" }`. See images.md. |
| `captions` | Burn narration subtitles into the video. **Omit for automatic**: on when the video has no voice audio, off when narrated. `true`/`false` force it. An SRT file is written with every video and script render either way. |
| `music` | Background audio file in `assets/`, looped under the narration. |

## Common slide fields

Every slide has a `layout` plus:

| Field | Notes |
|---|---|
| `id` | Stable, unique, kebab-case. Audio clips are keyed by it. Auto-assigned (`s01`…) if omitted, but set it. |
| `narration` | Spoken text: the script, speaker notes and TTS input. Full sentences. |
| `notes` | Presenter-only notes (not spoken). |
| `annotations` | Up to 4 sources or footnotes, shown small in the slide's bottom margin: strings, or `{ "text": "…", "url": "https://…" }` (linked in HTML and PPTX). Also listed in the script and the HTML notes panel. See "Annotations" below. |
| `durationSec` | Minimum on-screen time. Slides automatically extend to fit their narration audio (or its estimate). |
| `transition` | Override the transition **out of** this slide into the next. |
| `background` | Override the theme background for this slide. |

## Layouts

### `title`: opening slide
```json
{ "id": "intro", "layout": "title", "kicker": "Q3 Review", "title": "Growth, Explained", "subtitle": "What moved the numbers and what's next" }
```
Title ≤ ~30 chars for maximum impact (it auto-shrinks when longer). Gradient headline, word-by-word reveal.

### `section`: chapter divider
```json
{ "id": "part-2", "layout": "section", "number": "02", "title": "The Problem", "subtitle": "Why the old way breaks" }
```

### `bullets`: 1–7 points (3–5 is best)
```json
{ "id": "why", "layout": "bullets", "kicker": "Why now", "title": "Three forces converged",
  "bullets": ["Cheaper compute", { "text": "Open models", "sub": "Competitive with closed ones" }, "Real demand"] }
```
Bullets are short phrases; `sub` adds a muted second line. Numbered markers animate in sequence.

### `statement`: one big idea or quote
```json
{ "id": "thesis", "layout": "statement", "text": "Speed is a feature.", "attribution": "Our design principle" }
```
One sentence. Use for the key insight, a customer quote or the thesis.

### `stat`: 1–4 big numbers that count up
```json
{ "id": "impact", "layout": "stat", "title": "Impact in year one",
  "stats": [ { "value": 42, "suffix": "%", "label": "faster onboarding" }, { "value": 1.8, "prefix": "$", "suffix": "M", "decimals": 1, "label": "saved" } ] }
```
`value` must be a number; put units in `prefix`/`suffix`.

### `chart`: bar, line or donut, animated (native chart in PPTX)
```json
{ "id": "trend", "layout": "chart", "title": "Revenue by quarter",
  "chart": { "type": "bar", "labels": ["Q1","Q2","Q3","Q4"], "unit": "M",
             "series": [ { "name": "2025", "values": [12,19,27,34] }, { "name": "2026", "values": [18,26,38,52] } ] },
  "caption": "Source: internal finance data" }
```
- Every series needs exactly one value per label.
- `donut` uses the first series; its labels are the slices, and the center shows the first slice's share.
- `line` with one series gets an area fill and value labels.
- Keep to at most 8 labels and at most 3 series.

### `image`: full-bleed or framed picture
```json
{ "id": "product", "layout": "image", "src": "screenshot.png", "fit": "contain", "title": "The new dashboard", "caption": "Live since March" }
```
`src` is a file in `assets/` (or an https URL), or use `generate: { "prompt": "…" }` to have an image model create it (see images.md). `fit: "cover"` fills the frame with a Ken Burns zoom (default); `"contain"` shows the whole image framed. Set `kenBurns: false` to hold it still.

### `split`: two columns (comparison, before/after, pros/cons)
```json
{ "id": "compare", "layout": "split", "title": "Before and after",
  "left":  { "heading": "Before", "bullets": ["Manual", "Slow"] },
  "right": { "heading": "After",  "text": "One click, done in seconds.", "src": "after.png" } }
```
Each column takes an optional `heading`, `text`, `bullets`, and `src` (image) or `generate` (image model).

### `timeline`: 2–6 steps or milestones
```json
{ "id": "plan", "layout": "timeline", "title": "Roadmap",
  "items": [ { "label": "Q1", "title": "Pilot", "text": "3 teams" }, { "label": "Q2", "title": "Rollout" }, { "label": "Q3", "title": "Scale" } ] }
```
Items alternate above and below the line; keep `title` ≤ ~18 chars and `text` ≤ ~30.

### `code`: code with line-by-line reveal
```json
{ "id": "api", "layout": "code", "title": "One call", "language": "python", "code": "import x\nx.run()", "highlight": [2] }
```
Keep to at most 16 lines. `highlight` takes 1-based line numbers.

### `end`: closing slide
```json
{ "id": "outro", "layout": "end", "title": "Thank you", "subtitle": "questions@example.com", "cta": "Try it today" }
```

### `agenda`: roadmap of the talk (2–8 items)
```json
{ "id": "agenda", "layout": "agenda", "items": ["Why now", "How it works", "Results", "Next steps"] }
```
`title` defaults to "Agenda". Repeat the slide later with `"active": 3` to mark a chapter change: item 3 is highlighted and the others are dimmed.

### `cards`: 2–4 parallel ideas (features, principles, pillars)
```json
{ "id": "pillars", "layout": "cards", "kicker": "Principles", "title": "Three rules we design by",
  "cards": [ { "title": "One primary action", "text": "Every screen has one obvious next step.", "icon": "target.svg" },
             { "title": "Smart defaults", "text": "Defaults replace settings.", "label": "02" } ] }
```
`icon` is a small SVG (file in assets or inline markup, `viewBox="0 0 48 48"`, `stroke="currentColor"`); otherwise `label` shows a short tag. Card text ≤ ~12 words.

### `big-number`: one huge figure with context
```json
{ "id": "cost", "layout": "big-number", "kicker": "The problem", "value": 73, "suffix": "%",
  "label": "of trial users never finish setup", "context": "Source: 2025 onboarding study (n=1,200)." }
```
Counts up. Use for the single most important number; use `stat` for 2–4 numbers.

### `image-text`: half media, half text
```json
{ "id": "product", "layout": "image-text", "title": "Less on screen", "src": "ui.svg", "side": "left",
  "text": "Optional paragraph.", "bullets": ["Group by task", "Hide advanced options"] }
```
`src` is a photo/screenshot (fills its half with `fit: "cover"`; `"contain"` frames it) or a `.svg` illustration (animated). `svg` takes inline markup. `generate: { "prompt": "…" }` creates the image with an image model instead. `side` sets where the media goes.

### `quote`: attributed quote, optional portrait
```json
{ "id": "customer", "layout": "quote", "text": "We shipped in a week.", "author": "Dana Kim", "role": "CTO, Example Co", "src": "dana.jpg" }
```
Use `statement` for your own thesis and `quote` for other people's words.

### `comparison`: table of options × criteria
```json
{ "id": "vs", "layout": "comparison", "title": "How we compare", "columns": ["Them", "Us"], "highlight": 2,
  "rows": [ { "label": "Setup time", "values": ["2 weeks", "1 day"] }, { "label": "Offline mode", "values": [false, true] } ] }
```
`values` are strings/numbers, or booleans (rendered ✓ / —); there's one value per column. `highlight` (1-based) tints a column. Up to 4 columns and 8 rows.

### `visual`: an SVG diagram or illustration, animated
```json
{ "id": "pipeline", "layout": "visual", "title": "How it works", "src": "flow.svg", "caption": "Each stage has one job.", "stepSec": 0.8 }
{ "id": "system", "layout": "visual", "title": "One source of truth", "src": "hub.svg", "position": "left", "bullets": ["Edit once", "Render everything"] }
```
`src` is a `.svg` in assets (or `svg` inline markup). `position`: `center` (full width, wide viewBox) or `left`/`right` (the visual beside notes). `animate`: `draw` (default: strokes trace in, then fills/text fade), `fade`, or `none`. `stepSec` spaces the `data-step` groups. **Read `svg-visuals.md` before writing SVG.**

## Annotations (sources and footnotes)

```json
{ "id": "growth", "layout": "big-number", "value": 42, "suffix": "%", "label": "of teams ship weekly",
  "annotations": [
    { "text": "Source: DORA, State of DevOps Report (2024)", "url": "https://dora.dev/research/2024/" },
    "¹ Survey of 3,000 respondents; self-reported."
  ] }
```
- Use them for every sourced number, quote, chart, image credit or borrowed diagram, so the claims stay traceable. Format: "Source: author/publisher, title (year)". Keep each one under ~120 characters and 1–3 per slide; put longer citations in `notes`.
- If the slide text points to a footnote, mark it yourself (e.g. "42%¹" in the label and "¹ …" in the annotation); nothing is numbered automatically.
- Placement: bottom-left margin under the content (under the text column on `image-text`; white on a dark backing over full-bleed photos). In a video **with burned-in subtitles** they move to the top-right margin so the subtitles keep the bottom.
- PPTX: a small text box in the bottom margin with live hyperlinks. Script: an "Annotations" list per slide. HTML: on the slide (links clickable) and in the N notes panel.

## Decks without voice-over

Leave `voice.engine` at `"none"` (the default) and still write `narration` for every slide. You get:
- **Video**: no audio track; each slide stays up for its estimated narration time (~2.6 words/s, ~7 CJK chars/s), with the narration **burned in as subtitles** (automatic when `captions` is omitted) plus an `.srt` sidecar.
- **HTML**: slides play their motion immediately (nothing to unmute); press **N** for presenter notes (narration, `notes`, annotations).
- **PPTX**: narration and notes in the speaker notes. **Script**: the full narration with timings.

To make a silent version of a deck that does have a voice, run `motionstudio render <dir> --no-voice` (add `--out <dir>/out-silent` to keep both). It ignores the audio clips without touching them, so switching back needs no re-synthesis. Set `captions: false` for a silent video without subtitles (e.g. played behind a live speaker).

## Timing model

- A slide's length is the largest of: `durationSec` (or a layout default), its narration audio + 0.35s lead-in + 0.6s tail + the outgoing transition, and 1s.
- Without audio, narration length is estimated (~2.6 words/s; ~7 CJK chars/s), so silent videos are still paced to the script.
- Transitions overlap adjacent slides; the total runtime accounts for that.
- `motionstudio validate` prints the per-slide timing.
