import { useState } from "react";

import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import Select from "hkp-frontend/src/ui-components/Select";
import { ServiceUIProps } from "hkp-frontend/src/types";

const TRIGGERS = ["config", "process"];

type State = {
  updateTrigger: string;
  initial: unknown;
  values: unknown;
};

const EMPTY_STATE: State = {
  updateTrigger: "config",
  initial: undefined,
  values: undefined,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatValue(value: unknown): string {
  if (value === undefined) {
    return "—";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : String(+value.toFixed(3));
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

/**
 * The Cache's panel: when it updates, and what it currently holds beside what
 * it started from, one row per property.
 */
export default function CacheUI(props: ServiceUIProps) {
  const { service } = props;
  const [state, setState] = useState<State>(EMPTY_STATE);

  // Init reports the configuration only; a notification also carries the
  // values, so a field left out keeps what the panel last showed.
  const onUpdate = (next: any) => {
    setState((previous) => ({
      updateTrigger: next?.updateTrigger ?? previous.updateTrigger,
      initial: next?.initial !== undefined ? next.initial : previous.initial,
      values: next?.values !== undefined ? next.values : previous.values,
    }));
  };

  const { updateTrigger, initial, values } = state;
  // Until the first update the cache holds its initial value.
  const current = values !== undefined ? values : initial;
  const keys = [
    ...new Set([
      ...(isRecord(initial) ? Object.keys(initial) : []),
      ...(isRecord(current) ? Object.keys(current) : []),
    ]),
  ];

  return (
    <ServiceUI
      {...props}
      className="pb-2"
      initialSize={{ width: 280, height: undefined }}
      onInit={onUpdate}
      onNotification={onUpdate}
    >
      <div className="flex flex-col gap-2 text-xs">
        <div className="flex items-center gap-2">
          Update on:
          <Select
            options={TRIGGERS}
            value={updateTrigger}
            onChange={(v) => {
              setState((previous) => ({ ...previous, updateTrigger: v }));
              service.configure({ updateTrigger: v });
            }}
          />
        </div>
        {keys.length > 0 ? (
          <table className="w-full font-mono tabular-nums">
            <thead>
              <tr className="text-left opacity-60">
                <th className="font-normal pr-2">key</th>
                <th className="font-normal pr-2 text-right">current</th>
                <th className="font-normal text-right">initial</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => {
                const now = isRecord(current) ? current[key] : undefined;
                const was = isRecord(initial) ? initial[key] : undefined;
                const changed = JSON.stringify(now) !== JSON.stringify(was);
                return (
                  <tr key={key}>
                    <td className="pr-2">{key}</td>
                    <td
                      className="pr-2 text-right"
                      style={{ fontWeight: changed ? 600 : undefined }}
                    >
                      {formatValue(now)}
                    </td>
                    <td className="text-right opacity-60">
                      {formatValue(was)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="font-mono break-all opacity-80">
            {current === undefined ? "empty" : formatValue(current)}
          </div>
        )}
      </div>
    </ServiceUI>
  );
}
