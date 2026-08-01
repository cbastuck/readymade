/**
 * The board as its coordinator sees it, cached for rendering.
 *
 * A cloud board is owned by its coordinator: it provisions the remote runtimes
 * and holds their state. A browser attaching renders from what it is told —
 * this store is that telling, kept up to date by snapshots and the increments
 * that follow. It owns nothing: everything here is a copy of state that lives
 * somewhere else, and the browser's own runtimes are not in it at all.
 *
 * What only it can carry is what a saved board cannot: each runtime's registry
 * (panel selection resolves by serviceId *and* version) and each service's live
 * state (a mount's address is assigned when its runtime is provisioned). It also
 * carries the authored config, which is fetchable over REST too — the board list
 * reads it there for boards nobody has attached to — so that an attached browser
 * gets structure and state as one thing at one `seq` rather than two fetches
 * that can disagree.
 *
 * See TODO-CLOUD-COORDINATOR.md; the coordinator half is
 * `hkp-node/src/coordinator/bridgeProtocol.ts`.
 */

export type RuntimeSnapshot = {
  runtimeId: string;
  registry: unknown[];
  services: Record<string, unknown>;
};

export type SnapshotMessage = {
  type: "snapshot";
  seq: number;
  boardName: string;
  /** "running" while the coordinator owns the board's runtimes; "stopped" while
   *  someone has taken them over to edit. */
  status?: string;
  /** The board as authored. Also fetchable over REST, but sent here so that
   *  structure and live state arrive as one thing at one `seq`. */
  config?: unknown;
  runtimes: RuntimeSnapshot[];
};

export type ServiceStateMessage = {
  type: "serviceState";
  seq: number;
  runtimeId: string;
  serviceUuid: string;
  state: unknown;
};

export type CoordinatorMessage = SnapshotMessage | ServiceStateMessage;

export class CoordinatorSnapshotStore {
  private boardName: string | null = null;
  private status: string | null = null;
  private config: unknown = null;
  private runtimes = new Map<string, RuntimeSnapshot>();
  private seq = 0;
  private listeners = new Set<() => void>();

  /**
   * Applies a message from the coordinator.
   *
   * Returns whether a fresh snapshot is needed: increments are numbered, so a
   * gap means one was missed, and carrying on from an incomplete view would
   * render state that never existed. The caller answers by sending `resync`.
   */
  apply(message: CoordinatorMessage): { needsResync: boolean } {
    if (message.type === "snapshot") {
      this.boardName = message.boardName;
      this.status = message.status ?? null;
      this.config = message.config ?? null;
      this.runtimes = new Map(
        message.runtimes.map((runtime) => [runtime.runtimeId, runtime]),
      );
      this.seq = message.seq;
      this.emit();
      return { needsResync: false };
    }

    // An increment for a runtime this store has never been told about, or one
    // that is not the next in sequence: either way the view is incomplete.
    const runtime = this.runtimes.get(message.runtimeId);
    if (!runtime || message.seq !== this.seq + 1) {
      return { needsResync: true };
    }

    this.runtimes.set(message.runtimeId, {
      ...runtime,
      services: { ...runtime.services, [message.serviceUuid]: message.state },
    });
    this.seq = message.seq;
    this.emit();
    return { needsResync: false };
  }

  /** Forgets everything — for a reconnect, before the next snapshot arrives. */
  clear(): void {
    this.boardName = null;
    this.status = null;
    this.config = null;
    this.runtimes = new Map();
    this.seq = 0;
    this.emit();
  }

  getBoardName(): string | null {
    return this.boardName;
  }

  /** "running", "stopped", or null before the first snapshot. */
  getStatus(): string | null {
    return this.status;
  }

  /** The board as authored, as the coordinator holds it. */
  getConfig(): unknown {
    return this.config;
  }

  getRuntimeIds(): string[] {
    return [...this.runtimes.keys()];
  }

  getRegistry(runtimeId: string): unknown[] {
    return this.runtimes.get(runtimeId)?.registry ?? [];
  }

  getServiceState(runtimeId: string, serviceUuid: string): unknown {
    return this.runtimes.get(runtimeId)?.services[serviceUuid];
  }

  /** Every service state of a runtime, keyed by uuid. */
  getServices(runtimeId: string): Record<string, unknown> {
    return this.runtimes.get(runtimeId)?.services ?? {};
  }

  /**
   * The shape a board coordinator reads (see `core/coordinator`), so mount
   * references resolve against what the coordinator reported.
   */
  asCoordinatorState(): {
    services: { [runtimeId: string]: Array<{ uuid: string; state?: unknown }> };
  } {
    const services: {
      [runtimeId: string]: Array<{ uuid: string; state?: unknown }>;
    } = {};
    for (const [runtimeId, runtime] of this.runtimes) {
      services[runtimeId] = Object.entries(runtime.services).map(
        ([uuid, state]) => ({ uuid, state }),
      );
    }
    return { services };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
