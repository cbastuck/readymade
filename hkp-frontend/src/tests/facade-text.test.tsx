import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TextRenderer } from "../facade/panels/renderers/TextRenderer";
import { TextWidget } from "../facade/types";

/**
 * The widget that shows what a service is saying.
 *
 * Its reason for existing is the case where nothing else can help: a service
 * has failed, the reason is a sentence, and every other widget renders a shape
 * derived from a value rather than the value itself. So the behaviour that
 * matters most is showing something a service is *already* holding, without
 * waiting for it to say it again.
 */

let serviceState: Record<string, unknown> = {};
let handler: ((notification: unknown) => void) | null = null;

vi.mock("../facade/boardServices", async () => {
  const actual = await vi.importActual<any>("../facade/boardServices");
  return {
    ...actual,
    findService: () => ({
      uuid: "svc",
      state: serviceState,
      app: {
        registerNotificationTarget: (_s: unknown, fn: (n: unknown) => void) => {
          handler = fn;
        },
        unregisterNotificationTarget: () => {
          handler = null;
        },
      },
    }),
  };
});

function renderText(widget: Partial<TextWidget> = {}, state: Record<string, unknown> = {}) {
  serviceState = state;
  handler = null;
  return render(
    <TextRenderer
      widget={{
        type: "text",
        source: { serviceUuid: "svc", path: "error" },
        ...widget,
      }}
      boardContext={{ scopes: {}, services: {}, runtimes: [] } as any}
      panelContext={{ knobValues: {}, onKnobChange: () => {} }}
    />,
  );
}

describe("the text widget", () => {
  it("shows what the service already holds", async () => {
    // The reason a failure is worth showing at all: by the time somebody opens
    // the panel, the notification that carried it is long gone.
    renderText({}, { error: "no API key — set ANTHROPIC_API_KEY" });

    expect(
      await screen.findByText(/no API key — set ANTHROPIC_API_KEY/),
    ).toBeTruthy();
  });

  it("shows what a later notification says", async () => {
    renderText({}, {});

    handler?.({ error: "generation failed: no answer within 300s" });

    expect(await screen.findByText(/no answer within 300s/)).toBeTruthy();
  });

  it("says nothing rather than nothing at all", async () => {
    // An empty panel reads as broken; a placeholder reads as idle.
    renderText({ placeholder: "No errors" }, {});

    expect(await screen.findByText("No errors")).toBeTruthy();
  });

  it("drops the placeholder once there is something to say", async () => {
    renderText({ placeholder: "No errors" }, {});
    expect(await screen.findByText("No errors")).toBeTruthy();

    handler?.({ error: "it broke" });

    expect(await screen.findByText("it broke")).toBeTruthy();
    expect(screen.queryByText("No errors")).toBeNull();
  });

  it("renders a value that is not a string", async () => {
    // A path can land on a count or an object, and a widget that showed
    // "[object Object]" would be worse than one that showed the JSON.
    renderText({ source: { serviceUuid: "svc", path: "usage" } }, {
      usage: { promptTokens: 12 },
    });

    expect(await screen.findByText(/promptTokens/)).toBeTruthy();
  });
});
