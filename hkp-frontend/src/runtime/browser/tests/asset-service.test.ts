import { describe, expect, it } from "vitest";

import BrowserRegistry from "hkp-frontend/src/runtime/browser/BrowserRegistry";
import BrowserRuntimeApi from "hkp-frontend/src/runtime/browser/BrowserRuntimeApi";
import { AssetDescriptor } from "hkp-frontend/src/runtime/board/assets";
import { RuntimeDescriptor } from "hkp-frontend/src/types";

/**
 * The browser runtime's asset store is the board's `assets`: nothing is pushed
 * to it, and a service resolves against the descriptors as they are when it
 * runs — so an edit is what the next pass carries.
 */

const runtime: RuntimeDescriptor = { id: "ui", name: "Browser", type: "browser" };

async function restoreWith(source: () => AssetDescriptor[], state: Record<string, unknown>) {
  const result = await BrowserRuntimeApi.restoreRuntime(
    runtime,
    [{ uuid: "a", serviceId: "asset", serviceName: "Asset", state } as never],
    null,
    "Board",
    source,
  );
  return result!.scope;
}

describe("the asset service in the browser", () => {
  it("emits the board's asset as it is now", async () => {
    let assets: AssetDescriptor[] = [{ id: "page", mediaType: "text/html", text: "v1" }];
    const scope = await restoreWith(() => assets, { asset: "hkp-asset://page" });

    expect(await BrowserRuntimeApi.processRuntime(scope, {}, null)).toEqual({
      meta: { status: 200, contentType: "text/html", asset: "page", size: 2 },
      body: "v1",
    });

    assets = [{ id: "page", mediaType: "text/html", text: "v2" }];
    expect((await BrowserRuntimeApi.processRuntime(scope, {}, null)) as any).toMatchObject({
      body: "v2",
    });
  });

  it("emits bytes for content that is not text", async () => {
    const scope = await restoreWith(
      () => [{ id: "logo", mediaType: "image/png", base64: "AQID" }],
      { asset: "hkp-asset://logo" },
    );
    const out = (await BrowserRuntimeApi.processRuntime(scope, {}, null)) as any;
    expect([...out.binary]).toEqual([1, 2, 3]);
  });

  it("answers an undeclared asset with an error rather than its reference", async () => {
    const scope = await restoreWith(() => [], { asset: "hkp-asset://missing" });
    const out = (await BrowserRuntimeApi.processRuntime(scope, {}, null)) as any;
    expect(out.meta.status).toBe(404);
    expect(out.body.error).toMatch(/not declared/);
  });

  it("answers content that does not decode with an error", async () => {
    const scope = await restoreWith(
      () => [{ id: "logo", mediaType: "image/png", base64: "not base64!" }],
      { asset: "hkp-asset://logo" },
    );

    const out = (await BrowserRuntimeApi.processRuntime(scope, {}, null)) as any;
    expect(out.meta.status).toBe(404);
    expect(out.body.error).toBe('asset "logo": its content is not base64');
  });

  it("is registered", () => {
    expect(new BrowserRegistry().allServices().some((svc) => svc.serviceId === "asset")).toBe(true);
  });
});
