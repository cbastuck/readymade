import { blockUseContaining, BlockLinkage } from "hkp-frontend/src/runtime/board/blocks";
import { OverviewNode, OverviewScene, keyOf } from "hkp-frontend/src/overview/graph";
import type { RevealTarget } from "hkp-frontend/src/runtime/ui/revealService";

/**
 * Where a service a facade names lives on the board, said the way the board
 * says it rather than by uuid — `Node › Switch › case "paid" › Mailer` — and
 * whether a binding to it resolves at all.
 *
 * Read from the overview's scene (`overview/graph.ts`), which already walks
 * every pipeline at every depth with each node's ancestry and label. A facade
 * address is a node's key: a top-level uuid, or the dotted path through the
 * services holding it (`runtime/board/address.ts`).
 */

export type Crumb = {
  label: string;
  kind: "runtime" | "service" | "pipeline";
};

export type ServiceLocation =
  // The board has not been read far enough to tell.
  | { status: "pending"; address: string }
  // No service on the board answers to the address.
  | { status: "missing"; address: string }
  // There, and reachable the way the facade reaches it.
  | { status: "found"; address: string; node: OverviewNode; breadcrumb: Crumb[] }
  // There, on a remote runtime this window cannot reach — not attached, or no
  // address to dial.
  | {
      status: "unreachable";
      address: string;
      node: OverviewNode;
      breadcrumb: Crumb[];
    }
  // Inside a use of a block, which is addressed as a whole: the binding points
  // at the use, the way the board does.
  | {
      status: "inside-use";
      address: string;
      block: string;
      // The use itself, where the scene has it.
      use: { address: string; node?: OverviewNode };
      breadcrumb: Crumb[];
    };

/** What a pipeline is called when its host holds only the one. */
const DEFAULT_PIPELINE = "pipeline";

/**
 * The trail to a node: its runtime, each host above it outermost first, and
 * the host's pipeline the trail goes through where the host names more than
 * the default one — a Switch's case, an endpoint's `onRequest`.
 */
export function breadcrumbOf(scene: OverviewScene, node: OverviewNode): Crumb[] {
  const runtime = scene.runtimes.find((rt) => rt.id === node.runtimeId);
  const crumbs: Crumb[] = [
    { label: runtime?.label ?? node.runtimeId, kind: "runtime" },
  ];
  const chain = [
    ...node.ancestry.map((uuid, depth) =>
      scene.byKey.get(keyOf(node.ancestry.slice(0, depth), uuid)),
    ),
    node,
  ];
  chain.forEach((entry, i) => {
    if (!entry) {
      return;
    }
    crumbs.push({ label: entry.label, kind: "service" });
    const next = chain[i + 1];
    if (next?.pipeline && next.pipeline !== DEFAULT_PIPELINE) {
      crumbs.push({ label: next.pipeline, kind: "pipeline" });
    }
  });
  return crumbs;
}

/**
 * The scene's node for an address. An address is unique only within its
 * runtime; as `findService` does, the first runtime holding it answers.
 */
export function nodeAt(
  scene: OverviewScene,
  address: string,
  runtimeId?: string,
): OverviewNode | undefined {
  return scene.nodes.find(
    (node) =>
      node.key === address && (!runtimeId || node.runtimeId === runtimeId),
  );
}

export function locateService(
  scene: OverviewScene | null,
  address: string,
  {
    settled,
    linkage,
    isReachable,
  }: {
    // Whether the scene carries what the services report, nesting included.
    settled: boolean;
    linkage?: BlockLinkage;
    isReachable: (address: string) => boolean;
  },
): ServiceLocation {
  const use = blockUseContaining(linkage, address);
  if (use) {
    const node = scene ? nodeAt(scene, use.address, use.runtimeId) : undefined;
    return {
      status: "inside-use",
      address,
      block: use.use.block,
      use: { address: use.address, node },
      breadcrumb: scene && node ? breadcrumbOf(scene, node) : [],
    };
  }

  const node = scene ? nodeAt(scene, address) : undefined;
  if (!scene || !node) {
    return settled && scene
      ? { status: "missing", address }
      : { status: "pending", address };
  }

  const breadcrumb = breadcrumbOf(scene, node);
  return isReachable(address)
    ? { status: "found", address, node, breadcrumb }
    : { status: "unreachable", address, node, breadcrumb };
}

/**
 * What to bring into view for a location: the service, or for a service
 * inside a use, the use. Null where there is nothing on the board to show.
 */
export function revealTargetOf(location: ServiceLocation): RevealTarget | null {
  const node =
    location.status === "found" || location.status === "unreachable"
      ? location.node
      : location.status === "inside-use"
        ? location.use.node
        : undefined;
  if (!node) {
    return null;
  }
  // The breadcrumb names each host in order, after the runtime.
  const hosts = location.status === "missing" || location.status === "pending"
    ? []
    : location.breadcrumb.filter((crumb) => crumb.kind === "service");
  return {
    uuid: node.uuid,
    ancestry: node.ancestry,
    hostLabel: (depth) => hosts[depth]?.label ?? "Pipeline",
    runtimeId: node.runtimeId,
  };
}
