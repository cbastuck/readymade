/**
 * Access to the generated third-party licence index.
 *
 * `licenses/index.json` is produced by `scripts/collect-licenses.py` at the repo root and
 * is the single source of truth for every surface — this view, the notices markdown, and
 * the per-scope folders under `licenses/`. Nothing here is hand-maintained; regenerate the
 * index rather than editing what it says.
 *
 * The index carries the licence texts themselves rather than links to them, because
 * attribution means reproducing the licence wherever the code is distributed. That makes
 * it large (~110 KB gzipped), so it is loaded through a dynamic import: the bundler splits
 * it into its own chunk and nothing is fetched until someone opens the licence page.
 */

/** A place a build is distributed. `website` is the browser bundle; the rest are apps. */
export type Surface =
  | "website"
  | "macos"
  | "windows"
  | "linux"
  | "ios"
  | "android";

export type LicenseText = {
  /** The file name as it appears upstream, e.g. `LICENSE`, `COPYING.BSD2`. */
  file: string;
  /** Key into `LicenseIndex.texts`. Shared by every component with identical text. */
  hash: string;
};

export type LicenseComponent = {
  name: string;
  version: string;
  /** SPDX identifier, or `UNKNOWN` when the package declares none. */
  spdx: string;
  /** Where it entered the build: `vcpkg`, `cmake`, `vendored` or `npm`. */
  group: string;
  /** Every surface whose shipped artifact contains this component. */
  surfaces: Surface[];
  /** Scope buckets or hkp-rt service ids — what needs the component. */
  scopes: string[];
  url: string;
  via?: string;
  notes?: string;
  texts: LicenseText[];
};

export type LicenseIndex = {
  generated: string;
  project: { name: string; spdx: string; source: string };
  surfaces: Surface[];
  /** Deduplicated licence bodies, keyed by the hash in `LicenseText`. */
  texts: Record<string, string>;
  components: LicenseComponent[];
};

/** Human-readable names for the surfaces, for the switcher and headings. */
export const SURFACE_LABELS: Record<Surface, string> = {
  website: "This website",
  macos: "macOS app",
  windows: "Windows app",
  linux: "Linux app",
  ios: "iOS app",
  android: "Android app",
};

let pending: Promise<LicenseIndex> | null = null;

/**
 * Load the index, fetching it at most once per session.
 *
 * The promise is cached rather than the resolved value so that concurrent callers — a
 * surface switcher and a deep link opening at the same time — share one request.
 */
export function loadLicenseIndex(): Promise<LicenseIndex> {
  if (!pending) {
    pending = import("../../../../licenses/index.json").then(
      (module) => (module.default ?? module) as unknown as LicenseIndex,
    );
  }
  return pending;
}

/** The components shipped on one surface, ordered for display. */
export function componentsFor(
  index: LicenseIndex,
  surface: Surface,
): LicenseComponent[] {
  return index.components
    .filter((component) => component.surfaces.includes(surface))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

/**
 * Group components by licence, most common first.
 *
 * Grouping by SPDX is what makes several hundred entries legible: a reader checking
 * compliance cares which licences are present far more than which package is which, and
 * the long tail of single-package licences is where anything unusual shows up.
 */
export function groupByLicense(
  components: LicenseComponent[],
): { spdx: string; components: LicenseComponent[] }[] {
  const groups = new Map<string, LicenseComponent[]>();
  for (const component of components) {
    const existing = groups.get(component.spdx);
    if (existing) {
      existing.push(component);
    } else {
      groups.set(component.spdx, [component]);
    }
  }
  return [...groups.entries()]
    .map(([spdx, list]) => ({ spdx, components: list }))
    .sort((a, b) => {
      if (b.components.length !== a.components.length) {
        return b.components.length - a.components.length;
      }
      return a.spdx.localeCompare(b.spdx);
    });
}
