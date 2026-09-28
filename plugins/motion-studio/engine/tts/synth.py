#!/usr/bin/env python3
"""Batch Supertonic TTS worker for motion-studio.

Reads a job file (JSON) and writes one WAV per job, loading the model once.

    python synth.py jobs.json

jobs.json:
    {"engine": "supertonic", "voice": "F1", "lang": "ko", "speed": 1.0,
     "jobs": [{"id": "s01", "out": "/abs/s01.wav",
               "segments": [{"text": "...", "lang": "ko"}, {"text": "...", "lang": "en"}]}]}

Mixed-language narration arrives as language segments (see src/pronounce.ts). Each segment is voiced
in its own language, edge silence is trimmed, and segments are joined with a short natural pause.

Prints one JSON line per finished job: {"id": ..., "out": ..., "ok": true}
"""
import json
import os
import sys
import time

import numpy as np

SEGMENT_GAP_SEC = 0.12

SUPERTONIC_LANGS = {
    "ar", "bg", "hr", "cs", "da", "nl", "en", "et", "fi", "fr", "de", "el", "hi", "hu", "id", "it", "ja",
    "ko", "lv", "lt", "pl", "pt", "ro", "ru", "sk", "sl", "es", "sv", "tr", "uk", "vi",
}


def log(msg):
    print(msg, file=sys.stderr, flush=True)


def supertonic_lang(code):
    lang = (code or "en").split("-")[0].lower()
    if lang not in SUPERTONIC_LANGS:
        log(f"supertonic: language '{lang}' not in supported list, using language-agnostic mode")
        return "na"
    return lang


def trim_silence(wav, sr, threshold=0.01, pad_sec=0.03):
    """Trims leading/trailing near-silence, keeping a small pad so consonants aren't clipped."""
    idx = np.flatnonzero(np.abs(wav) > threshold)
    if idx.size == 0:
        return wav
    pad = int(pad_sec * sr)
    return wav[max(0, idx[0] - pad) : min(wav.size, idx[-1] + pad)]


def run_supertonic(cfg):
    from supertonic import TTS

    tts = TTS(auto_download=True)
    sr = int(getattr(tts, "sample_rate", 44100))
    voice = cfg.get("voice") or "F1"
    if voice.endswith(".json") and os.path.exists(voice):
        style = tts.get_voice_style_from_path(voice)
    else:
        style = tts.get_voice_style(voice_name=voice)
    steps = int(os.environ.get("MOTION_STUDIO_SUPERTONIC_STEPS", "8"))
    speed = float(cfg.get("speed") or 1.0)

    def voice(text, lang):
        wav, _ = tts.synthesize(
            text=text,
            voice_style=style,
            total_steps=steps,
            speed=speed,
            max_chunk_length=300,
            silence_duration=0.3,
            lang=supertonic_lang(lang),
            verbose=False,
        )
        return np.asarray(wav, dtype=np.float32).reshape(-1)

    for job in cfg["jobs"]:
        t0 = time.time()
        segments = job.get("segments") or [{"text": job["text"], "lang": cfg.get("lang", "en")}]
        if len(segments) == 1:
            audio = voice(segments[0]["text"], segments[0]["lang"])
        else:
            gap = np.zeros(int(SEGMENT_GAP_SEC * sr), dtype=np.float32)
            parts = []
            for i, seg in enumerate(segments):
                parts.append(trim_silence(voice(seg["text"], seg["lang"]), sr))
                if i < len(segments) - 1:
                    parts.append(gap)
            # Keep a short lead/tail like single-call output.
            edge = np.zeros(int(0.1 * sr), dtype=np.float32)
            audio = np.concatenate([edge, *parts, edge])
        tts.save_audio(audio.reshape(1, -1), job["out"])
        langs = "+".join(s["lang"] for s in segments)
        log(f"supertonic: {job['id']} ({langs}) in {time.time() - t0:.1f}s")
        print(json.dumps({"id": job["id"], "out": job["out"], "ok": True}), flush=True)


def main():
    if len(sys.argv) != 2:
        log(__doc__)
        sys.exit(2)
    with open(sys.argv[1], encoding="utf-8") as f:
        cfg = json.load(f)
    engine = cfg.get("engine")
    try:
        if engine == "supertonic":
            run_supertonic(cfg)
        else:
            log(f"Unknown engine: {engine}")
            sys.exit(2)
    except ImportError as e:
        log(f"Missing Python package for '{engine}': {e}. Run: motionstudio setup --tts {engine}")
        sys.exit(3)


if __name__ == "__main__":
    main()
