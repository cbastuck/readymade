import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MobileBoardCanvas from "../views/playground/mobile/MobileBoardCanvas";
import { BoardFlow } from "../views/playground/mobile/boardFlow";
import {
  CaptureButton,
  useCaptureControl,
} from "../views/playground/mobile/capture";
import NotificationTargets from "../runtime/NotificationsTargets";
import { isCapturing, setCapturing } from "../runtime/captureMode";
import { RuntimeDescriptor, ServiceDescriptor } from "../types";

/**
 * Observing a board on a phone: what each service is doing, on its card, and
 * what it received and passed on, in its sheet — kept for the whole board from
 * the moment it is shown, since a phone opens a service only when asked.
 */

let boardContext: any = null;

vi.mock("../BoardContext", () => ({
  useBoardContext: () => boardContext,
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    message: vi.fn(),
  }),
}));

const runtime: RuntimeDescriptor = {
  id: "rt",
  name: "Browser",
  type: "browser",
} as RuntimeDescriptor;

const timer = {
  uuid: "svc-1",
  serviceId: "hookup.to/service/timer",
  serviceName: "Timer",
  state: {},
} as ServiceDescriptor;

const monitor = {
  uuid: "svc-3",
  serviceId: "hookup.to/service/monitor",
  serviceName: "Monitor",
  state: {},
} as ServiceDescriptor;

/** A runtime's app as panels see it: where notifications are registered. */
function fakeApp() {
  const targets = new NotificationTargets();
  return {
    registerNotificationTarget: (svc: any, cb: any) => targets.register(svc, cb),
    unregisterNotificationTarget: (svc: any, cb: any) => targets.unregister(svc, cb),
    next: vi.fn(),
    rerun: vi.fn(),
    /** What the runtime says about one of its services. */
    report: (uuid: string, internal: Record<string, unknown>) =>
      targets.notify({ uuid }, { __internal: internal }),
    listening: (uuid: string) => targets.hasCallbacks({ uuid }),
  };
}

function board(app: ReturnType<typeof fakeApp>, services = [timer, monitor]) {
  return {
    boardName: "Observed",
    runtimes: [runtime],
    services: { rt: services },
    scopes: { rt: { id: "rt", getApp: () => app } },
    registry: { rt: [] },
    runtimeApis: { browser: { processRuntime: vi.fn() } },
    availableRuntimeEngines: [],
    markBoardChanged: vi.fn(),
  };
}

/** One run of a service: given `input`, passing on `output`. */
function run(
  app: ReturnType<typeof fakeApp>,
  uuid: string,
  call: number,
  input: unknown,
  output: unknown,
) {
  act(() => {
    app.report(uuid, { state: "call-process", call, data: input });
    app.report(uuid, { state: "call-process-finished", call, data: output });
  });
}

afterEach(() => {
  setCapturing(false);
});

/** A service's card on the board list. */
const cardOf = (name: string) =>
  screen.getByText(name).closest("[data-service-card]") as HTMLElement;

/** Taps a card's row, which expands it, then opens the service's sheet. */
function openSheetOf(name: string) {
  fireEvent.click(screen.getByText(name));
  fireEvent.click(within(cardOf(name)).getByRole("button", { name: "More" }));
}

describe("the board's flow", () => {
  it("keeps what every service received and passed on", () => {
    const app = fakeApp();
    const flow = new BoardFlow();
    const { runtimes, services, scopes } = board(app);
    flow.attach(runtimes, services, scopes as any);

    // Nothing is open: listening is what makes a runtime report at all.
    expect(app.listening("svc-1")).toBe(true);
    expect(app.listening("svc-3")).toBe(true);

    run(app, "svc-1", 1, { tick: 1 }, { tick: 1, at: "now" });
    run(app, "svc-1", 2, { tick: 2 }, null);

    const { input, output } = flow.flowOf("rt", "svc-1");
    expect(input.map((r) => r.data)).toEqual([{ tick: 2 }, { tick: 1 }]);
    // A call that passed nothing on leaves no output to inspect.
    expect(output.map((r) => r.data)).toEqual([{ tick: 1, at: "now" }]);
    expect(flow.flowOf("rt", "svc-3")).toEqual({ input: [], output: [] });
  });

  it("keeps a service's history across a change of the board, and forgets one that went", () => {
    const app = fakeApp();
    const flow = new BoardFlow();
    const { runtimes, services, scopes } = board(app);
    flow.attach(runtimes, services, scopes as any);
    run(app, "svc-1", 1, "a", "b");
    run(app, "svc-3", 1, "c", "d");

    flow.attach(runtimes, { rt: [timer] }, scopes as any);

    expect(flow.flowOf("rt", "svc-1").output[0].data).toBe("b");
    expect(flow.flowOf("rt", "svc-3").output).toEqual([]);
    expect(app.listening("svc-3")).toBe(false);
  });

  it("forgets one side when cleared, and stops listening when detached", () => {
    const app = fakeApp();
    const flow = new BoardFlow();
    const { runtimes, services, scopes } = board(app);
    const detach = flow.attach(runtimes, services, scopes as any);
    run(app, "svc-1", 1, "a", "b");

    flow.clear("rt", "svc-1", "output");
    expect(flow.flowOf("rt", "svc-1")).toMatchObject({ output: [] });
    expect(flow.flowOf("rt", "svc-1").input).toHaveLength(1);

    detach();
    expect(app.listening("svc-1")).toBe(false);
  });
});

describe("activity on the board list", () => {
  it("shows a service running on its card, for as long as it runs", () => {
    const app = fakeApp();
    boardContext = board(app);
    render(<MobileBoardCanvas />);
    const card = () => cardOf("Timer");

    expect(card().hasAttribute("data-running")).toBe(false);
    act(() => app.report("svc-1", { state: "call-process", call: 7 }));
    expect(card().hasAttribute("data-running")).toBe(true);
    // Only the service that runs.
    expect(cardOf("Monitor").hasAttribute("data-running")).toBe(false);
    act(() =>
      app.report("svc-1", { state: "call-process-finished", call: 7, stopped: true }),
    );
    expect(card().hasAttribute("data-running")).toBe(false);
  });
});

describe("the flow in a service's sheet", () => {
  let app: ReturnType<typeof fakeApp>;

  beforeEach(() => {
    app = fakeApp();
    boardContext = board(app);
  });

  function openFlow(element = <MobileBoardCanvas />) {
    render(element);
    openSheetOf("Timer");
    fireEvent.click(screen.getByText("Flow"));
  }

  it("shows what happened before the sheet was opened, and carries an output on", () => {
    setCapturing(true);
    render(<MobileBoardCanvas />);
    run(app, "svc-1", 1, { n: 1 }, { n: 2 });

    openSheetOf("Timer");
    // The row says what the service did last before it is opened.
    expect(screen.getByText(/^Out \d\d:\d\d:\d\d\.\d{3} · \{"n":2\}$/)).toBeTruthy();
    fireEvent.click(screen.getByText("Flow"));

    expect(screen.queryByRole("note")).toBeNull();
    const value = screen.getByLabelText("Output value") as HTMLTextAreaElement;
    expect(JSON.parse(value.value)).toEqual({ n: 2 });

    fireEvent.click(screen.getByText("Inject"));
    expect(app.next).toHaveBeenCalledWith({ uuid: "svc-1" }, { n: 2 }, { replay: true });
  });

  it("runs the service again with an input, as edited", () => {
    setCapturing(true);
    render(<MobileBoardCanvas />);
    run(app, "svc-1", 1, { n: 1 }, { n: 2 });
    openSheetOf("Timer");
    fireEvent.click(screen.getByText("Flow"));

    fireEvent.click(screen.getByRole("button", { name: /^Input/ }));
    fireEvent.change(screen.getByLabelText("Input value"), {
      target: { value: '{"n": 5}' },
    });
    expect(screen.getByText("Edited · Revert")).toBeTruthy();
    fireEvent.click(screen.getByText("Rerun"));

    expect(app.rerun).toHaveBeenCalledWith({ uuid: "svc-1" }, { n: 5 });
  });

  it("asks to turn Capture mode on when it is off, and turns it on here", () => {
    openFlow();

    expect(screen.getByRole("note").textContent).toContain(
      "Capture mode is off, so the inspector shows that this service ran",
    );
    expect(screen.getByText("Nothing produced yet.")).toBeTruthy();
    fireEvent.click(screen.getByText("Turn on Capture mode"));

    expect(isCapturing()).toBe(true);
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("asks a deployed board's coordinator rather than this window", () => {
    const set = vi.fn();
    openFlow(<MobileBoardCanvas bridge={{ ws: null }} capture={{ on: false, set }} />);

    fireEvent.click(screen.getByText("Turn on Capture mode"));

    expect(set).toHaveBeenCalledWith(true);
    expect(isCapturing()).toBe(false);
  });
});

describe("an expanded service card", () => {
  let app: ReturnType<typeof fakeApp>;

  beforeEach(() => {
    app = fakeApp();
    boardContext = board(app);
  });

  it("shows what the service passed on last, as it happens, while Capture mode is on", () => {
    setCapturing(true);
    render(<MobileBoardCanvas />);
    run(app, "svc-1", 1, { n: 1 }, { n: 2 });

    fireEvent.click(screen.getByText("Timer"));
    expect(
      screen.getByText("Timer").closest("button")!.getAttribute("aria-expanded"),
    ).toBe("true");
    expect(JSON.parse(screen.getByLabelText("Latest output").textContent!)).toEqual({ n: 2 });

    // Kept current without touching anything.
    run(app, "svc-1", 2, { n: 2 }, { n: 3 });
    expect(JSON.parse(screen.getByLabelText("Latest output").textContent!)).toEqual({ n: 3 });

    // Another service is not expanded with it.
    expect(within(cardOf("Monitor")).queryByText("Inspect")).toBeNull();
  });

  it("offers to turn Capture mode on instead, when it is off", () => {
    render(<MobileBoardCanvas />);
    fireEvent.click(screen.getByText("Timer"));

    expect(screen.queryByLabelText("Latest output")).toBeNull();
    fireEvent.click(within(cardOf("Timer")).getByText("Turn on"));
    expect(isCapturing()).toBe(true);
    expect(within(cardOf("Timer")).getByText("Nothing produced yet.")).toBeTruthy();
  });

  it("opens the flow inspector on its own, and the service's sheet", () => {
    setCapturing(true);
    render(<MobileBoardCanvas />);
    run(app, "svc-1", 1, { n: 1 }, { n: 2 });
    fireEvent.click(screen.getByText("Timer"));

    fireEvent.click(within(cardOf("Timer")).getByText("Inspect"));
    expect(screen.getByText("Flow · Timer")).toBeTruthy();
    fireEvent.click(screen.getByText("Inject"));
    expect(app.next).toHaveBeenCalledWith({ uuid: "svc-1" }, { n: 2 }, { replay: true });

    fireEvent.click(within(cardOf("Timer")).getByRole("button", { name: "More" }));
    // The service's own sheet, with its actions.
    expect(screen.getByText("Run with…")).toBeTruthy();
  });

  it("unfolds the service's own panel below, and folds it away again", () => {
    const panel = {
      uuid: "svc-9",
      serviceId: "test/panel",
      serviceName: "Meter",
      state: {},
    } as ServiceDescriptor;
    const instance = { uuid: "svc-9", app } as any;
    const PanelUI = ({ service }: { service: { uuid: string } }) => (
      <div>Panel of {service.uuid}</div>
    );
    boardContext = board(app, [panel]);
    boardContext.scopes.rt = {
      ...boardContext.scopes.rt,
      findServiceInstance: (uuid: string) =>
        uuid === "svc-9" ? [instance, 0] : [null, -1],
      registry: { findServiceModule: () => ({ createUI: PanelUI }) },
    };
    render(<MobileBoardCanvas />);
    fireEvent.click(screen.getByText("Meter"));

    const toggle = within(cardOf("Meter")).getByText("UI").closest("button")!;
    expect(screen.queryByText("Panel of svc-9")).toBeNull();
    fireEvent.click(toggle);
    expect(within(cardOf("Meter")).getByText("Panel of svc-9")).toBeTruthy();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(toggle);
    expect(screen.queryByText("Panel of svc-9")).toBeNull();
  });
});

describe("the Capture mode switch", () => {
  function Switch() {
    return <CaptureButton control={useCaptureControl()} />;
  }

  it("switches this window's Capture mode, and shows it", () => {
    render(<Switch />);
    const button = screen.getByRole("button", { name: "Capture mode" });
    expect(button.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(button);
    expect(isCapturing()).toBe(true);
    expect(button.getAttribute("aria-pressed")).toBe("true");

    // Turned off elsewhere — a board being opened — it says so too.
    act(() => setCapturing(false));
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });
});
