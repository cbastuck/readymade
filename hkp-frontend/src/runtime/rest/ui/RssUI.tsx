import { useCallback, useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import InputField from "hkp-frontend/src/components/shared/InputField";
import Button from "hkp-frontend/src/ui-components/Button";
import RuntimeRestServiceUI from "../RuntimeRestServiceUI";

type Feed = { url: string; name?: string };

type FeedError = { url: string; error: string };

/**
 * The subscription list, and what the last round of fetches produced.
 *
 * The list is the panel's subject: a reader is configured by the feeds it
 * reads, and everything else here — how many articles came back, which feed
 * did not answer — is the feedback that tells a person whether the list they
 * just changed does what they wanted. The articles themselves are not shown;
 * they are for the pipeline, and a board that wants to read them puts a facade
 * or a Monitor after this service.
 */
export default function RssUI(props: ServiceUIProps) {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [draft, setDraft] = useState("");
  const [limit, setLimit] = useState("");
  const [fetching, setFetching] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [fetchedAt, setFetchedAt] = useState("");
  const [errors, setErrors] = useState<FeedError[]>([]);

  const onUpdate = useCallback((state: any) => {
    if (Array.isArray(state.feeds)) {
      setFeeds(state.feeds);
    }
    if (state.limit !== undefined) {
      setLimit(String(state.limit));
    }
    if (state.fetching !== undefined) {
      setFetching(!!state.fetching);
    }
    if (state.count !== undefined) {
      setCount(state.count);
    }
    if (state.fetchedAt !== undefined) {
      setFetchedAt(state.fetchedAt);
    }
    if (state.errors !== undefined) {
      setErrors(Array.isArray(state.errors) ? state.errors : []);
    }
  }, []);

  const add = () => {
    const url = draft.trim();
    if (!url) {
      return;
    }
    // Optimistic: the list is what the person is editing, so it moves as they
    // type rather than a round-trip later. The service's own state arrives
    // straight after and replaces this.
    setFeeds((current) =>
      current.some((feed) => feed.url === url)
        ? current
        : [...current, { url, name: "" }],
    );
    setDraft("");
    props.service.configure({ addFeed: url });
  };

  return (
    <RuntimeRestServiceUI
      {...props}
      onNotification={onUpdate}
      onInit={onUpdate}
      genericUI={false}
    >
      <div className="flex flex-col gap-2" style={{ minWidth: 320 }}>
        <div className="flex items-end gap-2">
          <div style={{ flex: 1, minWidth: 0 }}>
            <InputField label="Feed URL" value={draft} onChange={setDraft} />
          </div>
          <Button className="hkp-svc-btn" disabled={!draft.trim()} onClick={add}>
            Add
          </Button>
        </div>

        <div className="border border-gray-300 p-2">
          <h3 className="tracking-[6px]">Feeds</h3>
          {feeds.length === 0 ? (
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              No feeds yet. Add an RSS or Atom URL above.
            </div>
          ) : (
            <div className="flex flex-col gap-1" style={{ marginTop: 4 }}>
              {feeds.map((feed) => {
                const failed = errors.find((e) => e.url === feed.url);
                return (
                  <div
                    key={feed.url}
                    className="flex items-center gap-2"
                    style={{ fontSize: 12 }}
                  >
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        color: failed ? "#ef4444" : undefined,
                      }}
                      title={failed ? failed.error : feed.url}
                    >
                      {feed.name ? `${feed.name} — ` : ""}
                      {feed.url}
                    </span>
                    <Button
                      className="hkp-svc-btn"
                      onClick={() => {
                        setFeeds((current) =>
                          current.filter((f) => f.url !== feed.url),
                        );
                        props.service.configure({ removeFeed: feed.url });
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <InputField
          label="Limit"
          value={limit}
          onChange={(value) => {
            setLimit(value);
            const parsed = Number(value);
            if (Number.isFinite(parsed) && parsed > 0) {
              props.service.configure({ limit: parsed });
            }
          }}
        />

        <div className="flex items-center justify-between">
          <span style={{ fontSize: 12, opacity: 0.7 }}>
            {fetching
              ? "fetching…"
              : count === null
                ? "not fetched yet"
                : `${count} articles${fetchedAt ? ` · ${new Date(fetchedAt).toLocaleTimeString()}` : ""}`}
          </span>
          <Button
            className="hkp-svc-btn"
            disabled={fetching || feeds.length === 0}
            // A service on a remote runtime has no local instance to call, so
            // the panel asks for a round through configure. The service treats
            // it as the same work its process() does.
            onClick={() => props.service.configure({ refresh: true })}
          >
            Refresh
          </Button>
        </div>

        {errors.length > 0 && (
          <div style={{ fontSize: 12, color: "#ef4444" }}>
            {errors.length} of {feeds.length} feeds failed — hover a red feed
            for why.
          </div>
        )}
      </div>
    </RuntimeRestServiceUI>
  );
}
