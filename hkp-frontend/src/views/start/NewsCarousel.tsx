import { useState } from "react";

import { NewsItem } from "./types";

export default function NewsCarousel({ items }: { items: NewsItem[] }) {
  const [index, setIndex] = useState(0);

  if (items.length === 0) {
    return null;
  }
  const i = ((index % items.length) + items.length) % items.length;
  const news = items[i];

  return (
    <div style={{ flex: "0 0 auto", padding: "14px 26px 0" }}>
      <div
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
          style={{
            padding: "18px 26px",
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
          {news.cta && news.onAction && (
            <button
              onClick={news.onAction}
              style={{
                flex: "0 0 auto",
                font: "inherit",
                fontWeight: 700,
                fontSize: 13,
                color: "#14161c",
                background: "#fff",
                border: "none",
                padding: "9px 16px",
                borderRadius: 9,
                cursor: "pointer",
              }}
            >
              {news.cta}
            </button>
          )}
          {items.length > 1 && (
            <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6 }}>
              <button
                className="st-news-btn"
                aria-label="Previous"
                onClick={() => setIndex((n) => n - 1)}
              >
                &#8249;
              </button>
              <button
                className="st-news-btn"
                aria-label="Next"
                onClick={() => setIndex((n) => n + 1)}
              >
                &#8250;
              </button>
            </div>
          )}
        </div>
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
