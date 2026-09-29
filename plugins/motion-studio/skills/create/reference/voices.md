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

**Drop English inflections in Korean respellings.** Korean speakers say English terms in their base form, so lexicon entries leave out the plural `-s`/`-es` and past-tense `-ed`: "Skills Map" is 스킬 맵 (not 스킬스 맵), Agents → 에이전트, Applications → 애플리케이션, Prompts → 프롬프트, Tools → 툴, Deployed → 디플로이. `validate` suggests these for flagged inflected words in Korean decks, reusing the base word's respelling when it's already in the lexicon.

**When writing Korean (or other non-Latin) narration, always:**
- run `motionstudio tts <deck> --preview` to see exactly what will be spoken (English segments show as ⟦en: …⟧),
- add every flagged word to `voice.lexicon` using its common Korean spelling (프롬프트, 워크플로우, 클로드, 노션, 깃허브),
- keep single English terms in the lexicon and use English segments only for whole phrases or quotes.

A lexicon change only re-voices the slides it affects.

## Even pacing (Korean)
Supertonic picks a tempo per call, so in Korean short sentences come out fast and long, comma-heavy ones slow (about a 25–35% spread within a slide). With `voice.pace` (default `true`), Korean segments are voiced **sentence by sentence**:
- each sentence's rate (syllables per second, comma pauses excluded) is measured against a **target calibrated once per voice/speed** on neutral paragraphs, and cached in `assets/audio/pace-calibration.json` so later runs that re-voice only changed slides keep the same tempo;
- sentences off target by more than 3% are re-voiced with an adjusted speed (bounded to 0.78–1.18× per sentence, up to 3 passes);
- sentences are joined with a 0.40 s pause and short fades (no clicks). English segments inside Korean narration are voiced as before.

Measured on a four-slide Korean deck, the deck-wide sentence-rate spread was 4–9% for F1–F5 (from 22–28%), and total narration length stayed within ±3% of unpaced. Set `"pace": false` in `voice`, or the env var `MOTION_STUDIO_TTS_PACE=0`, to turn it off; either change re-voices affected clips. `MOTION_STUDIO_TTS_DEBUG=1` logs each sentence's rate. Pacing makes Korean synthesis about 2–3× slower, plus a one-time calibration of a few seconds per voice/speed; it is still much faster than real time.

## macOS `say`
- `voice.voice`: a system voice (`say -v '?'` lists them; e.g. `Samantha`, or `Yuna` for Korean).

## Workflow notes
- `motionstudio tts <dir>` only synthesizes slides whose narration or voice settings changed (it hashes them). Use `--force` to redo all, or `--only id1,id2` to target slides.
- Changing `voice.*` or `lang` invalidates all clips.
- Audio lives in `<dir>/assets/audio/<id>.wav`, with `manifest.json` recording durations.
- After `tts`, run `validate`: slide durations now reflect the real audio.

Check the Supertonic model license on its Hugging Face page before commercial use.
