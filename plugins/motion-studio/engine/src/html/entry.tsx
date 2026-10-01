// Browser entry for the standalone HTML deck: plays each slide's motion with @remotion/player.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Player, type PlayerRef } from "@remotion/player";
import { SingleSlideComposition, type DeckProps } from "../video/Deck";
import { computeTimeline } from "../timeline";
import { resolveTheme, fontStack, alpha } from "../themes";
import { slideHeadline } from "../export/script";
import { annotationParts } from "../spec";

type Payload = DeckProps & { withAudio: boolean };
declare global {
  interface Window {
    __MOTION_STUDIO__: Payload;
  }
}

const data = window.__MOTION_STUDIO__;
const { deck, audio, assets, withAudio } = data;
const timeline = computeTimeline(deck, audio);
const theme = resolveTheme(deck);
const N = deck.slides.length;

function initialIndex() {
  const n = parseInt(location.hash.replace("#", ""), 10);
  return Number.isFinite(n) && n >= 1 && n <= N ? n - 1 : 0;
}

const App: React.FC = () => {
  const [index, setIndex] = useState(initialIndex);
  const [notes, setNotes] = useState(false);
  const [overview, setOverview] = useState(false);
  const [fade, setFade] = useState(1);
  // Decks with narration open silent and paused: nothing plays until the viewer presses Play.
  // Decks without audio have nothing to gate, so their slide motion starts right away.
  const [started, setStarted] = useState(!withAudio);
  const [muted, setMuted] = useState(false);
  const player = useRef<PlayerRef>(null);

  const start = useCallback(() => setStarted(true), []);
  const toggleMute = useCallback(() => {
    if (muted) player.current?.unmute();
    else player.current?.mute();
    setMuted(!muted);
  }, [muted]);

  const go = useCallback(
    (to: number) => {
      const next = Math.max(0, Math.min(N - 1, to));
      if (next === index) return;
      setFade(0);
      setTimeout(() => {
        setIndex(next);
        setFade(1);
      }, 140);
    },
    [index],
  );

  useEffect(() => {
    history.replaceState(null, "", `#${index + 1}`);
  }, [index]);

  // Carry the viewer's mute choice onto each newly mounted slide (narration starts ~0.35 s in, so
  // nothing is heard before this runs).
  useEffect(() => {
    if (started && muted) player.current?.mute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, started]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!started && [" ", "Enter"].includes(e.key)) {
        e.preventDefault();
        start();
      } else if (withAudio && e.key.toLowerCase() === "m") toggleMute();
      else if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) {
        e.preventDefault();
        go(index + 1);
      } else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) {
        e.preventDefault();
        go(index - 1);
      } else if (e.key === "Home") go(0);
      else if (e.key === "End") go(N - 1);
      else if (e.key.toLowerCase() === "n") setNotes((v) => !v);
      else if (e.key.toLowerCase() === "o" || e.key === "Escape") setOverview((v) => (e.key === "Escape" ? false : !v));
      else if (e.key.toLowerCase() === "f") {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen();
      } else if (e.key.toLowerCase() === "r") {
        if (!started) return start();
        player.current?.seekTo(0);
        player.current?.play();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index, started, start, toggleMute]);

  const t = timeline.slides[index];
  const s = deck.slides[index];
  const c = theme.colors;
  const frames = Math.max(1, t.durationInFrames - t.transitionOut);

  return (
    <div style={{ position: "fixed", inset: 0, background: c.bg, fontFamily: fontStack(theme.fonts.body), color: c.text }}>
      <div
        style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: fade, transition: "opacity 140ms ease" }}
        onClick={(e) => {
          if (!started) return start();
          const x = e.clientX / window.innerWidth;
          go(x < 0.3 ? index - 1 : index + 1);
        }}
      >
        {/* Before Play: a paused, muted still of the slide's settled last frame. After: plays from frame 0. */}
        <Player
          key={`${index}-${started}`}
          ref={player}
          component={SingleSlideComposition as unknown as React.FC<Record<string, unknown>>}
          inputProps={{ deck, audio, assets, index, withAudio } as unknown as Record<string, unknown>}
          durationInFrames={frames}
          fps={timeline.fps}
          compositionWidth={deck.format.width}
          compositionHeight={deck.format.height}
          autoPlay={started}
          initialFrame={started ? 0 : frames - 1}
          // Fixed per mount (the key covers `started`): changing it mid-slide makes the player drop its
          // audio. The viewer's mute choice is applied with mute()/unmute() instead (see the effect above).
          initiallyMuted={!withAudio || !started}
          loop={false}
          clickToPlay={false}
          controls={false}
          acknowledgeRemotionLicense
          style={{ width: "100%", height: "100%", maxWidth: `calc(100vh * ${deck.format.width / deck.format.height})`, maxHeight: `calc(100vw * ${deck.format.height / deck.format.width})` }}
        />
      </div>

      {/* progress */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, background: alpha(c.text, 0.08) }}>
        <div style={{ height: "100%", width: `${((index + 1) / N) * 100}%`, background: `linear-gradient(90deg, ${c.accent}, ${c.accent2})`, transition: "width 300ms ease" }} />
      </div>
      <div style={{ position: "absolute", right: 16, bottom: 12, fontSize: 13, color: alpha(c.text, 0.55), fontVariantNumeric: "tabular-nums", pointerEvents: "none" }}>
        {index + 1} / {N} · <span style={{ opacity: 0.8 }}>N notes · O overview · F fullscreen · R replay{withAudio ? " · M mute" : ""}</span>
      </div>

      {withAudio && started ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleMute();
          }}
          aria-label={muted ? "Unmute narration" : "Mute narration"}
          title={muted ? "Unmute (M)" : "Mute (M)"}
          data-role="mute"
          style={{
            position: "absolute",
            left: 14,
            bottom: 14,
            width: 38,
            height: 38,
            borderRadius: 19,
            border: `1px solid ${alpha(c.text, 0.18)}`,
            background: alpha(c.bg, 0.7),
            color: muted ? c.accent : alpha(c.text, 0.75),
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none" />
            {muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M16.5 8.5a5 5 0 0 1 0 7M19.5 5.5a9 9 0 0 1 0 13" />}
          </svg>
        </button>
      ) : null}

      {!started ? (
        // The slide stays fully visible (so it can be browsed silently); Play sits at the bottom center.
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 44, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, pointerEvents: "none" }}>
          <button
            data-role="start"
            onClick={(e) => {
              e.stopPropagation();
              start();
            }}
            aria-label="Play with narration"
            style={{
              pointerEvents: "auto",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 26px 14px 22px",
              borderRadius: 999,
              border: "none",
              background: c.accent,
              color: theme.dark && theme.style !== "minimal" ? c.bg : "#fff",
              font: "inherit",
              fontSize: 17,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: `0 8px 30px ${alpha("#000", 0.22)}`,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4l14 8-14 8z" />
            </svg>
            Play with narration
          </button>
          <div style={{ fontSize: 13, padding: "4px 12px", borderRadius: 999, background: alpha(c.bg, 0.75), color: alpha(c.text, 0.75) }}>
            Sound is off until you press Play (click or Space) · ← → browse silently
          </div>
        </div>
      ) : null}

      {notes ? (
        <div
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 36,
            maxHeight: "38vh",
            overflow: "auto",
            padding: "16px 20px",
            borderRadius: 12,
            background: alpha("#000", 0.8),
            color: "#fff",
            fontSize: 17,
            lineHeight: 1.5,
            backdropFilter: "blur(8px)",
          }}
        >
          <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.6, marginBottom: 6 }}>
            Presenter notes — {index + 1}. {slideHeadline(s)}
          </div>
          {s.narration ?? <em style={{ opacity: 0.6 }}>No narration for this slide.</em>}
          {s.notes ? <div style={{ marginTop: 10, opacity: 0.75 }}>{s.notes}</div> : null}
          {s.annotations?.length ? (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.15)", fontSize: 14, opacity: 0.8 }} data-role="annotations">
              {s.annotations.map((a, i) => {
                const { text, url } = annotationParts(a);
                return (
                  <div key={i}>
                    {text}
                    {url && !text.includes(url) ? (
                      <>
                        {" "}
                        <a href={url} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
                          {url}
                        </a>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {overview ? (
        <div style={{ position: "absolute", inset: 0, background: alpha(c.bg, 0.96), overflow: "auto", padding: 32 }} onClick={() => setOverview(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {deck.slides.map((sl, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setOverview(false);
                  go(i);
                }}
                style={{
                  textAlign: "left",
                  padding: 16,
                  borderRadius: 12,
                  border: `2px solid ${i === index ? c.accent : alpha(c.text, 0.12)}`,
                  background: alpha(c.surface, 0.8),
                  color: c.text,
                  cursor: "pointer",
                  font: "inherit",
                }}
              >
                <div style={{ fontSize: 12, color: c.accent, fontWeight: 700 }}>
                  {String(i + 1).padStart(2, "0")} · {sl.layout}
                </div>
                <div style={{ marginTop: 6, fontSize: 15, fontWeight: 600 }}>{slideHeadline(sl)}</div>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

createRoot(document.getElementById("root")!).render(<App />);
