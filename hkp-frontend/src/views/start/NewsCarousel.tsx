import { useState } from "react";

import { NewsItem } from "./types";
import NewsTeaserMedia from "./NewsTeaserMedia";
import { useNewsDismissal } from "./news";

export default function NewsCarousel({ items }: { items: NewsItem[] }) {
  const [index, setIndex] = useState(0);
  const [videoExpanded, setVideoExpanded] = useState(false);
  const { dismissed, dismiss } = useNewsDismissal(items);

  if (items.length === 0 || dismissed) {
    return null;
  }
  const i = ((index % items.length) + items.length) % items.length;
  const news = items[i];
  const cardClass = news.media
    ? `st-news-card st-news-card-media ${videoExpanded ? "st-news-video-wide" : "st-news-text-wide"}`
    : "st-news-card";

  const move = (by: number) => {
    setIndex((n) => n + by);
    setVideoExpanded(false);
  };

  const toggleMediaWidth = (target: EventTarget) => {
    const element = target instanceof Element ? target : null;
    if (!news.media || element?.closest("a, button")) {
      return;
    }
    setVideoExpanded((expanded) => !expanded);
  };

  return (
    <div style={{ flex: "0 0 auto", padding: "14px 26px 0" }}>
      <div
        className={cardClass}
        onClick={(event) => toggleMediaWidth(event.target)}
        title={
          news.media
            ? videoExpanded
              ? "Click to give the story more space"
              : "Click to enlarge the video"
            : undefined
        }
        style={{
          position: "relative",
          borderRadius: 16,
          overflow: "hidden",
          background: news.bg,
          color: "#fff",
          minHeight: 96,
          display: "flex",
          alignItems: "center",
        }}
      >
        <div
          className="st-news-content"
          style={{
            padding: news.media ? "20px 24px 25px" : "18px 70px 18px 26px",
            display: "flex",
            alignItems: "center",
            gap: 22,
            width: "100%",
          }}
        >
          <div
            style={{
              flex: "0 0 auto",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              background: "rgba(255,255,255,0.18)",
              padding: "6px 12px",
              borderRadius: 999,
            }}
          >
            {news.tag}
          </div>
          <div style={{ flex: "1 1 auto", minWidth: 0 }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: 18,
                letterSpacing: "-0.01em",
                marginBottom: 3,
              }}
            >
              {news.title}
            </div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>{news.body}</div>
          </div>
          {news.cta && news.href && (
            <a className="st-news-cta" href={news.href}>{news.cta}</a>
          )}
          {news.cta && !news.href && news.onAction && (
            <button className="st-news-cta" onClick={news.onAction}>{news.cta}</button>
          )}
        </div>
        {news.media && (
          <NewsTeaserMedia
            key={news.media.video}
            media={news.media}
            className="st-news-media-desktop"
          />
        )}
        {items.length > 1 && (
          <div className="st-news-controls">
            <button
              className="st-news-btn"
              aria-label="Previous"
              onClick={() => move(-1)}
            >
              &#8249;
            </button>
            <button
              className="st-news-btn"
              aria-label="Next"
              onClick={() => move(1)}
            >
              &#8250;
            </button>
          </div>
        )}
        <button
          className="st-news-dismiss"
          aria-label="Dismiss news"
          title="Hide news"
          onClick={dismiss}
        >
          &times;
        </button>
        {items.length > 1 && (
          <div style={{ position: "absolute", left: 26, bottom: 8, display: "flex", gap: 5 }}>
            {items.map((_, di) => (
              <span
                key={di}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: di === i ? "#fff" : "rgba(255,255,255,0.4)",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
