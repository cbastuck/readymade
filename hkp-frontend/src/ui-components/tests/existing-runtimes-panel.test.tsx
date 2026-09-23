import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import ExistingRuntimesPanel from "hkp-frontend/src/ui-components/toolbar/ExistingRuntimesPanel";
import { RuntimeClass } from "hkp-frontend/src/types";

/**
 * A registered remote is a name and an address a person typed, and both of
 * them change — a server moves, or was called something unhelpful. The panel
 * reports the edit as a replacement, because the stores behind it key their
 * entries by the name the entry had.
 */

const registered: RuntimeClass = {
  name: "My Server",
  type: "rest",
  url: "http://127.0.0.1:8080",
};

const builtIn: RuntimeClass = {
  name: "Local",
  type: "rest",
  url: "hkp://remotes/local",
};

function renderPanel(
  runtimes: RuntimeClass[],
  onUpdateRuntime?: (previous: RuntimeClass, next: RuntimeClass) => void,
) {
  return render(
    <ExistingRuntimesPanel
      remoteRuntimes={runtimes}
      onRemoveRuntime={() => {}}
      onChangeRuntimeColor={() => {}}
      onUpdateRuntime={onUpdateRuntime}
    />,
  );
}

describe("ExistingRuntimesPanel", () => {
  it("reports an edited name and URL as a replacement of the row's entry", () => {
    const onUpdateRuntime = vi.fn();
    renderPanel([registered], onUpdateRuntime);

    fireEvent.click(screen.getByLabelText("Edit My Server"));
    fireEvent.change(screen.getByDisplayValue("My Server"), {
      target: { value: "Studio" },
    });
    fireEvent.change(screen.getByDisplayValue("http://127.0.0.1:8080"), {
      target: { value: "http://192.168.0.4:8080/" },
    });
    fireEvent.click(screen.getByText("Save"));

    expect(onUpdateRuntime).toHaveBeenCalledWith(registered, {
      ...registered,
      name: "Studio",
      // Saved as a base URL, the way the add form stores one.
      url: "http://192.168.0.4:8080",
    });
  });

  it("offers no edit on a host's own built-in remote", () => {
    renderPanel([builtIn], () => {});

    expect(screen.queryByLabelText("Edit Local")).toBeNull();
  });

  it("offers no edit when the host keeps no update handler", () => {
    renderPanel([registered]);

    expect(screen.queryByLabelText("Edit My Server")).toBeNull();
  });
});
