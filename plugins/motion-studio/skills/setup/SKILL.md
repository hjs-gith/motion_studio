---
name: setup
description: Install or check the motion-studio rendering engine (Remotion, headless Chrome) and the optional local Supertonic TTS for narration.
when_to_use: First use of motion-studio, a doctor/setup failure, or the user wants to enable voice-over narration.
argument-hint: "[supertonic]"
allowed-tools: Bash(motionstudio *)
---

# Set up motion-studio

Arguments: $ARGUMENTS

1. Run `motionstudio setup`. The first run installs the engine's npm dependencies into `~/.cache/motion-studio/engine` and downloads headless Chrome (~100 MB), which takes 1–2 minutes. Later runs are quick checks.
2. If narration is wanted, run `motionstudio setup --tts supertonic`. It creates a small Python venv (~175 MB, needs Python 3.10+) and installs Supertonic, which runs on CPU in 31 languages. Model weights download on the first `motionstudio tts` run.
3. Show the `doctor` summary that setup prints, and explain what's available, including which image providers are configured.
4. Image generation (optional, paid) needs an OpenAI API key that **the user sets themselves**: `export OPENAI_API_KEY=…` in `~/.zshrc`, or `"env": { "OPENAI_API_KEY": "…" }` in `~/.claude/settings.json`, then restart Claude Code. Never ask them to paste the key into chat.

Set `MOTION_STUDIO_HOME` to relocate the engine, venv and caches.
