---
name: create
description: Create a presentation, narration script, and motion-graphics video from a topic, brief, notes, or document. Produces animated MP4 (Remotion), self-contained HTML slides, editable PPTX, PDF, and a timed script/SRT from one deck.json, with optional local TTS narration (Supertonic).
when_to_use: The user wants slides, a deck, a talk, a pitch, an explainer video, a presentation video, a video script, or motion graphics made from a topic or source material.
argument-hint: "[topic, brief, or path to source material]"
allowed-tools: Bash(motionstudio *)
---

# Create a deck, script and video

You turn the user's request into a `deck.json` and render it with the `motionstudio` CLI (on PATH while this plugin is enabled). The deck is the single source of truth: slides, on-screen text, narration, timing hints, theme and voice all live there. Every output is rendered from it.

Request: $ARGUMENTS

Reference files (read them when you reach the step that needs them):
- `${CLAUDE_SKILL_DIR}/reference/deck-spec.md`: every field and layout, with JSON examples. **Read before writing deck.json.**
- `${CLAUDE_SKILL_DIR}/reference/storytelling.md`: story structure, slide/narration writing rules, pacing.
- `${CLAUDE_SKILL_DIR}/reference/svg-visuals.md`: how to draw SVG diagrams, illustrations and icons that animate. **Read before writing any SVG.**
- `${CLAUDE_SKILL_DIR}/reference/images.md`: generated images (gpt-image-2.5): when to use them, prompts, and the paid approval workflow.
- `${CLAUDE_SKILL_DIR}/reference/voices.md`: Supertonic voices, languages, and **mixed-language pronunciation** (voice.lexicon).

## Workflow

### 1. Check the engine (once per session)
Run `motionstudio doctor`. If it fails because the engine isn't installed, run `motionstudio setup` (first run installs npm deps and headless Chrome, ~1–2 min). Only install TTS when narration audio is wanted (step 7).

### 2. Pin down the brief
Extract from the request, and from any files the user pointed at (read them fully):
- **Topic and goal**: what the audience should know, feel or do afterwards.
- **Audience**: who they are and what they already know.
- **Length**: default 2–4 minutes of video (≈ 8–14 slides) if unspecified.
- **Language**: `lang`, e.g. `en`, `ko`. Write narration and slides in that language.
- **Look**: theme preset and style (`motionstudio themes`). **Default to the modern minimal look**: `minimal` (light) or `minimal-dark`. Use `swiss` for bold editorial, and the expressive presets (`midnight`, `aurora`, `noir`, `paper`) only when the user wants something flashier. Apply brand colors through `theme.colors`.
- **Voice**: narrated with TTS (Supertonic, pick a voice) or **no voice-over** (the default). Without a voice you still write full narration: it becomes burned-in subtitles plus an SRT for the video, presenter notes in the HTML deck (N) and PPTX, and the script, and slide timing follows its length. See "Decks without voice-over" in `deck-spec.md`.
- **Formats**: all by default (video, html, pptx, pdf, script).

Ask at most one round of short questions, and only for things you can't reasonably infer (usually audience/goal when the topic is bare). Otherwise state your assumptions in one or two lines and continue.

### 3. Research and outline
Gather the substance first: facts, numbers, examples, quotes. Use the provided material; use web search if available and the topic needs current facts. Never invent statistics. If a number isn't sourced, leave it out, or label it clearly as illustrative in `caption`/`notes`. Keep track of where each fact, quote, chart and image comes from: it goes into that slide's `annotations`.

Draft an outline following `storytelling.md` (hook → tension → insight → evidence → payoff → call to action), one line per slide with its layout. Show the user the outline compactly. Continue straight to the deck unless they asked to review stages or the brief was ambiguous.

### 4. Write the project
Pick a project folder: the user's choice, or `./<slug>/` in the current directory. Then:
```bash
motionstudio init <dir> --title "<Title>" --theme <preset>
```
This writes a starter `deck.json` that demonstrates all the layouts. **Replace its slides entirely** with yours, following `deck-spec.md`. Put any images the user supplies into `<dir>/assets/` and reference them by file name.

Rules that matter most:
- On-screen text is short (headline-style titles ≤ ~50 chars, bullets ≤ ~8 words). The **narration** carries the explanation in full, spoken sentences.
- Vary layouts, using the "Choosing layouts" table in `storytelling.md`. There are 18: title, section, agenda, bullets, cards, statement, quote, big-number, stat, chart, visual, image, image-text, split, comparison, timeline, code and end. Never run three text-list slides in a row.
- **Photos and scenes:** if the user wants photographic or illustrative imagery and has no files, add `generate: { "prompt": … }` to `image`, `image-text` or `split` slides (`images.md`). Use it sparingly, and never for diagrams.
- **Draw visuals as SVG.** When something is explained (a process, system, framework or relationship), draw it as an SVG diagram in `<dir>/assets/*.svg` and use a `visual` slide. Use `image-text` with an SVG illustration for concepts, and SVG icons on `cards`. Follow `svg-visuals.md`: theme tokens instead of hex, `data-step` groups in narration order, and a viewBox matched to the layout. Aim for 1–3 diagrams per 10 slides.
- **Cite on the slide.** Every sourced number, quote, chart, borrowed diagram or image credit gets an `annotations` entry ("Source: publisher, title (year)", with `url` when there is one). Keep 1–3 short lines per slide; longer citations go in `notes`. Never make up a source. When the user gives references, attach them to the slides that use them.
- Give every slide a stable, descriptive `id` (`hook`, `problem`, `q3-growth`…). Audio files are keyed by id.
- Write narration for the ear (see `storytelling.md`), because TTS reads it literally. In Korean/Japanese decks it's fine to keep English terms in the narration (they stay on screen and in captions), but give each one a spoken form in `voice.lexicon`.

### 5. Validate
```bash
motionstudio validate <dir>
```
Fix every error, and fix warnings unless you have a reason not to. Check the per-slide durations and the total runtime against the brief. Trim or expand the narration to hit the target length.

### 6. Look at the slides
```bash
motionstudio stills <dir>
```
This renders each slide's final frame to `<dir>/out/stills/NN-id.png`. **Read every PNG** and check for overflow, clipped or overlapping text, crowding, poor contrast, empty-looking slides and layout monotony. For SVG slides, also check labels against their boxes, line crossings and text size. Fix `deck.json`, then re-render only the changed slides with `--slides 3,7`. Repeat until they look professional. This review is where quality comes from, so don't skip it.

### 7. Generated images (only if the deck uses `generate`)
Follow `images.md`. Run `motionstudio images <dir>` to print the plan (nothing is billed), **show the user the plan and get explicit approval**, then run `motionstudio images <dir> --yes`. Without an API key the command explains how to set one, and slides keep placeholder images. Never ask for the key in chat. Re-check with `stills` afterwards.

### 8. Narration audio (only if voice was requested)
Set `voice.engine` in deck.json (see `voices.md`), install it if `doctor` shows it missing (`motionstudio setup --tts supertonic`). For non-English decks, first run `motionstudio tts <dir> --preview` and add every flagged English word to `voice.lexicon` (e.g. `"Prompt": "프롬프트"`). Then:
```bash
motionstudio tts <dir>
```
This regenerates only the slides whose narration changed. Run `validate` again: durations now come from the real audio.

### 9. Render
```bash
motionstudio render <dir>                      # all formats
motionstudio render <dir> --formats video --draft   # fast half-res preview
motionstudio render <dir> --formats pptx,html,script
```
For a deck without voice-over, the plain `render` already gives a silent video with burned-in subtitles and an `.srt`. To make a silent version of a narrated deck, add `--no-voice` (with `--out <dir>/out-silent` to keep both versions). Add `--html-audio` to embed the narration in the HTML deck. Such a deck opens **silent and paused** with a "Play with narration" button; nothing sounds until the viewer clicks it or presses Space (← → browse silently first, M mutes afterwards). A 1080p video renders at roughly real-time speed or better; run long renders in the background and tell the user.

### 10. Report
List the output files with paths (`<dir>/out/…`), the runtime and the slide count. Mention how to tweak: edit `deck.json` and re-run `motionstudio render`, or ask you for changes. Don't paste the whole script into chat. It's in `out/<slug>-script.md`.

## Changing the look by conversation
Map design requests to deck.json. Everything below is a deck edit followed by `stills` and a re-render, with no code changes:
| Request | Change |
|---|---|
| "More minimal / cleaner / modern" | `theme.preset: "minimal"` or `"minimal-dark"`, or `theme.style: "minimal"` on the current preset |
| "Flashier / more energetic" | `theme.style: "expressive"` or an expressive preset |
| "Use our brand colors" | `theme.colors.accent` (plus `text`/`bg` if given); keep a single accent in minimal style |
| "Different font" | `theme.fonts.heading` / `body` (see deck-spec.md for the list) |
| "Dark mode" | `minimal-dark` or `theme.colors.bg`/`bg2`/`surface`/`text` overrides |
| "Plainer background" | `theme.background: "solid"` (or per slide `background`) |
| "Different transitions" | `transition` (deck default) or per slide `transition` |
| "More visual / fewer bullets" | convert bullet slides to `cards`, `visual` (SVG), `comparison` or `big-number` |
Only when a request can't be expressed with these (e.g. "change how the chart axis looks") does it need an engine code change. Say so, and offer to make it.

## Editing an existing deck
When the user asks for changes ("make slide 4 punchier", "switch to the paper theme", "add a Korean voice-over", "cite the report on slide 6", "drop the voice, keep subtitles"), edit `deck.json`, then run `validate`, `stills --slides <changed>`, `tts` (if narration changed and voice is on), and `render` with only the needed formats.

## Troubleshooting
- `Invalid deck`: the message names the slide and field; compare against `deck-spec.md`.
- Missing images: files must be in `<dir>/assets/`; reference them as `"photo.jpg"`.
- TTS import errors: run `motionstudio setup --tts supertonic`.
- Stale audio warnings: narration changed since `tts` ran, so run `motionstudio tts <dir>` again.
- Rendering fonts: themes load Google Fonts at render time (network needed); CJK text falls back to system fonts (Apple SD Gothic Neo, Noto Sans CJK).
