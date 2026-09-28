// Browser entry for the standalone HTML deck: plays each slide's motion with @remotion/player.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Player, type PlayerRef } from "@remotion/player";
import { SingleSlideComposition, type DeckProps } from "../video/Deck";
import { computeTimeline } from "../timeline";
import { resolveTheme, fontStack, alpha } from "../themes";
import { slideHeadline } from "../export/script";

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
  const player = useRef<PlayerRef>(null);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) {
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
        player.current?.seekTo(0);
        player.current?.play();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  const t = timeline.slides[index];
  const s = deck.slides[index];
  const c = theme.colors;

  return (
    <div style={{ position: "fixed", inset: 0, background: c.bg, fontFamily: fontStack(theme.fonts.body), color: c.text }}>
      <div
        style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: fade, transition: "opacity 140ms ease" }}
        onClick={(e) => {
          const x = e.clientX / window.innerWidth;
          go(x < 0.3 ? index - 1 : index + 1);
        }}
      >
        <Player
          key={index}
          ref={player}
          component={SingleSlideComposition as unknown as React.FC<Record<string, unknown>>}
          inputProps={{ deck, audio, assets, index, withAudio } as unknown as Record<string, unknown>}
          durationInFrames={Math.max(1, t.durationInFrames - t.transitionOut)}
          fps={timeline.fps}
          compositionWidth={deck.format.width}
          compositionHeight={deck.format.height}
          autoPlay
          initiallyMuted={!withAudio}
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
        {index + 1} / {N} · <span style={{ opacity: 0.8 }}>N notes · O overview · F fullscreen · R replay</span>
      </div>

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
            Speaker notes — {index + 1}. {slideHeadline(s)}
          </div>
          {s.narration ?? <em style={{ opacity: 0.6 }}>No narration for this slide.</em>}
          {s.notes ? <div style={{ marginTop: 10, opacity: 0.75 }}>{s.notes}</div> : null}
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
