import { useCallback, useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import InputField from "hkp-frontend/src/components/shared/InputField";
import Button from "hkp-frontend/src/ui-components/Button";
import RuntimeRestServiceUI from "../RuntimeRestServiceUI";

type Table = {
  asset: string;
  type?: string;
  built?: string;
  bytes?: number;
  error?: string;
};

/** The fields worth a line in the panel, in the order a person reads them. */
const SHOWN: Array<[string, string]> = [
  ["network", "Network"],
  ["city", "City"],
  ["region", "Region"],
  ["country", "Country"],
  ["organisation", "Organisation"],
  ["asn", "ASN"],
  ["timeZone", "Time zone"],
];

function megabytes(bytes: number | undefined): string {
  return bytes ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : "";
}

/**
 * Which tables the service holds, and what they say about one address.
 *
 * The panel answers the two questions a person has about a lookup that is not
 * doing what they expect: did the table they named actually load, and what does
 * it say about the address in front of them. A table is named as an asset —
 * the asset view is where its source is written — so what is edited here is
 * only which ones are asked, and in what order. The second is asked through
 * `configure` rather than by sending the address down the pipeline, so trying
 * one does not set off whatever the board does with an answer.
 */
export default function IpLookupUI(props: ServiceUIProps) {
  const [databases, setDatabases] = useState("");
  const [tables, setTables] = useState<Table[]>([]);
  const [rows, setRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const onUpdate = useCallback((state: any) => {
    if (Array.isArray(state.databases)) {
      setDatabases(state.databases.join(", "));
    }
    if (Array.isArray(state.tables)) {
      setTables(state.tables);
    }
    if (Array.isArray(state.table)) {
      setRows(state.table.length);
    }
    if (state.loading !== undefined) {
      setLoading(!!state.loading);
    }
    if (typeof state.error === "string") {
      setError(state.error);
    }
    if (state.lastResult !== undefined) {
      setResult(state.lastResult);
    }
  }, []);

  const lookup = () => {
    const ip = draft.trim();
    if (ip) {
      props.service.configure({ lookup: ip });
    }
  };

  return (
    <RuntimeRestServiceUI
      {...props}
      onNotification={onUpdate}
      onInit={onUpdate}
      genericUI={false}
    >
      <div className="flex flex-col gap-2" style={{ minWidth: 320 }}>
        <InputField
          label="Tables"
          value={databases}
          onChange={(value) => {
            setDatabases(value);
            props.service.configure({ databases: value });
          }}
        />

        <div className="border border-gray-300 p-2">
          <div className="flex items-center justify-between">
            <h3 className="tracking-[6px]">Tables</h3>
            <Button
              className="hkp-svc-btn"
              disabled={loading || tables.length === 0}
              // Asks each source whether it has a newer table, and fetches
              // the ones that do.
              onClick={() => props.service.configure({ reload: true })}
            >
              Update
            </Button>
          </div>
          <div className="flex flex-col gap-1" style={{ marginTop: 4, fontSize: 12 }}>
            {tables.length === 0 && rows === 0 && (
              <div style={{ opacity: 0.7 }}>
                No table yet. Name an asset holding an MMDB table
                (hkp-asset://…), or give the service rows of its own.
              </div>
            )}
            {tables.map((table) => (
              <div
                key={table.asset}
                style={{ color: table.error ? "#ef4444" : undefined }}
                title={table.error || table.asset}
              >
                {table.asset.replace("hkp-asset://", "")}
                <span style={{ opacity: 0.7 }}>
                  {/* A table that failed to update is still held and still
                      answering, so what it is stays on show beside why. */}
                  {[table.type, table.built?.slice(0, 10), megabytes(table.bytes)]
                    .filter(Boolean)
                    .map((part) => ` · ${part}`)
                    .join("")}
                  {table.error ? ` — ${table.error}` : ""}
                </span>
              </div>
            ))}
            {rows > 0 && (
              <div>
                The board's own
                <span style={{ opacity: 0.7 }}>
                  {` — ${rows} ${rows === 1 ? "row" : "rows"}`}
                </span>
              </div>
            )}
            {loading && (
              <div style={{ opacity: 0.7 }}>
                loading… a table fetched for the first time can take a minute
              </div>
            )}
          </div>
        </div>

        <div className="flex items-end gap-2">
          <div style={{ flex: 1, minWidth: 0 }}>
            <InputField label="Try an address" value={draft} onChange={setDraft} />
          </div>
          <Button className="hkp-svc-btn" disabled={!draft.trim()} onClick={lookup}>
            Look up
          </Button>
        </div>

        {result && (
          <div className="border border-gray-300 p-2" style={{ fontSize: 12 }}>
            <div>
              {String(result.ip ?? "")}
              <span style={{ opacity: 0.7 }}>
                {result.error
                  ? ` — ${String(result.error)}`
                  : result.found
                    ? ""
                    : ` — not in any table (${String(result.addressType ?? "unknown")})`}
              </span>
            </div>
            {SHOWN.filter(([key]) => result[key] !== undefined).map(([key, label]) => (
              <div key={key} className="flex gap-2">
                <span style={{ opacity: 0.7, minWidth: 96 }}>{label}</span>
                <span>{String(result[key])}</span>
              </div>
            ))}
          </div>
        )}

        {error && <div style={{ fontSize: 12, color: "#ef4444" }}>{error}</div>}
      </div>
    </RuntimeRestServiceUI>
  );
}
