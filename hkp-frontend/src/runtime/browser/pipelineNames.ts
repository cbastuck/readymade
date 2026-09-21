import BrowserRuntimeScope from "./BrowserRuntimeScope";

type NamedEntry = {
  serviceId: string;
  instanceId: string;
  serviceName?: string;
  state?: Record<string, any>;
};

/**
 * The entries of `current` with the names `next` gives them — when a name is
 * all that differs between the two. Null otherwise, including when nothing
 * differs at all.
 *
 * A host is handed its whole pipeline back to rename one service in it, since
 * `pipeline` is the one configure every host understands. Rebuilding for that
 * would restart what the pipeline is running — a Timer, a socket — to change a
 * label, so a host asks this first and renames in place when it can.
 */
export function renamedEntries<T extends NamedEntry>(
  current: T[],
  next: unknown,
): T[] | null {
  if (!Array.isArray(next) || next.length !== current.length) {
    return null;
  }
  let renamed = false;
  const entries: T[] = [];
  for (let i = 0; i < current.length; i++) {
    const was = current[i];
    const now = next[i] ?? {};
    const nowId = now.instanceId ?? now.uuid;
    if (
      now.serviceId !== was.serviceId ||
      nowId !== was.instanceId ||
      JSON.stringify(now.state ?? null) !== JSON.stringify(was.state ?? null)
    ) {
      return null;
    }
    const name =
      typeof now.serviceName === "string" && now.serviceName
        ? now.serviceName
        : undefined;
    renamed ||= name !== was.serviceName;
    const { serviceName: _previous, ...rest } = was;
    entries.push({ ...rest, ...(name ? { serviceName: name } : {}) } as T);
  }
  return renamed ? entries : null;
}

/** Puts the entries' names on the live services a scope is running. */
export function renameLiveServices(
  scope: BrowserRuntimeScope | null,
  entries: NamedEntry[],
): void {
  if (!scope) {
    return;
  }
  for (const entry of entries) {
    const [service] = scope.findServiceInstance(entry.instanceId);
    if (service) {
      service.serviceName = entry.serviceName ?? entry.serviceId;
    }
  }
}
