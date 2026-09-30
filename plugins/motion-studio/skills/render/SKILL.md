---
name: render
description: Re-render an existing motion-studio deck (deck.json) to video, HTML slides, PPTX, PDF and script, optionally refreshing TTS narration first.
when_to_use: The user edited a deck.json or asks to re-export/re-render a motion-studio project, or wants only specific formats (e.g. "just the pptx", "a quick draft video").
argument-hint: "[deck dir or deck.json] [formats: video,html,pptx,pdf,script] [--draft]"
allowed-tools: Bash(motionstudio *)
---

# Render a motion-studio deck

Arguments: $ARGUMENTS

1. Find the deck: the given path, else `./deck.json`, else the most recently modified `*/deck.json` under the current directory. If there are several candidates, ask which one.
2. `motionstudio validate <deck>`. Fix errors (see `${CLAUDE_PLUGIN_ROOT}/skills/create/reference/deck-spec.md`) and mention any warnings.
3. If `voice.engine` isn't `none` and validate or render warns that audio is stale or missing, run `motionstudio tts <deck>` first.
4. If slides changed since the last review, run `motionstudio stills <deck> --slides <changed>` and look at the PNGs before the full render.
5. Render only what was asked for:
   - everything: `motionstudio render <deck>`
   - a subset: `motionstudio render <deck> --formats pptx,html`
   - a quick video check: `motionstudio render <deck> --formats video --draft`
   - HTML with narration embedded: add `--html-audio` (the deck opens silent; the viewer presses Play to hear it, M to mute)
   Long video renders can run in the background.
6. Report the output paths and the runtime.
