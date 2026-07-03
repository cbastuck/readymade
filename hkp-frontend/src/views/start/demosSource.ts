import { DEMO_CATALOG, DemoCatalogEntry } from "../../demoCatalog";
import { gradient } from "./model";
import { BoardNode, FolderNode } from "./types";

const TAG_ART: Record<string, string> = {
  Audio: gradient("#e0355f", "#a01040"),
  Canvas: gradient("#3b5bff", "#1f34b0"),
  "Live data": gradient("#17b877", "#0a8a72"),
};

function demoNode(entry: DemoCatalogEntry): BoardNode {
  return {
    type: "board",
    name: entry.label,
    state: "demo",
    action: { kind: "demo", slug: entry.slug },
    sub: entry.description,
    description: entry.description,
    tags: entry.tags,
  };
}

/**
 * The Demos source: every demo appears under each of its HookHub tags — the
 * same board living in several folders, exactly the tagging model the user
 * tree follows.
 */
export function buildDemosFolder(options?: {
  excludeTags?: string[];
}): FolderNode {
  const excluded = new Set(options?.excludeTags ?? []);
  const demos = DEMO_CATALOG.filter(
    (entry) => !entry.tags.some((tag) => excluded.has(tag)),
  );

  const byTag = new Map<string, DemoCatalogEntry[]>();
  for (const entry of demos) {
    for (const tag of entry.tags) {
      if (excluded.has(tag)) {
        continue;
      }
      const list = byTag.get(tag) ?? [];
      list.push(entry);
      byTag.set(tag, list);
    }
  }

  const tagFolders: FolderNode[] = [...byTag.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([tag, entries]) => ({
      type: "folder",
      name: tag,
      children: entries.map(demoNode),
      ...(TAG_ART[tag] ? { art: TAG_ART[tag] } : {}),
    }));

  return {
    type: "folder",
    name: "Demos",
    children: [
      { type: "folder", name: "All demos", children: demos.map(demoNode) },
      ...tagFolders,
    ],
  };
}
