import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import EditorDialog from "hkp-frontend/src/ui-components/EditorDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "hkp-frontend/src/ui-components/primitives/dialog";

/**
 * What a dialog is described by.
 *
 * A description is optional: the title names a dialog, and one that needs no
 * further explanation is described by nothing. Radix references a description
 * regardless and warns when the reference leads nowhere, so the content only
 * keeps it while there is a description for it to lead to.
 */

function dialog(description?: string) {
  return (
    <Dialog open>
      <DialogContent>
        <DialogTitle>Delete board</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogContent>
    </Dialog>
  );
}

describe("dialog description", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

  afterEach(() => {
    warn.mockClear();
  });

  it("is described by nothing when it has no description", () => {
    render(dialog());

    expect(screen.getByRole("dialog").hasAttribute("aria-describedby")).toBe(
      false,
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it("is described by its description when it has one", () => {
    render(dialog("This cannot be undone."));

    const describedBy = screen
      .getByRole("dialog")
      .getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toBe(
      "This cannot be undone.",
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it("follows a description that comes and goes", () => {
    const { rerender } = render(dialog());

    rerender(dialog("This cannot be undone."));
    expect(screen.getByRole("dialog").hasAttribute("aria-describedby")).toBe(
      true,
    );

    rerender(dialog());
    expect(screen.getByRole("dialog").hasAttribute("aria-describedby")).toBe(
      false,
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it("describes an editor dialog by the description it is given", () => {
    render(
      <EditorDialog
        title="Runtime Configuration"
        description="Edit runtime metadata, color, and JSON configuration."
        value="{}"
        isOpen
        onClose={() => {}}
      />,
    );

    const describedBy = screen
      .getByRole("dialog")
      .getAttribute("aria-describedby");
    expect(document.getElementById(describedBy!)?.textContent).toBe(
      "Edit runtime metadata, color, and JSON configuration.",
    );
    expect(warn).not.toHaveBeenCalled();
  });
});
