import { X } from "lucide-react";

import { RuntimeClass } from "hkp-frontend/src/types";
import { ColorPicker } from "../ColorPicker";

type Props = {
  remoteRuntimes: Array<RuntimeClass>;
  onRemoveRuntime: (rt: RuntimeClass) => void;
  onChangeRuntimeColor: (rt: RuntimeClass, color: string) => void;
};

export default function ExistingRuntimesPanel({
  remoteRuntimes,
  onRemoveRuntime,
  onChangeRuntimeColor,
}: Props) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        Registered remotes
      </span>

      {remoteRuntimes.length === 0 && (
        <p className="py-1 text-center text-sm italic text-slate-400">
          No remote runtimes registered yet.
        </p>
      )}

      {remoteRuntimes.map((rt, idx) => {
        const builtIn = rt.url?.startsWith("hkp://remotes/") ?? false;
        return (
          <div
            key={`${rt.name}-${rt.url}-${idx}`}
            className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2"
          >
            <ColorPicker
              showPaletteOnly={true}
              disabled={builtIn}
              onChange={(color) => onChangeRuntimeColor(rt, color)}
              value={rt.color || "white"}
              className="h-6 w-6 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-800">
                {rt.name}
              </div>
              <div className="truncate text-xs text-slate-500">{rt.url}</div>
            </div>
            {!builtIn && (
              <button
                onClick={() => onRemoveRuntime(rt)}
                aria-label={`Remove ${rt.name}`}
                className="shrink-0 text-slate-400 hover:text-red-600"
              >
                <X size={15} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
