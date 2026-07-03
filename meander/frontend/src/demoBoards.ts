import { BoardDescriptor } from "hkp-frontend/src/types";
import {
  DEMO_CATALOG,
  DemoCatalogEntry,
  demoBoardFor,
} from "hkp-frontend/src/demoCatalog";

export type DemoEntry = {
  slug: string;
  label: string;
  description: string;
  icon: string;
  tags: string[];
  board: BoardDescriptor;
};

const isDesktopDemo = (entry: DemoCatalogEntry) =>
  !entry.tags.includes("iOS only");

export const DEMO_BOARDS: DemoEntry[] = DEMO_CATALOG.filter(isDesktopDemo)
  .map((entry) => {
    const board = demoBoardFor(entry);
    return board ? { ...entry, board } : null;
  })
  .filter((entry): entry is DemoEntry => entry !== null);
