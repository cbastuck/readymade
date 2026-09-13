import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import RunParamsDialog from "hkp-frontend/src/ui-components/runtime-ui/RunParamsDialog";

/**
 * Two ways to write the input a run starts with.
 *
 * Fields build an object a name at a time, which is what the dialog could
 * always do. Text is the payload itself — a request body pasted out of an
 * API's reference manual — which a table of names and values cannot express
 * and which nobody should have to quote into a single cell.
 */

function renderDialog() {
  const onRun = vi.fn();
  render(<RunParamsDialog open onClose={() => {}} onRun={onRun} />);
  return onRun;
}

const run = () => fireEvent.click(screen.getByText("Process Runtime"));

describe("RunParamsDialog", () => {
  it("starts on the fields it has always offered", () => {
    renderDialog();

    expect(screen.getByLabelText("Fields").getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(screen.queryByLabelText("Run parameters as text")).toBeNull();
  });

  it("sends text exactly as typed, without parsing it", () => {
    const onRun = renderDialog();
    const body = '{"model": "deepseek-v4-flash"}';

    fireEvent.click(screen.getByLabelText("Text"));
    fireEvent.change(screen.getByLabelText("Run parameters as text"), {
      target: { value: body },
    });
    run();

    // The string, not the object it happens to spell: a service reading text
    // gets what was pasted, byte for byte.
    expect(onRun).toHaveBeenCalledWith(body);
  });

  it("does not offer to run an empty text payload", () => {
    renderDialog();

    fireEvent.click(screen.getByLabelText("Text"));

    expect(
      screen.getByText("Process Runtime").closest("button")?.disabled,
    ).toBe(true);
  });

  it("keeps what was written when the other way of writing it is looked at", () => {
    const onRun = renderDialog();

    fireEvent.click(screen.getByLabelText("Text"));
    fireEvent.change(screen.getByLabelText("Run parameters as text"), {
      target: { value: "kept" },
    });
    fireEvent.click(screen.getByLabelText("Fields"));
    fireEvent.click(screen.getByLabelText("Text"));

    expect(
      (screen.getByLabelText("Run parameters as text") as HTMLTextAreaElement)
        .value,
    ).toBe("kept");

    run();
    expect(onRun).toHaveBeenCalledWith("kept");
  });
});
