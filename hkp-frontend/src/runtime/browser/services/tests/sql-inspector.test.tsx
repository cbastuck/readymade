import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import SqlInspector, { cellText } from "../SqlInspector";

/**
 * The inspector dialog over a service that answers from fixed tables: what is
 * listed, what is shown, and that it looks again when the service reports.
 */

function service() {
  const tables = [
    { name: "fold", type: "table", rows: 2, sql: "CREATE TABLE fold (story, comment)", use: "writes" },
    { name: "story_fold", type: "table", rows: 0, sql: "CREATE TABLE story_fold (story)", use: null },
  ];
  const pages: Record<string, any> = {
    fold: { columns: ["story", "comment"], rows: [[1, 10], [1, null]], total: 2 },
    story_fold: { columns: ["story"], rows: [], total: 0 },
  };
  return {
    inspectTables: vi.fn(async () => ({ database: "hacker-news", tables })),
    inspectRows: vi.fn(async (table: string) => pages[table]),
  };
}

describe("the SQL inspector", () => {
  it("lists the database's tables and shows the first one's rows", async () => {
    const svc = service();
    render(<SqlInspector service={svc as any} isOpen revision={0} onClose={vi.fn()} />);

    expect(await screen.findByText("hacker-news")).toBeTruthy();
    expect(screen.getByRole("button", { name: /story_fold/ })).toBeTruthy();
    expect(screen.getAllByText("written here").length).toBeGreaterThan(0);
    expect(await screen.findByRole("columnheader", { name: "comment" })).toBeTruthy();
    expect(screen.getByRole("cell", { name: "10" })).toBeTruthy();
    expect(screen.getByRole("cell", { name: "NULL" })).toBeTruthy();
    expect(svc.inspectRows).toHaveBeenCalledWith("fold", 0, 100);
  });

  it("shows another table when it is picked, and says when it is empty", async () => {
    const svc = service();
    render(<SqlInspector service={svc as any} isOpen revision={0} onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: /story_fold/ }));

    expect(await screen.findByText("This table is empty.")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "story" })).toBeTruthy();
  });

  it("looks again when the service reports a pass", async () => {
    const svc = service();
    const { rerender } = render(
      <SqlInspector service={svc as any} isOpen revision={0} onClose={vi.fn()} />,
    );
    await waitFor(() => expect(svc.inspectRows).toHaveBeenCalledTimes(1));

    rerender(<SqlInspector service={svc as any} isOpen revision={1} onClose={vi.fn()} />);

    await waitFor(() => expect(svc.inspectTables).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(svc.inspectRows).toHaveBeenCalledTimes(2));
  });

  it("asks nothing while closed", () => {
    const svc = service();
    render(<SqlInspector service={svc as any} isOpen={false} revision={0} onClose={vi.fn()} />);
    expect(svc.inspectTables).not.toHaveBeenCalled();
  });

  it("says what a value is when it cannot be shown as one", () => {
    expect(cellText(null)).toEqual({ text: "NULL", placeholder: true });
    expect(cellText(new Uint8Array(4))).toEqual({ text: "[4 bytes]", placeholder: true });
    expect(cellText(12)).toEqual({ text: "12", placeholder: false });
  });
});
