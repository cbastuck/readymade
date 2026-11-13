import type { NestedNavigation } from "./NestedNavigation";
import type { FlowSide } from "hkp-frontend/src/ui-components/service/flowRecords";
import { requestInspector } from "hkp-frontend/src/ui-components/service/inspectorRequests";
import { requestRuntimeExpanded } from "hkp-frontend/src/ui-components/runtime-ui/runtimeRequests";

/** How long a service stays marked after it was brought into view. */
export const REVEAL_HIGHLIGHT_MS = 2000;
/** How long to keep looking for a service's frame after opening its levels. */
export const REVEAL_TIMEOUT_MS = 2000;

/** The class a revealed frame's card is marked with for a moment. */
const REVEALED_CLASS = "hkp-service-card--revealed";
/** The service's card inside its frame (`ServiceFrame`). */
const CARD_CLASS = "hkp-service-card";

export type RevealTarget = {
  /** What the service is called in its own pipeline — what its frame renders under. */
  uuid: string;
  /** The uuids of the services hosting it, outermost first. */
  ancestry: string[];
  /** What the level opened from the host at `depth` is called in the trail. */
  hostLabel: (depth: number) => string;
  /**
   * The runtime holding the service, where known. A collapsed runtime shows
   * none of its services, so it is expanded first.
   */
  runtimeId?: string;
};

/**
 * Brings a service into view on the board, from wherever the board is being
 * looked at from — the overview, the asset view, a facade widget.
 *
 * A nested service is only on screen once every pipeline above it has been
 * opened, so the hosts are opened outermost first — each one renders the level
 * the next is found on. The frame therefore does not exist yet when the last
 * one is asked for, and is waited for rather than assumed.
 *
 * Each level is asked for by the service it has to hold — the next host down,
 * or the service itself — rather than by its host alone: a host with several
 * pipelines, a Switch's cases, opens each under a name of its own panel's
 * making, and which of them leads on is only known from what is inside.
 *
 * The runtime holding it is expanded first where it is collapsed, and the
 * frame is only taken once it is laid out: a collapsed runtime may keep its
 * frames in the page without showing them, and scrolling to one of those
 * scrolls to nothing.
 *
 * With `inspect`, the frame's flow inspector is then opened on that side; the
 * frame asks about Capture mode first where it is off, as it does when its own
 * plug is pressed.
 */
export function revealService(
  target: RevealTarget,
  navigation: NestedNavigation | null,
  { inspect }: { inspect?: FlowSide } = {},
): void {
  if (target.runtimeId) {
    requestRuntimeExpanded(target.runtimeId);
  }
  if (navigation) {
    target.ancestry.forEach((hostUuid, depth) => {
      navigation.openHolding(
        hostUuid,
        target.ancestry[depth + 1] ?? target.uuid,
        target.hostLabel(depth),
        depth,
      );
    });
    if (target.ancestry.length === 0) {
      navigation.goTo(0);
    }
  }

  const deadline = performance.now() + REVEAL_TIMEOUT_MS;
  const look = () => {
    // The frame a service renders in carries an id built from its uuid, which
    // is the same id a nested entry is reported under.
    const element = document.getElementById(`service-frame-${target.uuid}`);
    if (element && isLaidOut(element)) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      // The card is what is marked, not the frame: the frame also holds the
      // flow inspector's plug beside the card, which nobody reads as part of
      // the service.
      const card = element.querySelector(`.${CARD_CLASS}`) ?? element;
      card.classList.add(REVEALED_CLASS);
      setTimeout(
        () => card.classList.remove(REVEALED_CLASS),
        REVEAL_HIGHLIGHT_MS,
      );
      if (inspect) {
        requestInspector(target.uuid, inspect);
      }
      return;
    }
    if (performance.now() < deadline) {
      requestAnimationFrame(look);
    }
  };
  requestAnimationFrame(look);
}

/** Whether an element takes up room on the page — not hidden, not folded away. */
function isLaidOut(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

type Entry = { uuid?: string; instanceId?: string; serviceId?: string; serviceName?: string; state?: { serviceName?: string } };

function isEntry(value: unknown): value is Entry {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as Entry).serviceId === "string"
  );
}

/**
 * The reveal target for a place inside a top-level service's state: the
 * innermost service entry the path passes through, with the entries above it
 * as its ancestry. A path that passes through none names the service itself.
 *
 * Found by the shape of an entry — a `serviceId` — rather than by the field a
 * container keeps its pipeline in, for the reason `runtime/board/address.ts`
 * gives.
 */
export function revealTargetAlong(
  service: { uuid: string; serviceName?: string; state?: unknown },
  path: Array<string | number>,
): RevealTarget {
  const chain: { uuid: string; label: string }[] = [
    { uuid: service.uuid, label: service.serviceName ?? service.uuid },
  ];
  let value: unknown = service.state;
  for (const step of path) {
    if (!value || typeof value !== "object") {
      break;
    }
    value = (value as Record<string | number, unknown>)[step];
    if (isEntry(value)) {
      const uuid = value.instanceId ?? value.uuid;
      if (uuid) {
        chain.push({
          uuid,
          label: value.serviceName ?? value.state?.serviceName ?? uuid,
        });
      }
    }
  }
  const leaf = chain[chain.length - 1];
  const hosts = chain.slice(0, -1);
  return {
    uuid: leaf.uuid,
    ancestry: hosts.map((host) => host.uuid),
    hostLabel: (depth) => hosts[depth]?.label ?? "Pipeline",
  };
}
