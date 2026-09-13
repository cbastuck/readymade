import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import { GenericPanel } from "../facade/panels/GenericPanel";
import { FacadeStateContext } from "../facade/FacadeStateContext";
import { FacadeDescriptor } from "../facade/types";

/**
 * The HTTP Client demo board's request panel.
 *
 * What the facade is standing in for is a request composer: the verb you press
 * is the method, so each button has to configure the service *and then* ask it
 * to do its job — pressing POST after GET must not send a GET. The body is the
 * one field that cannot be configuration: it travels as the process payload,
 * read out of the facade state the body editor published.
 */

const configured: unknown[] = [];
const processed: unknown[] = [];

vi.mock("../facade/boardServices", () => ({
  findService: (_ctx: unknown, uuid: string) => ({
    uuid,
    state: {},
    configure: async (config: unknown) => {
      configured.push(config);
    },
  }),
  processService: (_ctx: unknown, uuid: string, payload: unknown) => {
    processed.push({ uuid, payload });
  },
}));

const board = JSON.parse(
  readFileSync("boards/http-client-demo-board.json", "utf-8"),
) as { facade: FacadeDescriptor };

function renderRequestPanel(state: Record<string, unknown>) {
  configured.length = 0;
  processed.length = 0;
  const panel = board.facade.panels.find((p) => p.id === "request");
  expect(panel).toBeDefined();
  return render(
    <FacadeStateContext.Provider value={{ state, setState: () => {} }}>
      <GenericPanel
        panel={panel!}
        boardContext={{ scopes: {}, services: {}, runtimes: [] } as any}
        showTitle
      />
    </FacadeStateContext.Provider>,
  );
}

describe("the HTTP Client demo board", () => {
  it("sends the body the editor published, under the verb that was pressed", async () => {
    renderRequestPanel({ body: { hello: "board" } });

    fireEvent.click(screen.getByText("POST"));

    await waitFor(() => expect(processed).toHaveLength(1));
    expect(configured).toEqual([{ method: "post" }]);
    expect(processed).toEqual([
      { uuid: "request", payload: { hello: "board" } },
    ]);
  });

  it("sends no body with a verb that has none", async () => {
    renderRequestPanel({ body: { hello: "board" } });

    fireEvent.click(screen.getByText("GET"));

    await waitFor(() => expect(processed).toHaveLength(1));
    expect(configured).toEqual([{ method: "get" }]);
    expect(processed).toEqual([{ uuid: "request", payload: {} }]);
  });

  it("offers every method the service accepts", () => {
    renderRequestPanel({});

    for (const verb of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
      expect(screen.getByText(verb)).toBeTruthy();
    }
  });

  it("reads the response off the Monitor behind the request", () => {
    // The request service reports the outcome of a call; the body exists only as
    // what travelled on down the pipeline, which is what the Monitor holds.
    const response = board.facade.panels.find((p) => p.id === "response");
    const widgets = JSON.stringify(response);

    expect(widgets).toContain('"serviceUuid":"response"');
    expect(widgets).toContain('"path":"body"');
    // Indented, or a JSON body arrives as one unreadable line.
    expect(widgets).toContain('"pretty":true');
  });
});
