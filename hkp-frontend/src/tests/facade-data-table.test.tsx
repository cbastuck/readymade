import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataTableRenderer } from "../facade/panels/renderers/DataTableRenderer";
import { FacadeStateContext } from "../facade/FacadeStateContext";
import { DataTableWidget } from "../facade/types";

/**
 * How a table decides what it is showing, and how a picked row reaches the rest
 * of the panel.
 *
 * The append-or-replace rule is the part worth pinning down: it is inferred
 * from the notification rather than declared, so a board that has always
 * appended must go on appending, and a service reporting a queue must not have
 * its queue appended to itself on every read.
 */

/** Stands in for the service a table listens to. */
function serviceStub() {
  let handler: ((notification: unknown) => void) | null = null;
  const service = {
    app: {
      registerNotificationTarget: (_svc: unknown, fn: (n: unknown) => void) => {
        handler = fn;
      },
      unregisterNotificationTarget: () => {
        handler = null;
      },
    },
  };
  return {
    service,
    notify: (payload: unknown) => handler?.(payload),
  };
}

function renderTable(widget: Partial<DataTableWidget> = {}) {
  const { service, notify } = serviceStub();
  const setState = vi.fn();

  const full: DataTableWidget = {
    type: "data-table",
    source: { serviceUuid: "svc", path: "records" },
    ...widget,
  };

  const view = render(
    <FacadeStateContext.Provider value={{ state: {}, setState }}>
      <DataTableRenderer
        widget={full}
        boardContext={{ scopes: [], services: [service] } as any}
        panelContext={{ knobValues: {}, onKnobChange: () => {} }}
      />
    </FacadeStateContext.Provider>,
  );
  return { ...view, notify, setState };
}

// findService looks a service up in the board; here the stub is the only one.
vi.mock("hkp-frontend/src/facade/boardServices", async () => {
  const actual = await vi.importActual<any>(
    "hkp-frontend/src/facade/boardServices",
  );
  return {
    ...actual,
    findService: (boardContext: any) => boardContext.services[0],
  };
});

describe("data-table rows", () => {
  it("appends when a notification carries one row", async () => {
    // What a log does, and what every table did before arrays were understood.
    const { notify } = renderTable({ source: { serviceUuid: "svc" } });

    notify({ event: "first" });
    notify({ event: "second" });

    expect(await screen.findByText("first")).toBeTruthy();
    expect(screen.getByText("second")).toBeTruthy();
  });

  it("replaces when a notification carries the whole table", async () => {
    // A queue read twice must not show every item twice.
    const { notify } = renderTable();

    notify({ records: [{ key: "a" }, { key: "b" }] });
    notify({ records: [{ key: "b" }] });

    expect(await screen.findByText("b")).toBeTruthy();
    expect(screen.queryByText("a")).toBeNull();
  });

  it("takes its columns from the table that replaced the last one", async () => {
    // One table widget showing whichever table was asked for last.
    const { notify } = renderTable({ source: { serviceUuid: "svc" } });

    notify([{ member: "anna", court: 1 }]);
    expect(await screen.findByText("member")).toBeTruthy();

    notify([{ what: "booked anna" }]);
    expect(await screen.findByText("what")).toBeTruthy();
    expect(screen.queryByText("member")).toBeNull();
    expect(screen.queryByText("court")).toBeNull();

    // An empty table says nothing about columns, so the last ones stay.
    notify([]);
    expect(screen.getByText("what")).toBeTruthy();
  });

  it("runs its cell actions with the cell clicked as the item", async () => {
    const { notify, setState, container } = renderTable({
      source: { serviceUuid: "svc" },
      cellActions: [
        {
          type: "set-state",
          key: "picked",
          value: "{{item.row.id}}/{{item.column}}={{item.value}}",
        },
      ],
    });
    notify([
      { id: 1, member: "anna" },
      { id: 2, member: "ben" },
    ]);

    fireEvent.click(await screen.findByRole("button", { name: "ben" }));
    await waitFor(() =>
      expect(setState).toHaveBeenCalledWith("picked", "2/member=ben"),
    );
    // Only the rows there are: the padding below them is not a control.
    expect(container.querySelectorAll('td [role="button"]')).toHaveLength(4);
  });

  it("leaves its cells plain without cell actions", async () => {
    const { notify } = renderTable({ source: { serviceUuid: "svc" } });
    notify([{ id: 1, member: "anna" }]);
    expect(await screen.findByText("anna")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "anna" })).toBeNull();
  });

  it("still gathers columns from rows appended one at a time", async () => {
    const { notify } = renderTable({ source: { serviceUuid: "svc" } });

    notify({ event: "first" });
    notify({ event: "second", extra: "x" });

    expect(await screen.findByText("extra")).toBeTruthy();
    expect(screen.getByText("event")).toBeTruthy();
  });
});

describe("data-table selection", () => {
  it("publishes what was picked so a button can act on it", async () => {
    const { notify, setState } = renderTable({
      selectable: true,
      selectionState: "approved",
    });

    notify({ records: [{ key: "a" }, { key: "b" }] });
    // The header's box renders before any row does, so waiting on "a checkbox
    // exists" would find it and stop.
    await screen.findByText("a");
    const boxes = screen.getAllByRole("checkbox");
    // The first is the header's select-all.
    fireEvent.click(boxes[1]);

    expect(setState).toHaveBeenCalledWith("approved", ["a"]);
  });

  it("picks only what is on the page in view", async () => {
    // A header box that silently picked rows on other pages would approve
    // things nobody looked at.
    const { notify, setState } = renderTable({
      selectable: true,
      pageSize: 2,
      selectionState: "approved",
    });

    notify({ records: [{ key: "a" }, { key: "b" }, { key: "c" }] });
    await screen.findByText("a");
    const boxes = screen.getAllByRole("checkbox");
    fireEvent.click(boxes[0]);

    const last = setState.mock.calls.at(-1);
    expect(last?.[1]).toHaveLength(2);
    expect(last?.[1]).not.toContain("c");
  });

  it("drops a row that is no longer there from the selection", async () => {
    // It was acted on — by this person, or by somebody else on the same queue.
    const { notify, setState } = renderTable({
      selectable: true,
      selectionState: "approved",
    });

    notify({ records: [{ key: "a" }, { key: "b" }] });
    await screen.findByText("a");
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    expect(setState).toHaveBeenCalledWith("approved", ["a"]);

    notify({ records: [{ key: "b" }] });

    await waitFor(() => {
      expect(setState.mock.calls.at(-1)?.[1]).toEqual([]);
    });
  });

  it("leaves the padding rows unpickable", async () => {
    // They keep the table height steady and stand for nothing.
    const { notify } = renderTable({ selectable: true, pageSize: 5 });

    notify({ records: [{ key: "a" }] });
    await screen.findByText("a");

    // Header, plus the one real row.
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  });

  it("reads a column that names a field inside the row", async () => {
    // What the shared Map dialect cannot do for it: reshaping rows in an
    // expression would need an arrow function, and jsep has none.
    const { notify } = renderTable({
      columns: ["key", "value.subject"],
    });

    notify({ records: [{ key: "a", value: { subject: "Anfrage" } }] });

    expect(await screen.findByText("Anfrage")).toBeTruthy();
    // The header is the last segment, not the whole path.
    expect(screen.getByText("subject")).toBeTruthy();
    expect(screen.queryByText("value.subject")).toBeNull();
  });

  it("picks by a key that sits inside the row", async () => {
    const { notify, setState } = renderTable({
      selectable: true,
      rowKey: "value.id",
      columns: ["value.id"],
      selectionState: "approved",
    });

    notify({ records: [{ value: { id: "msg-1" } }] });
    await screen.findByText("msg-1");
    fireEvent.click(screen.getAllByRole("checkbox")[1]);

    expect(setState).toHaveBeenCalledWith("approved", ["msg-1"]);
  });

  it("shows no checkboxes at all unless asked", async () => {
    const { notify } = renderTable();

    notify({ records: [{ key: "a" }] });
    await screen.findByText("a");

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });
});
