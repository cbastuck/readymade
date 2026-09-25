import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import NewsCarousel from "./NewsCarousel";
import type { NewsItem } from "./types";

const story: NewsItem = {
  tag: "Try it",
  title: "Build Hello World",
  body: "See a board come together.",
  bg: "#345",
};

beforeEach(() => sessionStorage.clear());

describe("NewsCarousel dismissal", () => {
  it("keeps the current feed hidden after it is dismissed", () => {
    const { rerender } = render(<NewsCarousel items={[story]} />);

    fireEvent.click(screen.getByRole("button", { name: "Dismiss news" }));
    expect(screen.queryByText(story.title)).toBeNull();

    rerender(<NewsCarousel items={[story]} />);
    expect(screen.queryByText(story.title)).toBeNull();
  });

  it("shows the feed again when its published content changes", () => {
    const { rerender } = render(<NewsCarousel items={[story]} />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss news" }));

    const newStory = { ...story, title: "A new Readymade demo" };
    rerender(<NewsCarousel items={[newStory]} />);

    expect(screen.getByText(newStory.title)).not.toBeNull();
  });
});
