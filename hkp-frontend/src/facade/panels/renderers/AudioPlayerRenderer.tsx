import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioPlayerWidget } from "../../types";
import { interpolateTemplate } from "../../itemTemplate";
import { WidgetRendererProps } from "../widgetRegistry";
import { usePressFeedback } from "../../pressFeedback";
import { useNotificationValue } from "./StatusIndicatorRenderer";

/**
 * A run of audio files played as one sitting.
 *
 * The widget holds a single audio element and decides what it points at. That
 * is the entire difference between a list of links and a programme: with links
 * a person chooses the next thing every few minutes, and choosing is the
 * opposite of listening.
 *
 * Scrubbing, volume and the play button are the browser's own controls. They
 * are better than a hand-drawn set at the things people expect of a player —
 * keyboard, screen readers, the lock screen on a phone — and none of that is
 * this widget's subject. What it adds around them is the part a browser has no
 * notion of: which track is current, what comes after it, and going there by
 * itself when one ends.
 */

/** One track, as the widget deals with it: an address and what to call it. */
type Track = {
  url: string;
  title: string;
  subtitle: string;
};

/** The last path segment without its extension — a track's name where the
 * board did not give one. An address is a poor title, but its tail is usually
 * close to a name, and nothing is worse. */
function nameFromUrl(url: string): string {
  const tail = url.split(/[?#]/)[0].split("/").filter(Boolean).pop() ?? url;
  return tail.replace(/\.[a-z0-9]{1,5}$/i, "");
}

function templated(template: string | undefined, item: unknown): string {
  if (!template) {
    return "";
  }
  const filled = interpolateTemplate(template, item);
  return filled == null ? "" : String(filled);
}

function SmallButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  const press = usePressFeedback("neutral", disabled);
  return (
    <button
      {...press.handlers}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "4px 10px",
        borderRadius: 6,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "hsl(var(--border))",
        backgroundColor: "hsl(var(--muted))",
        color: "hsl(var(--foreground))",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        fontSize: 11,
        fontWeight: 500,
        flexShrink: 0,
        ...press.style,
      }}
    >
      {label}
    </button>
  );
}

export function AudioPlayerRenderer({
  widget,
  boardContext,
}: WidgetRendererProps<AudioPlayerWidget>) {
  const value = useNotificationValue(boardContext, widget.source);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Whether the *next* src change should start playing. Set when a person
  // picks a track and when one ends, so advancing continues the sitting while
  // a list arriving in the background does not begin one.
  const playNext = useRef(false);
  // Whether anyone has played anything here yet. A browser refuses audio no
  // one asked for, so `autoplay` is honoured only once this is true.
  const everPlayed = useRef(false);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  // Consecutive tracks that would not load. A programme should survive one bad
  // file, and stop rather than spin when every file is bad.
  const failures = useRef(0);
  // `go` is defined below, and the autoplay effect above needs it.
  const goRef = useRef<(to: number) => void>(() => {});

  const tracks = useMemo<Track[]>(() => {
    const rows = Array.isArray(value) ? value : [];
    return rows
      .map((item) => ({
        url: templated(widget.url, item),
        title: templated(widget.title, item),
        subtitle: templated(widget.subtitle, item),
      }))
      .filter((track) => !!track.url)
      .map((track) => ({
        ...track,
        title: track.title || nameFromUrl(track.url),
      }));
  }, [value, widget.url, widget.title, widget.subtitle]);

  const index = tracks.findIndex((track) => track.url === currentUrl);
  const current = index >= 0 ? tracks[index] : undefined;

  // A list that arrives again is the normal case here — a refresh, a poll, one
  // new episode at the front — and it must not interrupt anything. The current
  // track is held by address, so it survives a list whose order or length has
  // changed; only its disappearance moves the player, and then to the start
  // rather than to whatever happens to sit at its old index.
  useEffect(() => {
    if (tracks.length === 0) {
      setCurrentUrl(null);
      return;
    }
    if (tracks.some((track) => track.url === currentUrl)) {
      return;
    }
    playNext.current = playNext.current && !!currentUrl;
    setCurrentUrl(tracks[0].url);
  }, [tracks, currentUrl]);

  // Autoplay is a board saying "this is a radio": episodes that turn up while
  // nobody is listening start themselves. It is deliberately narrow — only a
  // track the widget has *not* seen before starts one, so reaching the end of
  // the list is an end and not a loop, and only after a first manual play,
  // because a browser refuses audio no one asked for and a board restored in a
  // background tab should not start talking.
  const known = useRef<Set<string> | null>(null);
  useEffect(() => {
    const previous = known.current;
    known.current = new Set(tracks.map((track) => track.url));
    if (!widget.autoplay || !previous || !everPlayed.current) {
      return;
    }
    if (audioRef.current && !audioRef.current.paused) {
      return;
    }
    const fresh = tracks.findIndex((track) => !previous.has(track.url));
    if (fresh < 0) {
      return;
    }
    goRef.current(fresh);
  }, [tracks, widget.autoplay]);

  // The element's src follows `currentUrl`; playing has to be asked for again
  // after it changes, which is where an advance actually continues.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentUrl || !playNext.current) {
      return;
    }
    playNext.current = false;
    audio.play().catch(() => {});
  }, [currentUrl]);

  const go = useCallback(
    (to: number) => {
      if (tracks.length === 0) {
        return;
      }
      const wrapped = (to + tracks.length) % tracks.length;
      playNext.current = true;
      everPlayed.current = true;
      setCurrentUrl(tracks[wrapped].url);
      // Picking the track that is already loaded changes no src, so nothing
      // would restart it; play it here instead.
      if (tracks[wrapped].url === currentUrl) {
        playNext.current = false;
        audioRef.current?.play().catch(() => {});
      }
    },
    [tracks, currentUrl],
  );

  goRef.current = go;

  // A track that will not play is not the end of the programme. A volume holds
  // whatever it holds — something not audible, something half-written — and a
  // player that stops dead on the first of them is no use for listening
  // unattended. Skipping stops once everything has been tried, so a broken list
  // goes quiet instead of racing through itself.
  const onError = useCallback(() => {
    setPlaying(false);
    if (widget.continuous === false) {
      return;
    }
    failures.current += 1;
    if (failures.current >= tracks.length) {
      return;
    }
    const last = index >= tracks.length - 1;
    if (last && !widget.loop) {
      return;
    }
    go(index + 1);
  }, [widget.continuous, widget.loop, index, tracks.length, go]);

  const onEnded = useCallback(() => {
    setPlaying(false);
    failures.current = 0;
    if (widget.continuous === false) {
      return;
    }
    const last = index >= tracks.length - 1;
    if (last && !widget.loop) {
      return;
    }
    go(index + 1);
  }, [widget.continuous, widget.loop, index, tracks.length, go]);

  // What the operating system shows and what its buttons do: the lock screen,
  // the headphone remote, the media keys on a keyboard. A person listening to a
  // programme is rarely looking at the tab it is playing in, and skipping a
  // track from there is the one control they cannot reach any other way.
  //
  // It is a browser's only real notion of a queue — it has none for playback
  // itself — so the handlers point back at this widget's own idea of next.
  useEffect(() => {
    const session = (navigator as Navigator & { mediaSession?: any }).mediaSession;
    if (!session || !current) {
      return;
    }
    const Metadata = (window as Window & { MediaMetadata?: any }).MediaMetadata;
    if (Metadata) {
      session.metadata = new Metadata({
        title: current.title,
        artist: current.subtitle || undefined,
      });
    }
    const set = (action: string, handler: (() => void) | null) => {
      try {
        session.setActionHandler(action, handler);
      } catch {
        // An action this browser does not know is not an error worth having.
      }
    };
    set("previoustrack", tracks.length > 1 ? () => goRef.current(index - 1) : null);
    set("nexttrack", tracks.length > 1 ? () => goRef.current(index + 1) : null);
    return () => {
      set("previoustrack", null);
      set("nexttrack", null);
    };
  }, [current, index, tracks.length]);

  const muted = "hsl(var(--muted-foreground))";

  if (tracks.length === 0) {
    return (
      <div style={{ color: muted, fontSize: 12 }}>
        {widget.placeholder ?? "Nothing to play yet."}
      </div>
    );
  }

  const showList = widget.showList !== false;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minWidth: 0,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            color: "hsl(var(--foreground))",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {current?.title ?? ""}
        </div>
        {current?.subtitle ? (
          <div style={{ fontSize: 11, color: muted }}>{current.subtitle}</div>
        ) : null}
      </div>

      <audio
        ref={audioRef}
        src={current?.url}
        controls
        preload="none"
        onPlay={() => {
          everPlayed.current = true;
          failures.current = 0;
          setPlaying(true);
        }}
        onPause={() => setPlaying(false)}
        onEnded={onEnded}
        onError={onError}
        style={{ width: "100%", minWidth: 0 }}
      />

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <SmallButton
          label="Previous"
          onClick={() => go(index - 1)}
          disabled={tracks.length < 2}
        />
        <SmallButton
          label="Next"
          onClick={() => go(index + 1)}
          disabled={tracks.length < 2}
        />
        <span style={{ fontSize: 11, color: muted }}>
          {index >= 0 ? `${index + 1} of ${tracks.length}` : `${tracks.length}`}
        </span>
      </div>

      {showList ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            maxHeight: widget.listMaxHeight ?? 220,
            overflowY: "auto",
            minWidth: 0,
          }}
        >
          {tracks.map((track, i) => {
            const isCurrent = track.url === currentUrl;
            return (
              <button
                key={track.url}
                onClick={() => go(i)}
                style={{
                  textAlign: "left",
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: isCurrent
                    ? "hsl(var(--accent) / 0.14)"
                    : i % 2 === 0
                      ? "rgba(127,127,127,0.06)"
                      : "transparent",
                  color: isCurrent
                    ? "var(--hkp-accent)"
                    : "hsl(var(--foreground))",
                  fontSize: 12,
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    display: "block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {/* The playing track is marked in text as well as colour:
                      colour alone is not a mark everyone can read. */}
                  {isCurrent && playing ? "▶ " : ""}
                  {track.title}
                </span>
                {track.subtitle ? (
                  <span style={{ display: "block", fontSize: 11, color: muted }}>
                    {track.subtitle}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
