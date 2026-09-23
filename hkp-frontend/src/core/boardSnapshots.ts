import { BoardDocuments } from "./boardPersistence";

/**
 * Why a snapshot was taken.
 *
 * `structure`: runtimes or services were added, removed, reordered or renamed.
 * `configuration`: a person changed what a service is configured with, through
 * its panel or a facade widget.
 */
export type BoardSnapshotReason = "structure" | "configuration";

/**
 * The board as it is running, in the documents it would be saved as.
 *
 * Serialised from the live services rather than from what the board was
 * loaded with, so what a service was configured with since is part of it.
 */
export type BoardSnapshot = {
  boardName: string | undefined;
  documents: BoardDocuments;
  reason: BoardSnapshotReason;
};

type Serialized = Omit<BoardSnapshot, "reason">;

export type SnapshotSchedulerOptions = {
  /** Reads the board as it is running; null when there is nothing to read. */
  serialize: () => Promise<Serialized | null>;
  write: (snapshot: BoardSnapshot) => void;
  /** Longest a change waits while further changes keep arriving. */
  maxWaitMs: number;
  now?: () => number;
};

export type SnapshotScheduler = {
  /**
   * Asks for a snapshot `delayMs` after the last request, or `maxWaitMs` after
   * the first unwritten one, whichever comes first. A structural request
   * outranks a configuration one: the snapshot then says `structure`.
   */
  schedule: (reason: BoardSnapshotReason, delayMs: number) => void;
  /**
   * Writes what is pending now, and resolves once every write started so far
   * is done. For before a board is torn down or replaced — later, there is
   * nothing left to read.
   */
  flush: () => Promise<void>;
  /** Drops what is pending without writing it. */
  cancel: () => void;
  /**
   * The board was just loaded: the next snapshot is what it was loaded as, and
   * is remembered to compare against rather than written — unless a person
   * changed something before it was taken. Opening a board is not an edit.
   */
  rebase: () => void;
};

/**
 * Coalesces requests for a snapshot into few writes.
 *
 * A request only marks the board as changed. Serialising — which asks every
 * service for its configuration, a request per service on a remote runtime —
 * happens once the changes pause. A snapshot identical to the last one written
 * is not written again, so configure calls that change nothing (a panel
 * re-sending what it shows) cost a serialisation and no write.
 *
 * Writes happen one after the other, in the order they were requested, so a
 * slow serialisation cannot land after a newer one.
 */
export function createSnapshotScheduler(
  options: SnapshotSchedulerOptions,
): SnapshotScheduler {
  const { serialize, write, maxWaitMs, now = () => Date.now() } = options;

  let pending: BoardSnapshotReason | null = null;
  // Whether a person's change is among what is pending, which a structural
  // request would otherwise hide in `pending`.
  let pendingConfiguration = false;
  let rebasing = false;
  let firstPendingAt: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let writes: Promise<void> = Promise.resolve();
  let lastWritten: string | null = null;

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const writeSnapshot = async (
    reason: BoardSnapshotReason,
    baselineOnly: boolean,
  ) => {
    const serialized = await serialize();
    if (!serialized) {
      return;
    }
    const key = JSON.stringify(serialized);
    if (key === lastWritten) {
      return;
    }
    lastWritten = key;
    if (!baselineOnly) {
      write({ ...serialized, reason });
    }
  };

  const flush = () => {
    clearTimer();
    if (pending !== null) {
      const reason = pending;
      const baselineOnly = rebasing && !pendingConfiguration;
      pending = null;
      pendingConfiguration = false;
      rebasing = false;
      firstPendingAt = null;
      writes = writes
        .then(() => writeSnapshot(reason, baselineOnly))
        .catch((err) => {
          console.error("Failed to take a board snapshot", err);
        });
    }
    return writes;
  };

  const schedule = (reason: BoardSnapshotReason, delayMs: number) => {
    pending = pending === "structure" ? pending : reason;
    pendingConfiguration ||= reason === "configuration";
    const at = now();
    firstPendingAt ??= at;
    clearTimer();
    const remaining = Math.max(0, firstPendingAt + maxWaitMs - at);
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, Math.min(delayMs, remaining));
  };

  const cancel = () => {
    clearTimer();
    pending = null;
    pendingConfiguration = false;
    rebasing = false;
    firstPendingAt = null;
  };

  const rebase = () => {
    rebasing = true;
  };

  return { schedule, flush, cancel, rebase };
}
