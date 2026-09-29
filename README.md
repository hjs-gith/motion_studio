# motion-studio

A Claude Code plugin that turns a topic, brief or document into:

- **Motion-graphics video** (MP4, 1080p, rendered with [Remotion](https://remotion.dev))
- **HTML slides**: a single self-contained file that plays each slide's animation live
- **Editable PowerPoint** (.pptx) with native text, charts and speaker notes
- **PDF** handout
- **Script** (Markdown with timestamps) and **subtitles** (SRT)
- Optional **narration** via local open-source TTS: [Supertonic](https://github.com/supertone-inc/supertonic) (or macOS `say` for quick drafts), with mixed-language pronunciation handling (e.g. Korean narration with English terms)
- Optional **generated images** through a pluggable image-provider interface, starting with OpenAI `gpt-image-2.5` (flare/sunburst)

All of it comes from a single `deck.json`, so slides, script and video never drift apart.

## Install

```bash
claude plugin marketplace add /Volumes/crucial_500gb/Claude_projects/motion-studio
claude plugin install motion-studio@motion-studio-marketplace
```

Then, in any Claude Code session:

```
/motion-studio:setup                  # installs the render engine (first time, ~1–2 min)
/motion-studio:setup supertonic       # optional: narration
/motion-studio:create a 3-minute explainer on how vaccines train the immune system, with narration
```

Or just ask: *"make a pitch deck and video for my app from ./notes.md"*. The `create` skill triggers on its own.

## Skills

| Skill | What it does |
|---|---|
| `/motion-studio:create` | Brief → research → outline → deck.json → validate → visual review of stills → TTS → render |
| `/motion-studio:render` | Re-render an existing deck (all formats or a subset, draft or final) |
| `/motion-studio:setup` | Install/check the engine and Supertonic TTS |

## CLI

The plugin puts `motionstudio` on Claude's PATH (`plugins/motion-studio/bin/`). You can run it yourself too:

```bash
motionstudio init my-talk --title "My Talk" --theme minimal
motionstudio validate my-talk          # schema check, lint, per-slide timing
motionstudio stills my-talk            # PNG of every slide → my-talk/out/stills/
motionstudio tts my-talk --preview     # show exactly what will be spoken (lexicon, acronyms, ⟦en: …⟧ segments)
motionstudio tts my-talk               # narration → my-talk/assets/audio/
motionstudio images my-talk            # plan generated images (nothing billed)
motionstudio images my-talk --yes      # generate them (paid; needs OPENAI_API_KEY)
motionstudio render my-talk            # video, html, pptx, pdf, script
motionstudio render my-talk --formats video --draft
motionstudio themes | schema | doctor
```

## Deck project layout

```
my-talk/
  deck.json          # the source of truth
  assets/            # images, music; audio/ holds generated narration
  out/               # my-talk.mp4 .html .pptx .pdf -script.md .srt, stills/
```

**18 layouts:** `title`, `section`, `agenda`, `bullets`, `cards`, `statement`, `quote`, `big-number`, `stat`, `chart` (bar/line/donut), `visual` (animated SVG), `image`, `image-text`, `split`, `comparison`, `timeline`, `code`, `end`.

**Two styles, eight themes.** `minimal` style (flat accents, hairlines, editorial alignment, calm motion) is used by `minimal`, `minimal-dark`, `swiss` and `corporate`. `expressive` style (gradients, glow, springy motion) is used by `midnight`, `aurora`, `noir` and `paper`. Any preset can switch style with `theme.style`, and colors and fonts can be overridden, so you can restyle a deck just by asking Claude.

**SVG visuals.** Claude draws diagrams, illustrations and icons as SVG using theme color tokens. They trace themselves on in the video and HTML deck (ordered with `data-step`), recolor with the theme, and are rasterized to crisp PNGs for PPTX/PDF.

Transitions: `fade`, `slide`, `wipe`, `flip`, `clock-wipe`, `iris`.

See [`skills/create/reference/deck-spec.md`](plugins/motion-studio/skills/create/reference/deck-spec.md) for the full format and [`svg-visuals.md`](plugins/motion-studio/skills/create/reference/svg-visuals.md) for SVG authoring. [`examples/`](examples/) has sample decks: `minimal` (all new layouts and SVG diagrams), `showcase` (expressive, narrated), `korean` (mixed-language narration) and `generated-images` (image generation; placeholders until a key is set).

## Generated images

Add `"generate": { "prompt": "…" }` to an `image`, `image-text` or `split`-column slide. Until the image exists the slide shows a theme-colored placeholder, so layouts can be reviewed for free. `motionstudio images` prints a plan, and `--yes` generates. Results are cached by prompt, style, model, quality and size, so nothing is billed twice. To enable OpenAI, set your key yourself:

```bash
echo 'export OPENAI_API_KEY=sk-...' >> ~/.zshrc
```

(or add `"env": { "OPENAI_API_KEY": "…" }` to `~/.claude/settings.json`). Providers live in `engine/src/images/`; adding Gemini, Recraft or FLUX means implementing one `ImageProvider`. See [`images.md`](plugins/motion-studio/skills/create/reference/images.md).

## Mixed-language narration

Korean narration is also **evenly paced**: sentences are voiced one by one and re-voiced toward a calibrated rate, so short sentences no longer rush and long ones no longer drag (`voice.pace`, on by default).

Supertonic voices one language per call. Before synthesis, `voice.lexicon` respellings (`"Prompt": "프롬프트"`), acronym spelling (AI → 에이아이) and English-phrase segmentation are applied to the **audio only**; slides and captions keep the original text. See [`voices.md`](plugins/motion-studio/skills/create/reference/voices.md).

## How it works

```
plugins/motion-studio/
  .claude-plugin/plugin.json
  bin/motionstudio            # launcher: installs engine to ~/.cache/motion-studio, forwards commands
  skills/                     # create / render / setup (+ reference docs)
  engine/
    src/spec.ts               # zod schema for deck.json
    src/timeline.ts           # timing: narration-driven slide durations, transitions, captions
    src/video/                # Remotion compositions, layouts, motion primitives, backgrounds
    src/video/look.ts         # style tokens (minimal vs expressive) used by every layout
    src/video/SvgVisual.tsx   # frame-driven SVG draw-on animation
    src/svg-utils.ts          # SVG sanitizing, theme-token substitution, aspect/keys
    src/images/               # image-provider interface, OpenAI provider, placeholders, job planning/cache
    src/pronounce.ts          # TTS pronunciation: lexicon, acronyms, language segments
    src/export/               # pptx (pptxgenjs), pdf (pdf-lib), html (esbuild + @remotion/player), script/srt
    src/cli/                  # CLI, Remotion bundling/rendering, TTS orchestration
    tts/synth.py              # Supertonic batch worker
```

- Slide duration = the longer of the layout minimum and (narration audio + lead-in + tail + transition). Without audio it uses estimated speaking time, so silent videos are still paced to the script.
- TTS output is cached per slide by a hash of text and voice settings; only changed slides are re-synthesized.
- The engine runs from its own directory, so Remotion's headless Chrome is cached there and never inside your project.

## Development

When the plugin is installed from this local marketplace, Claude Code reads it in place. If `plugins/motion-studio/engine/node_modules` exists, the launcher uses the engine in place too (dev mode); otherwise it copies it to `~/.cache/motion-studio/engine`.

```bash
cd plugins/motion-studio/engine && npm install && npx tsc --noEmit
claude plugin validate .
```

Run `/reload-plugins` in a session after editing skills.

## Licensing notes

Remotion is free for individuals and companies with up to 3 employees; larger companies need a [company license](https://remotion.dev/license). Check the Supertonic model license on Hugging Face before commercial use.
