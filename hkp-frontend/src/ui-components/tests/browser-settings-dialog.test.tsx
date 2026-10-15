import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { BoardCtx, BoardContextState } from "hkp-frontend/src/BoardContext";
import { storeAvailableRuntimeEngines } from "hkp-frontend/src/common";
import BrowserSettingsDialog, {
  CONNECTIONS_TAB,
} from "hkp-frontend/src/ui-components/BrowserSettingsDialog";
import { ThemeProvider } from "hkp-frontend/src/ui-components/ThemeContext";
import { RuntimeClass } from "hkp-frontend/src/types";

/**
 * A browser has one set of settings, whichever view they are opened from. The
 * views differ only in where the servers under Connections come from: a view
 * that lists them passes its own controllers, a board has its engine pool, and
 * anything else reads what the browser stored.
 */

const stored: RuntimeClass = {
  name: "Stored Server",
  type: "rest",
  url: "http://127.0.0.1:8080",
};

const pooled: RuntimeClass = {
  name: "Board Server",
  type: "rest",
  url: "http://127.0.0.1:9090",
};

function renderDialog(
  props: Partial<Parameters<typeof BrowserSettingsDialog>[0]> = {},
  board?: Partial<BoardContextState>,
) {
  return render(
    <ThemeProvider defaultThemeName="playground">
      <BoardCtx.Provider value={(board as BoardContextState) ?? null}>
        <BrowserSettingsDialog
          tab={CONNECTIONS_TAB}
          onChangeTab={() => {}}
          {...props}
        />
      </BoardCtx.Provider>
    </ThemeProvider>,
  );
}

describe("BrowserSettingsDialog", () => {
  beforeEach(() => {
    localStorage.clear();
    storeAvailableRuntimeEngines([stored]);
  });

  it("offers the same tabs with and without a view's own controllers", () => {
    const expected = ["Appearance", "Board Assist", "Connections", "Licences"];

    const { unmount } = renderDialog();
    expect(
      screen.getAllByRole("tab").map((tab) => tab.textContent),
    ).toEqual(expected);
    unmount();

    renderDialog({
      connections: {
        remotes: {
          runtimes: [],
          onAdd: () => {},
          onRemove: () => {},
          onUpdate: () => {},
        },
        coordinators: {
          coordinators: [],
          onAdd: () => {},
          onRemove: () => {},
          onUpdate: () => {},
        },
      },
    });
    expect(
      screen.getAllByRole("tab").map((tab) => tab.textContent),
    ).toEqual(expected);
  });

  it("lists the stored servers where there is no board", () => {
    renderDialog();

    expect(screen.getByLabelText("Edit Stored Server")).toBeTruthy();
  });

  it("lists a board's engine pool rather than the stored servers", () => {
    renderDialog(
      {},
      {
        availableRuntimeEngines: [
          { name: "Browser Runtime", type: "browser" },
          pooled,
        ],
      },
    );

    expect(screen.getByLabelText("Edit Board Server")).toBeTruthy();
    expect(screen.queryByLabelText("Edit Stored Server")).toBeNull();
    expect(screen.queryByLabelText("Edit Browser Runtime")).toBeNull();
  });

  it("lists a view's own servers when it passes them", () => {
    renderDialog({
      connections: {
        remotes: {
          runtimes: [pooled],
          onAdd: () => {},
          onRemove: () => {},
          onUpdate: () => {},
        },
        coordinators: {
          coordinators: [],
          onAdd: () => {},
          onRemove: () => {},
          onUpdate: () => {},
        },
      },
    });

    expect(screen.getByLabelText("Edit Board Server")).toBeTruthy();
    expect(screen.queryByLabelText("Edit Stored Server")).toBeNull();
  });
});
