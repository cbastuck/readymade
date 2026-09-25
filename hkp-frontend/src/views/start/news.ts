import { useEffect, useState } from "react";

import type { NewsItem } from "./types";

/**
 * Native hosts use the public website as their news source. Website hosts pass
 * `/news/start.json` explicitly so local development and preview builds read
 * their own public folder instead.
 */
export const DEFAULT_NEWS_FEED_URL =
  "https://readymadeit.com/news/start.json";

/**
 * Kept deliberately small and media-free: this is the only news content that
 * is compiled into an application. It appears immediately and remains visible
 * when the remote feed cannot be reached.
 */
export const DEFAULT_NEWS: NewsItem[] = [
  {
    tag: "Offline",
    title: "Your boards are still here",
    body: "Readymade works locally. Connect again to see the latest demos and project news.",
    bg: "var(--st-news-c)",
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function safeLink(value: unknown): string | undefined {
  const link = optionalString(value);
  if (!link) {
    return undefined;
  }
  if (link.startsWith("/") && !link.startsWith("//")) {
    return link;
  }
  try {
    const url = new URL(link);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

function remoteAsset(value: unknown, baseUrl: string): string | undefined {
  const source = optionalString(value);
  if (!source) {
    return undefined;
  }
  try {
    const url = new URL(source, baseUrl);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

/** Validate the editable public JSON before handing it to the UI. */
export function parseNewsFeed(value: unknown, baseUrl: string): NewsItem[] {
  const rawItems = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.items)
      ? value.items
      : [];

  return rawItems.flatMap((raw): NewsItem[] => {
    if (!isRecord(raw)) {
      return [];
    }
    const tag = optionalString(raw.tag);
    const title = optionalString(raw.title);
    const body = optionalString(raw.body);
    if (!tag || !title || !body) {
      return [];
    }

    let media: NewsItem["media"];
    if (isRecord(raw.media)) {
      const video = remoteAsset(raw.media.video, baseUrl);
      const label = optionalString(raw.media.label);
      if (video && label) {
        media = {
          video,
          poster: remoteAsset(raw.media.poster, baseUrl),
          label,
        };
      }
    }

    return [
      {
        tag,
        title,
        body,
        cta: optionalString(raw.cta),
        href: safeLink(raw.href),
        media,
        bg: optionalString(raw.bg) ?? "var(--st-news-c)",
      },
    ];
  });
}

/**
 * Resolve the host override first, otherwise refresh the public feed at
 * runtime. Failed and empty responses leave the compiled, text-only fallback
 * in place.
 */
export function useNewsFeed(
  suppliedNews?: NewsItem[],
  feedUrl = DEFAULT_NEWS_FEED_URL,
): NewsItem[] {
  const [remoteNews, setRemoteNews] = useState<NewsItem[] | null>(null);

  useEffect(() => {
    if (suppliedNews) {
      setRemoteNews(null);
      return;
    }

    const controller = new AbortController();
    setRemoteNews(null);
    void fetch(feedUrl, {
      signal: controller.signal,
      cache: "no-cache",
      headers: { Accept: "application/json" },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`News feed returned ${response.status}`);
        }
        return Promise.all([response.json(), Promise.resolve(response.url)]);
      })
      .then(([payload, responseUrl]) => {
        const items = parseNewsFeed(payload, responseUrl || feedUrl);
        if (items.length > 0) {
          setRemoteNews(items);
        }
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          // The offline fallback is already rendered; no error UI is needed.
        }
      });

    return () => controller.abort();
  }, [feedUrl, suppliedNews]);

  return suppliedNews ?? remoteNews ?? DEFAULT_NEWS;
}
