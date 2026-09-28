# Narration voice (Supertonic)

Narration is optional. With `voice.engine: "none"` the video is silent but still paced to the estimated narration, and the script, speaker notes and SRT are still produced.

| Engine | Install | Notes |
|---|---|---|
| `supertonic` | `motionstudio setup --tts supertonic` (ONNX, ~99M params, CPU, ~175 MB venv) | **The narration engine.** Runs ~4–5× faster than real time on an Apple-silicon CPU. 31 languages including en, ko, ja, es, fr, de, pt, it, ru, vi, hi and ar. |
| `say` | Built into macOS, no install | Robotic; only for quick timing drafts before final narration. |

## Supertonic settings
- `voice.voice`: `F1`–`F5` (female), `M1`–`M5` (male), or a path to a Voice Builder `.json` style. Default `F1`. Try 2–3 voices on one slide (`motionstudio tts <dir> --only intro --force`) when the user cares about the voice.
- `voice.speed`: 0.9–1.15 sounds natural; 1.05 suits explainers.
- `lang` comes from the deck (`ko`, `en`, …). Unsupported codes fall back to language-agnostic mode.
- Model weights download from Hugging Face on the first `tts` run.
- Env: `MOTION_STUDIO_SUPERTONIC_STEPS` (default 8; higher is slightly better and slower).

## Mixed-language narration (e.g. Korean with English terms)
Supertonic voices one language per call, so English inside Korean text would be read with Korean rules. Before synthesis, narration goes through a pronunciation step. **Only the audio changes**: slides, script, speaker notes and captions keep the original text.

1. **`voice.lexicon`**: spoken respellings, whole-word and case-insensitive:
   ```json
   "voice": { "engine": "supertonic", "voice": "F2", "lexicon": { "Prompt": "프롬프트", "Claude": "클로드", "PPTX": "파워포인트" } }
   ```
2. **Acronyms** (all caps, e.g. AI, GPU, GPT-4) are spelled with the deck language's letter names (에이아이, 지피유, 지피티 4) when `voice.spellAcronyms` is true (the default). Korean and Japanese letter names are built in. Put acronyms that are said as words in the lexicon (NASA → 나사; a few common ones are built in).
3. **English phrases** of at least `voice.splitLatinPhrases` words (default 4; 0 disables), such as a quoted English sentence, are voiced **in English** as their own segment and joined with a short pause.
4. Remaining English words are flagged by `validate` ("will be read with ko rules").

**When writing Korean (or other non-Latin) narration, always:**
- run `motionstudio tts <deck> --preview` to see exactly what will be spoken (English segments show as ⟦en: …⟧),
- add every flagged word to `voice.lexicon` using its common Korean spelling (프롬프트, 워크플로우, 클로드, 노션, 깃허브),
- keep single English terms in the lexicon and use English segments only for whole phrases or quotes.

A lexicon change only re-voices the slides it affects.

## macOS `say`
- `voice.voice`: a system voice (`say -v '?'` lists them; e.g. `Samantha`, or `Yuna` for Korean).

## Workflow notes
- `motionstudio tts <dir>` only synthesizes slides whose narration or voice settings changed (it hashes them). Use `--force` to redo all, or `--only id1,id2` to target slides.
- Changing `voice.*` or `lang` invalidates all clips.
- Audio lives in `<dir>/assets/audio/<id>.wav`, with `manifest.json` recording durations.
- After `tts`, run `validate`: slide durations now reflect the real audio.

Check the Supertonic model license on its Hugging Face page before commercial use.
