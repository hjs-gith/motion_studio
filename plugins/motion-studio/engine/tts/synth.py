#!/usr/bin/env python3
"""Batch Supertonic TTS worker for motion-studio.

Reads a job file (JSON) and writes one WAV per job, loading the model once.

    python synth.py jobs.json

jobs.json:
    {"engine": "supertonic", "voice": "F1", "lang": "ko", "speed": 1.0,
     "pace": {"version": 1, "langs": ["ko"], "cache": "/abs/pace-calibration.json"} | null,
     "jobs": [{"id": "s01", "out": "/abs/s01.wav",
               "segments": [{"text": "...", "lang": "ko"}, {"text": "...", "lang": "en"}]}]}

Mixed-language narration arrives as language segments (see src/pronounce.ts). Each segment is voiced
in its own language, edge silence is trimmed, and segments are joined with a short natural pause.

Pacing (languages in pace.langs, e.g. Korean): Supertonic predicts a tempo per call, so short sentences
come out fast and long comma-heavy ones slow. Paced segments are voiced sentence by sentence; each
sentence's rate (syllables per second, comma pauses excluded) is measured against a target calibrated
once per voice/speed/steps on neutral sentences, and outliers are re-voiced with an adjusted speed.
Sentences are joined with a fixed pause. MOTION_STUDIO_TTS_PACE=0 (or pace: null) disables it.
MOTION_STUDIO_TTS_DEBUG=1 logs per-sentence rates.
Prints one JSON line per finished job: {"id": ..., "out": ..., "ok": true}
"""
import json
import os
import re
import sys
import time

import numpy as np

SEGMENT_GAP_SEC = 0.12
SENTENCE_GAP_SEC = 0.40  # matches the sentence breaks Supertonic makes inside one call
EDGE_SEC = 0.1
FADE_SEC = 0.008

# Pacing parameters.
COMMA_PAUSE_SEC = 0.22  # typical pause Supertonic inserts at a comma; excluded from the rate
PACE_TOLERANCE = 0.03  # re-voice when the rate is off target by more than 3%
PACE_MIN_SYLLABLES = 4  # very short sentences are left alone
# Total speed adjustment allowed per sentence, relative to the start speed. Short sentences start up
# to ~25% faster than the paragraph tempo, so the range reaches a little further down than up.
PACE_FACTOR_RANGE = (0.78, 1.18)
PACE_PASSES = 3  # measure-and-correct iterations (speed isn't perfectly linear, output varies run to run)
SPEED_RANGE = (0.7, 2.0)  # Supertonic's accepted speed range
SENTENCE_SPLIT = re.compile(r"(?<=[.?!])\s+")
SYLLABLE = {"ko": re.compile(r"[가-힣]")}
COMMAS = re.compile(r"[,，]")
# Neutral calibration paragraphs: medium-length sentences, no commas. Two paragraphs average out
# Supertonic's run-to-run variation.
CALIBRATION = {
    "ko": [
        [
            "오늘은 새로운 기능을 차례대로 살펴보겠습니다.",
            "이 방법은 작은 팀에서도 쉽게 적용할 수 있습니다.",
            "다음 장에서는 실제 사례를 함께 확인해 보겠습니다.",
        ],
        [
            "처음에는 전체 구조를 간단히 설명하겠습니다.",
            "그다음 중요한 단계를 하나씩 보여 드리겠습니다.",
            "마지막으로 자주 묻는 질문을 정리해 보겠습니다.",
        ],
    ],
}
DEBUG = os.environ.get("MOTION_STUDIO_TTS_DEBUG") == "1"

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


def fade(wav, sr, sec=FADE_SEC):
    """Short raised-cosine fade in/out so trimmed pieces start and end at zero (no clicks at joins)."""
    n = min(int(sec * sr), wav.size // 2)
    if n <= 1:
        return wav
    ramp = (0.5 - 0.5 * np.cos(np.linspace(0, np.pi, n))).astype(np.float32)
    out = wav.copy()
    out[:n] *= ramp
    out[-n:] *= ramp[::-1]
    return out


def quiet_runs(wav, sr, threshold=0.01, win=0.01, min_sec=0.12):
    """Lengths (s) of pauses inside a clip: runs of 10 ms windows below the RMS threshold."""
    n = int(win * sr)
    frames = wav[: wav.size // n * n].reshape(-1, n)
    quiet = np.sqrt((frames ** 2).mean(axis=1)) < threshold
    runs, count = [], 0
    for q in quiet:
        if q:
            count += 1
        else:
            if count * win >= min_sec:
                runs.append(count * win)
            count = 0
    return runs


def speech_rate(wav, sr, text, lang):
    """Syllables per second of a trimmed clip, excluding comma pauses. None if not measurable."""
    pattern = SYLLABLE.get(lang)
    if pattern is None:
        return None
    syllables = len(pattern.findall(text))
    if syllables < PACE_MIN_SYLLABLES:
        return None
    speaking = max(0.5, wav.size / sr - COMMA_PAUSE_SEC * len(COMMAS.findall(text)))
    return syllables / speaking


class Pacer:
    """Voices paced-language text sentence by sentence at a consistent, calibrated rate."""

    def __init__(self, voice_fn, sr, speed, pace_cfg, cache_key):
        self.voice_fn = voice_fn
        self.sr = sr
        self.speed = speed
        self.langs = set(pace_cfg.get("langs") or [])
        self.cache_path = pace_cfg.get("cache")
        self.cache_key = cache_key
        self.targets = {}  # lang -> (target rate, starting speed)
        self.stats = []

    def applies(self, lang):
        return lang in self.langs and lang in SYLLABLE

    def _clip(self, text, lang, speed):
        return trim_silence(self.voice_fn(text, lang, speed), self.sr)

    def target(self, lang):
        """(target rate, starting speed) for a language, calibrated once and cached on disk."""
        if lang in self.targets:
            return self.targets[lang]
        key = f"{self.cache_key}|{lang}"
        cache = {}
        if self.cache_path and os.path.exists(self.cache_path):
            try:
                with open(self.cache_path, encoding="utf-8") as f:
                    cache = json.load(f)
            except (OSError, ValueError):
                cache = {}
        if key in cache:
            rate, isolated = float(cache[key]["rate"]), float(cache[key]["isolated"])
        else:
            rate, isolated = self._calibrate(lang)
            cache[key] = {"rate": round(rate, 4), "isolated": round(isolated, 4), "createdAt": time.strftime("%Y-%m-%dT%H:%M:%S")}
            if self.cache_path:
                tmp = self.cache_path + ".tmp"
                with open(tmp, "w", encoding="utf-8") as f:
                    json.dump(cache, f, indent=2)
                os.replace(tmp, self.cache_path)
            log(f"supertonic: calibrated {lang} pace {rate:.2f} syllables/s (isolated sentences {isolated:.2f}) ({key})")
        # Isolated sentences come out faster than the same sentences in a paragraph, so start each
        # sentence at a speed pre-scaled to the paragraph tempo; per-sentence corrections then stay
        # centered on 1 and within PACE_FACTOR_RANGE.
        start = float(np.clip(self.speed * rate / isolated, *SPEED_RANGE))
        self.targets[lang] = (rate, start)
        return self.targets[lang]

    def _calibrate(self, lang):
        """Returns (paragraph rate, isolated-sentence rate) for the neutral calibration paragraphs.

        Target = paragraph context: each paragraph voiced in one call (as unpaced narration would be),
        with its sentence-break pauses removed so the figure is comparable to a single trimmed
        sentence's rate. Keeps paced narration close to the unpaced tempo. The isolated rate (median of
        the sentences voiced one by one) gives the offset between the two contexts."""
        pad = 0.06  # a trimmed sentence keeps ~30 ms of padding on each side
        paragraph_rates, isolated_rates = [], []
        for sentences in CALIBRATION[lang]:
            isolated_rates += [speech_rate(self._clip(t, lang, self.speed), self.sr, t, lang) for t in sentences]
            text = " ".join(sentences)
            wav = self._clip(text, lang, self.speed)
            breaks = sorted(quiet_runs(wav, self.sr), reverse=True)[: len(sentences) - 1]
            speaking = wav.size / self.sr - sum(max(0.0, b - pad) for b in breaks)
            paragraph_rates.append(len(SYLLABLE[lang].findall(text)) / max(0.5, speaking))
        return float(np.mean(paragraph_rates)), float(np.median(isolated_rates))

    def sentence(self, text, lang):
        """Returns a trimmed clip whose rate is as close to the target as the bounds allow."""
        target, start = self.target(lang)
        speed = start
        wav = self._clip(text, lang, speed)
        rate = speech_rate(wav, self.sr, text, lang)
        if rate is None:
            return wav
        best = (abs(np.log(rate / target)), wav, rate, speed)
        first = rate
        lo, hi = PACE_FACTOR_RANGE
        for _ in range(PACE_PASSES):
            factor = target / rate
            if abs(factor - 1) <= PACE_TOLERANCE:
                break
            # Adjust relative to the current attempt, but bound the total change against the start speed.
            new_speed = float(np.clip(speed * factor, start * lo, start * hi))
            new_speed = float(np.clip(new_speed, *SPEED_RANGE))
            if abs(new_speed - speed) < 1e-3:
                break
            speed = new_speed
            wav = self._clip(text, lang, speed)
            rate = speech_rate(wav, self.sr, text, lang)
            err = abs(np.log(rate / target))
            if err < best[0]:
                best = (err, wav, rate, speed)
        _, wav, rate, speed = best
        self.stats.append({"text": text, "before": first, "after": rate, "speed": speed, "target": target})
        if DEBUG:
            log(f"  pace {first:5.2f} → {rate:5.2f} syl/s (target {target:.2f}, speed {speed:.3f}) {text[:40]}")
        return wav


def run_supertonic(cfg):
    from supertonic import TTS

    tts = TTS(auto_download=True)
    sr = int(getattr(tts, "sample_rate", 44100))
    voice_name = cfg.get("voice") or "F1"
    if voice_name.endswith(".json") and os.path.exists(voice_name):
        style = tts.get_voice_style_from_path(voice_name)
    else:
        style = tts.get_voice_style(voice_name=voice_name)
    steps = int(os.environ.get("MOTION_STUDIO_SUPERTONIC_STEPS", "8"))
    speed = float(cfg.get("speed") or 1.0)

    def voice(text, lang, speed=speed):
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

    pace_cfg = cfg.get("pace") if os.environ.get("MOTION_STUDIO_TTS_PACE", "1") != "0" else None
    pacer = None
    if pace_cfg:
        cache_key = f"{voice_name}|speed={speed:.3f}|steps={steps}|v{pace_cfg.get('version', 1)}"
        pacer = Pacer(voice, sr, speed, pace_cfg, cache_key)

    for job in cfg["jobs"]:
        t0 = time.time()
        segments = job.get("segments") or [{"text": job["text"], "lang": cfg.get("lang", "en")}]
        paced = pacer is not None and any(pacer.applies(supertonic_lang(s["lang"])) for s in segments)
        if paced:
            audio = voice_paced(segments, voice, pacer, sr)
        elif len(segments) == 1:
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
        log(f"supertonic: {job['id']} ({langs}{', paced' if paced else ''}) in {time.time() - t0:.1f}s")
        result = {"id": job["id"], "out": job["out"], "ok": True}
        if paced:
            result["pace"] = pacer.stats
            pacer.stats = []
        print(json.dumps(result, ensure_ascii=False), flush=True)


def voice_paced(segments, voice, pacer, sr):
    """Voices segments with pacing: paced languages sentence by sentence, others in one call.

    Pieces are trimmed, faded and joined with a sentence pause after sentence-final punctuation
    and a short pause otherwise (e.g. before an English phrase inside a Korean sentence).
    """
    pieces = []  # (audio, text)
    for seg in segments:
        lang = supertonic_lang(seg["lang"])
        if pacer.applies(lang):
            for sentence in (s for s in SENTENCE_SPLIT.split(seg["text"].strip()) if s):
                pieces.append((fade(pacer.sentence(sentence, lang), sr), sentence))
        else:
            pieces.append((fade(trim_silence(voice(seg["text"], seg["lang"]), sr), sr), seg["text"]))
    edge = np.zeros(int(EDGE_SEC * sr), dtype=np.float32)
    parts = [edge]
    for i, (wav, text) in enumerate(pieces):
        if i:
            gap = SENTENCE_GAP_SEC if re.search(r"[.?!][\"')\]]*$", pieces[i - 1][1].strip()) else SEGMENT_GAP_SEC
            parts.append(np.zeros(int(gap * sr), dtype=np.float32))
        parts.append(wav)
    parts.append(edge)
    return np.concatenate(parts)


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
