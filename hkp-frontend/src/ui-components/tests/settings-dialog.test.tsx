import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import SettingsDialog, {
  APPEARANCE_TAB,
} from "hkp-frontend/src/ui-components/SettingsDialog";
import { ThemeProvider } from "hkp-frontend/src/ui-components/ThemeContext";

/**
 * Appearance is the tab every host has, because it is backed by ThemeContext
 * and localStorage alone. A host that can settle nothing else still reaches it
 * — that is what makes the dialog worth sharing rather than writing per host.
 */

function renderDialog(props: Partial<Parameters<typeof SettingsDialog>[0]> = {}) {
  localStorage.clear();
  return render(
    <ThemeProvider defaultThemeName="playground">
      <SettingsDialog
        tab={APPEARANCE_TAB}
        onChangeTab={() => {}}
        {...props}
      />
    </ThemeProvider>,
  );
}

describe("SettingsDialog", () => {
  it("offers appearance and Board Assist settings to every host", () => {
    renderDialog();

    expect(screen.getByText("Accent colors")).toBeTruthy();
    // Both device-local settings are shared across browser and native hosts.
    expect(screen.getAllByRole("tab").map(tab => tab.textContent)).toEqual(["Appearance", "Board Assist"]);
  });

  it("puts a host's own tabs alongside appearance", () => {
    renderDialog({
      extraTabs: [{ id: "remotes", label: "Remotes", content: <div /> }],
    });

    expect(
      screen.getAllByRole("tab").map((tab) => tab.textContent),
    ).toEqual(["Appearance", "Board Assist", "Remotes"]);
  });

  it("stays closed while no tab is asked for", () => {
    renderDialog({ tab: null });

    expect(screen.queryByText("Accent colors")).toBeNull();
  });
});
