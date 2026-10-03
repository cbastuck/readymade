import {
  BoardDescriptor,
  RuntimeDescriptor,
  toCanonicalRuntimeClassType,
  toCanonicalServiceId,
} from "../types";
import { resolveTemplateVars } from "../templateVars";
import {
  AddressResolution,
  KnownRemote,
  RuntimeAddressingError,
  resolveRuntimeAddress,
} from "../runtime/board/remote";
import {
  RuntimeServerReport,
  describeRuntimeServer,
} from "../runtime/rest/RuntimeRestApi";
import { forEachServiceNode } from "../runtime/board/traversal";

/**
 * Checking a board before it is handed to a coordinator.
 *
 * Deploying gives the board's runtimes up before the coordinator builds them,
 * so a problem found by the coordinator is found too late: the browser no
 * longer owns the board and the coordinator could not start it. Everything that
 * can be known beforehand is therefore asked beforehand, from the browser —
 * the one party that knows this person's runtime servers and can reach them —
 * and answered per runtime.
 *
 * It is also where a board's `remote` becomes an address. That
 * happens here and nowhere else: the coordinator is told no address and
 * resolves no name.
 */

export type RuntimePreflightStatus =
  /** Its server is running, accepted this person, has every service the board
   *  uses there, and can connect to a coordinator. */
  | "ready"
  /** A browser runtime: run by whichever browser has the board open. */
  | "transient"
  /** It says where it runs more than once, or in a shape that cannot be read. */
  | "invalid"
  /** What it names did not resolve on this client. */
  | "unresolved"
  /** Its server did not answer. */
  | "unreachable"
  /** Its server answered and turned this person away. */
  | "refused"
  /** Its server lacks services the board uses there. */
  | "missing-services"
  /** Its server cannot connect to a coordinator. */
  | "cannot-join"
  /** Its server is from before a deployed board's runtimes were kept apart
   *  from a client's: this client leaving would take the board down. */
  | "outdated"
  /** A kind of runtime a coordinator does not run. */
  | "unsupported";

export type RuntimePreflight = {
  runtimeId: string;
  name: string;
  status: RuntimePreflightStatus;
  /** What went wrong, in the words of whoever said so. */
  detail?: string;
  /** Service ids the server does not have; set for "missing-services". */
  missing?: string[];
  /** Where this client reaches the runtime's server; set once it resolved. */
  url?: string;
  /** How the board said where the runtime runs. */
  mode?: "url" | "remote";
  /** The remote the board named. */
  remoteName?: string;
};

type PreflightUser = { userId: string; idToken: string };

/** Whether a finding means the board must not be handed over. */
export function blocksDeploy(finding: RuntimePreflight): boolean {
  return (
    finding.status !== "ready" &&
    finding.status !== "transient" &&
    finding.status !== "unsupported"
  );
}

/** One line a person can act on. */
export function describePreflight(finding: RuntimePreflight): string {
  const subject = `“${finding.name || finding.runtimeId}”`;
  // Said for a name, which is this client's to resolve.
  const on = finding.remoteName ? ` on “${finding.remoteName}”` : "";
  switch (finding.status) {
    case "ready":
      return `${subject} is ready${on}`;
    case "transient":
      return `${subject} runs in the browser, only while the board is open`;
    case "invalid":
    case "unresolved":
      return finding.detail ?? `${subject} names no runtime server`;
    case "unreachable":
      return `${subject}: its runtime server${on} is not running${suffix(finding.detail)}`;
    case "refused":
      return `${subject}: its runtime server${on} refused this account${suffix(finding.detail)}`;
    case "missing-services":
      return `${subject}: its runtime server${on} does not have ${(finding.missing ?? []).join(", ")}`;
    case "cannot-join":
      return `${subject}: its runtime server${on} cannot connect to a coordinator — a phone's built-in runtime does not, and an older server needs updating`;
    case "outdated":
      return `${subject}: its runtime server${on} needs updating before a board can be deployed to it — it is an older version, on which the deployed board would stop as soon as this one is closed`;
    case "unsupported":
      return `${subject} is a kind of runtime a coordinator does not run`;
  }
}

function suffix(detail: string | undefined): string {
  return detail ? ` (${detail})` : "";
}

/** Raised by a deploy that preflight stopped; nothing was handed over. */
export class DeployPreflightError extends Error {
  constructor(readonly findings: RuntimePreflight[]) {
    super(findings.filter(blocksDeploy).map(describePreflight).join("; "));
    this.name = "DeployPreflightError";
  }
}

/**
 * The service ids a board uses on a runtime, canonical and without repeats.
 *
 * Pipelines are data: SubService, Tracks, Switch and other control-flow
 * services carry service descriptors in their state. Those nested services
 * are built by the same runtime server and therefore have to be present in its
 * registry too. Walking the serialized value also keeps this independent of
 * which service happens to own a particular kind of nested pipeline.
 */
function requiredServiceIds(
  board: BoardDescriptor,
  runtimeId: string,
): string[] {
  const ids = new Set<string>();
  forEachServiceNode(board.services[runtimeId] ?? [], (service) => {
    if (service.serviceId) {
      ids.add(toCanonicalServiceId(service.serviceId));
    }
  });
  return [...ids];
}

/** What a runtime server's own report means for a runtime of this board. */
function assess(
  board: BoardDescriptor,
  runtime: RuntimeDescriptor,
  report: RuntimeServerReport,
): Pick<RuntimePreflight, "status" | "detail" | "missing"> {
  if (report.status !== "ok") {
    return { status: report.status, detail: report.detail };
  }
  if (!report.coordinatorLinks) {
    return { status: "cannot-join" };
  }
  if (!report.boardRuntimes) {
    return { status: "outdated" };
  }
  // A server that reports no registry cannot be checked against one; the
  // coordinator finds out when it builds the runtime.
  if (!report.registry) {
    return { status: "ready" };
  }
  const available = new Set(
    report.registry
      .map((entry) => entry?.serviceId)
      .filter((id): id is string => typeof id === "string")
      .map(toCanonicalServiceId),
  );
  const missing = requiredServiceIds(board, runtime.id).filter(
    (id) => !available.has(id),
  );
  return missing.length > 0
    ? { status: "missing-services", missing }
    : { status: "ready" };
}

/**
 * Says, per runtime, whether the board can be handed over — and for each
 * remote runtime, which runtime server it resolved to on this client.
 *
 * `remotes` are the runtime servers this client keeps.
 */
export async function preflightBoard(
  board: BoardDescriptor,
  remotes: KnownRemote[],
  user: PreflightUser,
): Promise<RuntimePreflight[]> {
  // Asked at most once per server, however many runtimes land on it.
  const reports = new Map<string, Promise<RuntimeServerReport>>();
  const reportOf = (url: string) => {
    const address = resolveTemplateVars(url);
    let report = reports.get(address);
    if (!report) {
      report = describeRuntimeServer(address, user);
      reports.set(address, report);
    }
    return report;
  };

  return Promise.all(
    board.runtimes.map(async (runtime): Promise<RuntimePreflight> => {
      const base = { runtimeId: runtime.id, name: runtime.name };
      const type = toCanonicalRuntimeClassType(runtime.type);
      if (type === "browser") {
        return { ...base, status: "transient" };
      }
      if (type !== "rest") {
        return { ...base, status: "unsupported" };
      }

      let resolution: AddressResolution;
      try {
        resolution = resolveRuntimeAddress(runtime, remotes);
      } catch (err) {
        if (err instanceof RuntimeAddressingError) {
          return { ...base, status: "invalid", detail: err.message };
        }
        throw err;
      }
      if (!resolution.ok) {
        return { ...base, status: "unresolved", detail: resolution.message };
      }

      const placed = {
        ...base,
        url: resolveTemplateVars(resolution.url),
        mode: resolution.mode,
        // Only for a name; an authored address is what the person wrote, and
        // naming a remote for it would be a guess.
        remoteName:
          resolution.mode === "url" ? undefined : resolution.remoteName,
      };
      return {
        ...placed,
        ...assess(board, runtime, await reportOf(resolution.url)),
      };
    }),
  );
}
