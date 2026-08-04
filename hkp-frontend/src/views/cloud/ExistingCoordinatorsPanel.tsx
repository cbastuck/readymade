import { X } from "lucide-react";

import { CoordinatorDescriptor } from "../../common";

type Props = {
  coordinators: CoordinatorDescriptor[];
  onRemove: (coordinator: CoordinatorDescriptor) => void;
};

// Card rows rather than a table: a coordinator URL is long and unbreakable, so
// the row truncates it and fits whatever width the surface gives it — the
// settings dialog is far narrower than the Cloud Boards one. Mirrors the
// registered-remotes list, which sits next to this one in the settings dialog.
export default function ExistingCoordinatorsPanel({
  coordinators,
  onRemove,
}: Props) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        Registered coordinators
      </span>

      {coordinators.length === 0 && (
        <p className="py-1 text-center text-sm italic text-slate-400">
          No coordinators added yet.
        </p>
      )}

      {coordinators.map((coord, idx) => (
        <div
          key={`${coord.name}-${coord.url}-${idx}`}
          className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2"
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-slate-800">
              {coord.name}
            </div>
            <div className="truncate text-xs text-slate-500" title={coord.url}>
              {coord.url}
            </div>
          </div>
          <button
            onClick={() => onRemove(coord)}
            aria-label={`Remove ${coord.name}`}
            className="shrink-0 text-slate-400 hover:text-red-600"
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
