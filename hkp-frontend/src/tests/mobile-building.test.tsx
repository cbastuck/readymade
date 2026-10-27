import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RunSheet from "../views/playground/mobile/RunSheet";
import AddServiceSheet from "../views/playground/mobile/AddServiceSheet";
import ServiceSheet from "../views/playground/mobile/ServiceSheet";
import MobileBoardCanvas from "../views/playground/mobile/MobileBoardCanvas";
import {
  RuntimeDescriptor,
  ServiceClassWithPreset,
  ServiceDescriptor,
} from "../types";

// What the sheets read of the board; the real provider brings a whole board
// engine with it. Replaced per test.
let boardContext: any = { boardName: "Mobile Board" };

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

const timer: ServiceDescriptor = {
  uuid: "svc-1",
  serviceId: "hookup.to/service/timer",
  serviceName: "Timer",
  state: {},
} as ServiceDescriptor;

const subService: ServiceDescriptor = {
  uuid: "svc-2",
  serviceId: "hookup.to/service/sub-service",
  serviceName: "Pipeline",
  capabilities: ["subservices"],
  state: { pipeline: [] },
} as ServiceDescriptor;

function board(overrides: Record<string, unknown> = {}) {
  const processService = vi.fn(async () => null);
  return {
    boardName: "Mobile Board",
    runtimes: [runtime],
    services: { rt: [timer, subService] },
    scopes: { rt: { id: "rt" } },
    registry: { rt: [] },
    runtimeApis: { browser: { processService, processRuntime: vi.fn() } },
    markBoardChanged: vi.fn(),
    makeBlock: vi.fn(async () => ({ id: "pipeline", name: "Pipeline" })),
    wrapServices: vi.fn(async () => ({ wrapper: "w", block: { name: "Timer" } })),
    editBlock: vi.fn(),
    detachBlockUse: vi.fn(),
    applyBlockEdit: vi.fn(async () => {}),
    cancelBlockEdit: vi.fn(async () => {}),
    ...overrides,
  };
}

function openSheet(service: ServiceDescriptor) {
  render(
    <ServiceSheet
      open
      onClose={() => {}}
      service={service}
      runtime={runtime}
      onRemove={() => {}}
      onRename={() => {}}
    />,
  );
}

describe("mobile run sheet", () => {
  beforeEach(() => {
    localStorage.clear();
    boardContext = { boardName: "Mobile Board" };
  });

  it("sends what the fields say, as one object", () => {
    const onRun = vi.fn();
    render(<RunSheet open onClose={() => {}} onRun={onRun} target="this service" />);

    fireEvent.change(screen.getByLabelText("Name 1"), { target: { value: "city" } });
    fireEvent.change(screen.getByLabelText("Value 1"), { target: { value: "Berlin" } });
    fireEvent.click(screen.getByText("Run"));

    expect(onRun).toHaveBeenCalledWith({ city: "Berlin" });
  });

  it("parses what is written as JSON the way people type it", () => {
    const onRun = vi.fn();
    render(<RunSheet open onClose={() => {}} onRun={onRun} target="this service" />);

    fireEvent.click(screen.getByRole("radio", { name: "JSON" }));
    fireEvent.change(screen.getByLabelText("Run input as JSON"), {
      target: { value: "[{name: 'a'}]" },
    });
    fireEvent.click(screen.getByText("Run"));

    expect(onRun).toHaveBeenCalledWith([{ name: "a" }]);
  });

  it("keeps a payload for the board, to be loaded again", () => {
    const onRun = vi.fn();
    render(<RunSheet open onClose={() => {}} onRun={onRun} target="this service" />);

    fireEvent.click(screen.getByRole("radio", { name: "Text" }));
    fireEvent.change(screen.getByLabelText("Run input as text"), {
      target: { value: "hello" },
    });
    fireEvent.click(screen.getByText("Save"));
    fireEvent.change(screen.getByLabelText("Payload name"), {
      target: { value: "greeting" },
    });
    fireEvent.keyDown(screen.getByLabelText("Payload name"), { key: "Enter" });

    // The same store the desktop's dialog keeps them in.
    expect(
      JSON.parse(localStorage.getItem("hkp-run-payloads-Mobile Board")!),
    ).toEqual([{ name: "greeting", mode: "text", text: "hello" }]);

    fireEvent.change(screen.getByLabelText("Run input as text"), {
      target: { value: "changed" },
    });
    fireEvent.click(screen.getByText("greeting"));
    fireEvent.click(screen.getByText("Run"));
    expect(onRun).toHaveBeenCalledWith("hello");
  });
});

describe("mobile add-service sheet", () => {
  const entries: ServiceClassWithPreset[] = [
    { serviceId: "sub-service", serviceName: "Echo block", block: { id: "echo" } },
    { serviceId: "timer", serviceName: "Timer" },
    {
      serviceId: "sub-service",
      serviceName: "Kept pipeline",
      preset: { id: "kept", serviceId: "sub-service" },
    },
  ];

  function renderSheet(onAdd = vi.fn()) {
    render(
      <AddServiceSheet
        open
        onClose={() => {}}
        runtime={runtime}
        registry={entries}
        onAdd={onAdd}
      />,
    );
    return onAdd;
  }

  it("shows services first, and building blocks behind the switcher", () => {
    const onAdd = renderSheet();

    expect(screen.getByText("Timer")).toBeTruthy();
    expect(screen.queryByText("Echo block")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: /Building Blocks/ }));
    expect(screen.queryByText("Timer")).toBeNull();
    // Blocks and presets both live there, so each has its heading.
    expect(screen.getByText("Blocks")).toBeTruthy();
    expect(screen.getByText("Presets")).toBeTruthy();

    fireEvent.click(screen.getByText("Echo block"));
    expect(onAdd).toHaveBeenCalledWith(entries[0]);
  });

  it("points a search at the other tab when that is where it matches", () => {
    renderSheet();

    fireEvent.change(screen.getByPlaceholderText("Search services…"), {
      target: { value: "echo" },
    });
    expect(screen.getByText("No services match “echo”.")).toBeTruthy();
    fireEvent.click(screen.getByText("Show 1 in Building Blocks"));
    expect(screen.getByText("Echo block")).toBeTruthy();
  });

  it("shows a list of services alone without a switcher", () => {
    render(
      <AddServiceSheet
        open
        onClose={() => {}}
        runtime={runtime}
        registry={[{ serviceId: "timer", serviceName: "Timer" }]}
        onAdd={() => {}}
      />,
    );
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByText("Services")).toBeNull();
  });
});

describe("mobile service sheet", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("runs the pipeline from the service it was opened on", () => {
    boardContext = board();
    openSheet(timer);

    fireEvent.click(screen.getByText("Run"));

    expect(boardContext.runtimeApis.browser.processService).toHaveBeenCalledWith(
      boardContext.scopes.rt,
      timer,
      undefined,
      null,
    );
  });

  it("makes a block of a configured sub-service where it is", async () => {
    boardContext = board();
    openSheet(subService);

    fireEvent.click(screen.getByText("Make block"));

    await waitFor(() =>
      expect(boardContext.makeBlock).toHaveBeenCalledWith("svc-2", "rt"),
    );
  });

  it("offers no block of one ordinary service: a preset keeps that", () => {
    boardContext = board();
    openSheet(timer);
    expect(screen.queryByText("Make block")).toBeNull();
    expect(screen.getByText("Presets")).toBeTruthy();
  });

  it("offers a use of a block the edits a use takes, and nothing that changes its inside", () => {
    const use = {
      key: "use-1",
      runtimeId: "rt",
      path: ["rt", { id: "svc-2" }],
      address: "svc-2",
      id: "svc-2",
      use: { block: "pipeline" },
      document: "",
    };
    boardContext = board({
      linkage: {
        units: [],
        views: [],
        blocks: {
          definitions: { "": [{ id: "pipeline", name: "Pipeline", serviceId: "sub-service", state: {} }] },
          placed: [use],
        },
      },
    });
    openSheet(subService);

    expect(screen.queryByText("Make block")).toBeNull();
    expect(screen.queryByText("Presets")).toBeNull();

    fireEvent.click(screen.getByText("Edit block"));
    expect(boardContext.editBlock).toHaveBeenCalledWith("use-1");
    fireEvent.click(screen.getByText("Detach from block"));
    expect(boardContext.detachBlockUse).toHaveBeenCalledWith("use-1");
  });

  it("applies the working copy of a block being edited", async () => {
    const use = {
      key: "use-1",
      runtimeId: "rt",
      path: ["rt", { id: "svc-2" }],
      address: "svc-2",
      id: "svc-2",
      use: { block: "pipeline" },
      document: "",
    };
    boardContext = board({
      linkage: {
        units: [],
        views: [],
        blocks: {
          definitions: { "": [{ id: "pipeline", name: "Pipeline", serviceId: "sub-service", state: {} }] },
          placed: [use],
          editing: "use-1",
        },
      },
    });
    openSheet(subService);

    expect(screen.queryByText("Edit block")).toBeNull();
    expect(screen.queryByText("Detach from block")).toBeNull();
    fireEvent.click(screen.getByText("Apply to block"));
    await waitFor(() => expect(boardContext.applyBlockEdit).toHaveBeenCalled());
  });

  it("changes nothing a deployed board is made of", () => {
    boardContext = board();
    render(
      <ServiceSheet
        open
        onClose={() => {}}
        service={subService}
        runtime={runtime}
        onRemove={() => {}}
        onRename={() => {}}
        structural={false}
      />,
    );
    expect(screen.getByText("Run")).toBeTruthy();
    expect(screen.queryByText("Make block")).toBeNull();
  });
});

describe("mobile runtime card", () => {
  const third = {
    uuid: "svc-3",
    serviceId: "hookup.to/service/monitor",
    serviceName: "Monitor",
  } as ServiceDescriptor;

  function canvas(overrides: Record<string, unknown> = {}) {
    boardContext = board({
      services: { rt: [timer, subService, third] },
      availableRuntimeEngines: [],
      removeAllServices: vi.fn(),
      ...overrides,
    });
    render(<MobileBoardCanvas />);
    fireEvent.click(screen.getByTitle("More options"));
  }

  it("runs the runtime from the top", () => {
    canvas();
    fireEvent.click(screen.getByText("Run"));
    expect(boardContext.runtimeApis.browser.processRuntime).toHaveBeenCalledWith(
      boardContext.scopes.rt,
      undefined,
      null,
    );
  });

  it("clears the runtime only once asked twice", () => {
    canvas();
    fireEvent.click(screen.getByText("Clear services"));
    expect(boardContext.removeAllServices).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Tap again to clear"));
    expect(boardContext.removeAllServices).toHaveBeenCalledWith(runtime);
  });

  it("wraps the services picked, and only ones next to each other", async () => {
    canvas();
    fireEvent.click(screen.getByText("Select services"));

    fireEvent.click(screen.getByRole("checkbox", { name: /Timer/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Monitor/ }));
    expect(
      screen.getByText("Only services next to each other can be wrapped"),
    ).toBeTruthy();
    expect((screen.getByText("Wrap").closest("button") as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("checkbox", { name: /Pipeline/ }));
    expect(screen.getByText("3 services selected")).toBeTruthy();
    fireEvent.click(screen.getByText("Wrap"));

    await waitFor(() =>
      expect(boardContext.wrapServices).toHaveBeenCalledWith("rt", [
        "svc-1",
        "svc-2",
        "svc-3",
      ]),
    );
  });

  it("makes a block of every service in the runtime, once named", async () => {
    canvas();
    fireEvent.click(screen.getByText("Make block"));
    fireEvent.change(screen.getByLabelText("Block name"), {
      target: { value: "Everything" },
    });
    fireEvent.click(screen.getAllByText("Make block").at(-1)!);

    await waitFor(() =>
      expect(boardContext.wrapServices).toHaveBeenCalledWith(
        "rt",
        ["svc-1", "svc-2", "svc-3"],
        { asBlock: true, name: "Everything" },
      ),
    );
  });

  it("makes a runtime's one sub-service a block where it is", async () => {
    canvas({ services: { rt: [subService] } });
    fireEvent.click(screen.getByText("Make block"));
    await waitFor(() =>
      expect(boardContext.makeBlock).toHaveBeenCalledWith("svc-2", "rt"),
    );
    expect(boardContext.wrapServices).not.toHaveBeenCalled();
  });

  it("offers nothing that rebuilds a deployed board", () => {
    boardContext = board({ availableRuntimeEngines: [] });
    render(<MobileBoardCanvas bridge={{ ws: null }} />);
    fireEvent.click(screen.getByTitle("More options"));
    expect(screen.getByText("Run")).toBeTruthy();
    expect(screen.queryByText("Select services")).toBeNull();
    expect(screen.queryByText("Make block")).toBeNull();
    expect(screen.queryByText("Clear services")).toBeNull();
  });
});
