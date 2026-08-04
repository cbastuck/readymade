import { describe, expect, it } from "vitest";

import {
  coordinatorRuntimeEngine,
  withCoordinatorEngines,
} from "../common";
import { RuntimeClass } from "../types";

describe("coordinator runtime engines", () => {
  it("addresses the runtime API at the coordinator URL's base", () => {
    expect(
      coordinatorRuntimeEngine({
        name: "Mac Pro",
        url: "http://mac.local:8080/coordinator",
      }),
    ).toEqual({ type: "rest", name: "Mac Pro", url: "http://mac.local:8080" });

    // Trailing slash, and a coordinator whose URL is already a bare host.
    expect(
      coordinatorRuntimeEngine({
        name: "Mac Pro",
        url: "http://mac.local:8080/coordinator/",
      }).url,
    ).toBe("http://mac.local:8080");
    expect(
      coordinatorRuntimeEngine({ name: "Bare", url: "http://mac.local:8080" })
        .url,
    ).toBe("http://mac.local:8080");
  });

  it("appends coordinators that are not already configured as remotes", () => {
    const engines: RuntimeClass[] = [
      { type: "browser", name: "Browser Runtime" },
      { type: "rest", name: "meander-ios", url: "http://127.0.0.1:8887" },
    ];

    const merged = withCoordinatorEngines(engines, [
      { name: "Mac Pro", url: "http://mac.local:8080/coordinator" },
    ]);

    expect(merged.map((rt) => rt.name)).toEqual([
      "Browser Runtime",
      "meander-ios",
      "Mac Pro",
    ]);
  });

  it("keeps the configured remote when a coordinator shares its host", () => {
    const engines: RuntimeClass[] = [
      { type: "rest", name: "Mac (LAN)", url: "http://mac.local:8080/" },
    ];

    const merged = withCoordinatorEngines(engines, [
      { name: "Mac Pro", url: "http://mac.local:8080/coordinator" },
      // Two coordinators on one host contribute one engine, not two.
      { name: "Mac Pro (again)", url: "http://mac.local:8080/coordinator" },
    ]);

    expect(merged).toBe(engines);
  });

  it("returns the same array when there is nothing to add", () => {
    const engines: RuntimeClass[] = [{ type: "browser", name: "Browser" }];
    expect(withCoordinatorEngines(engines, [])).toBe(engines);
  });
});
