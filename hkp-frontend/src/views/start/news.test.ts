import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_NEWS, parseNewsFeed, useNewsFeed } from "./news";

afterEach(() => vi.unstubAllGlobals());

describe("start-page news feed", () => {
  it("resolves remote media beside the feed while keeping app routes local", () => {
    const items = parseNewsFeed(
      {
        items: [
          {
            tag: "Try it",
            title: "Hello World",
            body: "Build the board.",
            cta: "Open demo",
            href: "/playground?demo=hello-world",
            media: {
              video: "media/hello-world.mp4",
              poster: "media/hello-world.png",
              label: "Hello World board",
            },
          },
        ],
      },
      "https://readymadeit.com/news/start.json",
    );

    expect(items).toHaveLength(1);
    expect(items[0].href).toBe("/playground?demo=hello-world");
    expect(items[0].media).toEqual({
      video: "https://readymadeit.com/news/media/hello-world.mp4",
      poster: "https://readymadeit.com/news/media/hello-world.png",
      label: "Hello World board",
    });
  });

  it("drops malformed stories and unsafe links", () => {
    const items = parseNewsFeed(
      {
        items: [
          { tag: "Missing fields" },
          {
            tag: "News",
            title: "Safe story",
            body: "No executable link is retained.",
            href: "javascript:alert(1)",
          },
        ],
      },
      "https://readymadeit.com/news/start.json",
    );

    expect(items).toHaveLength(1);
    expect(items[0].href).toBeUndefined();
  });

  it("keeps the text-only fallback when the network is unavailable", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("offline");
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useNewsFeed(undefined, "https://readymadeit.com/news/start.json"),
    );

    expect(result.current).toEqual(DEFAULT_NEWS);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(result.current).toEqual(DEFAULT_NEWS);
  });
});
