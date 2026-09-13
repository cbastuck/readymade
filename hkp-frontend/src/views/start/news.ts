import { NewsItem } from "./types";

/** Default announcements shown until a real news feed exists. */
export const DEFAULT_NEWS: NewsItem[] = [
  {
    tag: "New",
    title: "Folders work like tags",
    body: "Navigate folders column by column and search everything by name or tag.",
    bg: "var(--st-news-a)",
  },
  {
    tag: "Tip",
    title: "Explore the demo boards",
    body: "Every demo is filed under its tags — open one and make it yours.",
    bg: "var(--st-news-b)",
  },
  {
    tag: "Next",
    title: "Adding more sources",
    body: "Upcoming releases will add more sources and allow you to create custom ones.",
    bg: "var(--st-news-c)",
  },
];
