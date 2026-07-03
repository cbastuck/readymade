import { gradient } from "./model";
import { NewsItem } from "./types";

/** Default announcements shown until a real news feed exists. */
export const DEFAULT_NEWS: NewsItem[] = [
  {
    tag: "New",
    title: "Folders work like tags",
    body: "Navigate folders column by column and search everything by name or tag.",
    bg: gradient("#0f766e", "#17b877", 120),
  },
  {
    tag: "Tip",
    title: "Explore the demo boards",
    body: "Every demo is filed under its tags — open one and make it yours.",
    bg: gradient("#8a5a00", "#f2a417", 120),
  },
  {
    tag: "Next",
    title: "Adding more sources",
    body: "Upcoming releases will add more sources and allow you to create custom ones.",
    bg: gradient("#3b5bff", "#6a3bff", 120),
  },
];
