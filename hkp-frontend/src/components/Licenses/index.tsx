import { useEffect, useMemo, useState } from "react";

import {
  componentsFor,
  groupByLicense,
  loadLicenseIndex,
  SURFACE_LABELS,
  type LicenseComponent,
  type LicenseIndex,
  type Surface,
} from "./data";

/**
 * The third-party licence notices for one or more distribution surfaces.
 *
 * The same component serves the website and the apps, which is why it takes the surfaces
 * to offer rather than deciding for itself: the website shows its browser bundle next to
 * the downloadable builds, while an app shows only what that app actually contains. Given
 * a single surface the switcher is omitted entirely.
 *
 * Styling stays deliberately host-neutral — inherited fonts, `currentColor`, and accent
 * tokens with literal fallbacks — because the two hosts have unrelated design systems and
 * the website sets none of the `--hkp-*` tokens.
 */
export default function Licenses({
  surfaces,
  className,
  style,
}: {
  /** Surfaces to offer, in display order. A switcher appears when there is more than one. */
  surfaces: Surface[];
  className?: string;
  style?: React.CSSProperties;
}) {
  const [index, setIndex] = useState<LicenseIndex | null>(null);
  const [failed, setFailed] = useState(false);
  const [surface, setSurface] = useState<Surface>(surfaces[0]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let live = true;
    loadLicenseIndex().then(
      (loaded) => {
        if (live) {
          setIndex(loaded);
        }
      },
      () => {
        if (live) {
          setFailed(true);
        }
      },
    );
    return () => {
      live = false;
    };
  }, []);

  // Keep the selection valid if the host changes which surfaces it offers.
  useEffect(() => {
    if (!surfaces.includes(surface)) {
      setSurface(surfaces[0]);
    }
  }, [surfaces, surface]);

  const groups = useMemo(() => {
    if (!index) {
      return [];
    }
    const needle = query.trim().toLowerCase();
    const shipped = componentsFor(index, surface).filter((component) => {
      if (!needle) {
        return true;
      }
      return (
        component.name.toLowerCase().includes(needle) ||
        component.spdx.toLowerCase().includes(needle)
      );
    });
    return groupByLicense(shipped);
  }, [index, surface, query]);

  const total = useMemo(
    () => groups.reduce((sum, group) => sum + group.components.length, 0),
    [groups],
  );

  if (failed) {
    return (
      <p className={className} style={style}>
        The licence index could not be loaded. The same information is in{" "}
        <code>THIRD-PARTY-NOTICES.md</code> and <code>licenses/</code> in the source
        repository.
      </p>
    );
  }

  if (!index) {
    return (
      <p className={className} style={{ opacity: 0.7, ...style }}>
        Loading licences…
      </p>
    );
  }

  return (
    <div className={className} style={style}>
      {surfaces.length > 1 ? (
        <div style={styles.switcher}>
          {surfaces.map((option) => {
            const active = option === surface;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setSurface(option)}
                style={active ? styles.tabActive : styles.tab}
              >
                {SURFACE_LABELS[option]}
              </button>
            );
          })}
        </div>
      ) : null}

      <p style={styles.summary}>
        {total} component{total === 1 ? "" : "s"} in{" "}
        {surface === "website"
          ? "the bundle this site serves to your browser"
          : `the ${SURFACE_LABELS[surface].replace(" app", "")} build`}
        {query.trim() ? " matching your search" : ""}. Index generated{" "}
        {index.generated}.
      </p>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Filter by package or licence…"
        aria-label="Filter licences"
        style={styles.search}
      />

      {groups.length === 0 ? (
        <p style={styles.summary}>Nothing matches that filter.</p>
      ) : (
        groups.map((group) => (
          <LicenseGroup
            key={group.spdx}
            spdx={group.spdx}
            components={group.components}
            texts={index.texts}
            // A filtered view is a search result: opening the groups shows the hits
            // without making the reader expand each one.
            initiallyOpen={Boolean(query.trim())}
          />
        ))
      )}

      <p style={styles.footnote}>
        {index.project.name} itself is licensed under {index.project.spdx}. The
        corresponding source for this release, including the exact versions of everything
        listed above, is at{" "}
        <a href={index.project.source} style={styles.link}>
          {index.project.source.replace(/^https:\/\//, "")}
        </a>
        .
      </p>
    </div>
  );
}

/** One licence, with the packages under it and their verbatim texts. */
function LicenseGroup({
  spdx,
  components,
  texts,
  initiallyOpen,
}: {
  spdx: string;
  components: LicenseComponent[];
  texts: Record<string, string>;
  initiallyOpen: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);

  useEffect(() => {
    setOpen(initiallyOpen);
  }, [initiallyOpen]);

  return (
    <section style={styles.group}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        style={styles.groupHeader}
      >
        <span style={styles.caret}>{open ? "▾" : "▸"}</span>
        <span style={styles.spdx}>{spdx}</span>
        <span style={styles.count}>
          {components.length} package{components.length === 1 ? "" : "s"}
        </span>
      </button>

      {open ? (
        <div style={styles.groupBody}>
          {components.map((component) => (
            <ComponentRow
              key={`${component.group}/${component.name}@${component.version}`}
              component={component}
              texts={texts}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

/** One package: identity, why it is here, and its licence text on demand. */
function ComponentRow({
  component,
  texts,
}: {
  component: LicenseComponent;
  texts: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const hasText = component.texts.length > 0;

  return (
    <div style={styles.row}>
      <div style={styles.rowHead}>
        <a href={component.url} style={styles.name}>
          {component.name}
        </a>
        {component.version ? (
          <span style={styles.version}>{component.version}</span>
        ) : null}
        {hasText ? (
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            style={styles.textToggle}
          >
            {open ? "hide licence" : "licence text"}
          </button>
        ) : (
          // No file upstream: the SPDX identifier its manifest declares is the
          // attribution, so say that rather than showing an empty control.
          <span style={styles.declared}>declared {component.spdx}, no file</span>
        )}
      </div>

      {component.notes ? <p style={styles.notes}>{component.notes}</p> : null}

      {open
        ? component.texts.map((text) => (
            <div key={text.hash}>
              {component.texts.length > 1 ? (
                <p style={styles.textFile}>{text.file}</p>
              ) : null}
              <pre style={styles.text}>{texts[text.hash]}</pre>
            </div>
          ))
        : null}
    </div>
  );
}

// The literal is hkp-frontend's own --hkp-accent, repeated so the view looks the same
// in hosts that define none of the tokens — the website is one.
const accent = "var(--hkp-accent, oklch(0.6 0.17 195))";
const hairline = "var(--hkp-border, rgba(100, 116, 139, 0.28))";

const styles: Record<string, React.CSSProperties> = {
  switcher: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.4rem",
    marginBottom: "1rem",
  },
  tab: {
    padding: "0.35rem 0.8rem",
    borderRadius: "999px",
    border: `1px solid ${hairline}`,
    background: "transparent",
    color: "inherit",
    font: "inherit",
    fontSize: "0.85rem",
    cursor: "pointer",
  },
  tabActive: {
    padding: "0.35rem 0.8rem",
    borderRadius: "999px",
    border: `1px solid ${accent}`,
    background: accent,
    color: "#fff",
    font: "inherit",
    fontSize: "0.85rem",
    cursor: "pointer",
  },
  summary: { fontSize: "0.9rem", opacity: 0.75, margin: "0 0 0.75rem" },
  search: {
    width: "100%",
    boxSizing: "border-box",
    padding: "0.5rem 0.7rem",
    borderRadius: "0.5rem",
    border: `1px solid ${hairline}`,
    background: "transparent",
    color: "inherit",
    font: "inherit",
    // 16px keeps iOS from zooming the viewport when the field takes focus.
    fontSize: "16px",
    marginBottom: "1rem",
  },
  group: { borderTop: `1px solid ${hairline}` },
  groupHeader: {
    display: "flex",
    alignItems: "baseline",
    gap: "0.6rem",
    width: "100%",
    padding: "0.6rem 0",
    border: "none",
    background: "transparent",
    color: "inherit",
    font: "inherit",
    textAlign: "left",
    cursor: "pointer",
  },
  caret: { opacity: 0.55, fontSize: "0.8rem" },
  spdx: { fontWeight: 700 },
  count: { marginLeft: "auto", fontSize: "0.8rem", opacity: 0.6 },
  groupBody: { paddingBottom: "0.5rem" },
  row: { padding: "0.35rem 0 0.35rem 1.4rem" },
  rowHead: {
    display: "flex",
    alignItems: "baseline",
    gap: "0.5rem",
    flexWrap: "wrap",
  },
  name: { color: accent, textDecoration: "none", fontWeight: 600 },
  version: { fontSize: "0.8rem", opacity: 0.6, fontVariantNumeric: "tabular-nums" },
  textToggle: {
    border: "none",
    background: "transparent",
    color: accent,
    font: "inherit",
    fontSize: "0.78rem",
    textDecoration: "underline",
    textUnderlineOffset: "3px",
    cursor: "pointer",
    padding: 0,
  },
  declared: { fontSize: "0.78rem", opacity: 0.55 },
  notes: { fontSize: "0.8rem", opacity: 0.75, margin: "0.3rem 0 0" },
  textFile: {
    fontSize: "0.72rem",
    opacity: 0.6,
    margin: "0.5rem 0 0.2rem",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  text: {
    margin: "0.4rem 0 0.6rem",
    padding: "0.7rem 0.8rem",
    borderRadius: "0.5rem",
    border: `1px solid ${hairline}`,
    background: "rgba(100, 116, 139, 0.06)",
    fontSize: "0.72rem",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
    overflowX: "auto",
    maxHeight: "22rem",
  },
  footnote: {
    borderTop: `1px solid ${hairline}`,
    marginTop: "1.5rem",
    paddingTop: "1rem",
    fontSize: "0.85rem",
    opacity: 0.75,
  },
  link: { color: accent, textUnderlineOffset: "3px" },
};
