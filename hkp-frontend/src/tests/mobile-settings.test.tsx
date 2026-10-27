import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";

import { PlatformProvider } from "hkp-frontend/src/platform/PlatformContext";
import { ThemeProvider } from "hkp-frontend/src/ui-components/ThemeContext";
import MobileSettingsPage, {
  kitSection,
} from "hkp-frontend/src/views/settings/MobileSettingsPage";
import BoardMenuSheet from "hkp-frontend/src/views/playground/mobile/BoardMenuSheet";
import { storeCoordinators } from "hkp-frontend/src/common";
import { useLocalStorageCoordinators } from "hkp-frontend/src/views/start/useLocalStorageCoordinators";

/**
 * Settings on a phone.
 *
 * The desktop dialog's tabs become a list of sections, each a page of its own,
 * opened from the start page and from a board's menu. A board stays open
 * underneath, so what the settings change has to reach a board that is
 * already showing.
 */

vi.mock("hkp-frontend/src/auth/useCloudLogin", () => ({
  useCloudLogin: () => vi.fn(),
  useCanCloudLogin: () => true,
}));
vi.mock("hkp-frontend/src/auth/useCloudLogout", () => ({
  useCloudLogout: () => vi.fn(),
}));
vi.mock("hkp-frontend/src/AppContext", () => ({
  useAppContext: () => ({ user: null }),
}));

afterEach(() => {
  localStorage.removeItem("hkp-coordinators");
});

describe("the settings page", () => {
  it("lists the host's sections around Appearance, as the desktop dialog orders its tabs", () => {
    render(
      <ThemeProvider>
        <MobileSettingsPage
          onClose={() => {}}
          leadingSections={[
            kitSection({ id: "about", label: "About", icon: null, content: <div /> }),
          ]}
          sections={[
            kitSection({ id: "secrets", label: "Secrets", icon: null, content: <div /> }),
          ]}
        />
      </ThemeProvider>,
    );

    const [about, appearance, secrets] = ["About", "Appearance", "Secrets"].map(
      (label) => screen.getByText(label),
    );
    const follows = (a: Element, b: Element) =>
      !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(about, appearance)).toBe(true);
    expect(follows(appearance, secrets)).toBe(true);
  });

  it("opens a section as its own page and comes back to the list", () => {
    render(
      <ThemeProvider>
        <MobileSettingsPage
          onClose={() => {}}
          sections={[
            {
              id: "secrets",
              label: "Secrets",
              icon: null,
              render: (onBack) => (
                <div>
                  secrets page <button onClick={onBack}>leave</button>
                </div>
              ),
            },
          ]}
        />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByText("Secrets"));
    expect(screen.getByText("secrets page")).toBeTruthy();
    fireEvent.click(screen.getByText("leave"));
    expect(screen.queryByText("secrets page")).toBeNull();
  });

  it("frames a kit section so the desktop tab's content renders as it does there", () => {
    render(
      <ThemeProvider>
        <MobileSettingsPage onClose={() => {}} />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByText("Appearance"));
    const theme = screen.getByText("Theme");
    expect(theme.closest(".hkp-set")).toBeTruthy();
  });

  it("closes from its back control", () => {
    const onClose = vi.fn();
    render(
      <ThemeProvider>
        <MobileSettingsPage onClose={onClose} />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByLabelText("Back"));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("the board menu on a phone", () => {
  const menu = (onOpenSettings?: () => void) => (
    <PlatformProvider value={{ getRuntimeSettings: async () => ({ allowExternalRuntimeAccess: false, allowedUsers: [] }) }}>
      <BoardMenuSheet
        open
        onClose={() => {}}
        onSave={() => {}}
        onShare={() => {}}
        onNew={() => {}}
        onDeploy={() => {}}
        onOpenSettings={onOpenSettings}
      />
    </PlatformProvider>
  );

  it("opens the host's settings, where runtime access now is", () => {
    const onOpenSettings = vi.fn();
    render(menu(onOpenSettings));

    expect(screen.queryByText("Runtime access")).toBeNull();
    fireEvent.click(screen.getByText("Settings"));
    expect(onOpenSettings).toHaveBeenCalled();
  });

  it("keeps runtime access in the menu for a host without settings", () => {
    render(menu());
    expect(screen.getByText("Runtime access")).toBeTruthy();
    expect(screen.queryByText("Settings")).toBeNull();
  });
});

describe("coordinators changed elsewhere", () => {
  it("reach a list that is already showing", () => {
    const { result } = renderHook(() => useLocalStorageCoordinators());
    expect(result.current.coordinators).toEqual([]);

    act(() => storeCoordinators([{ name: "Cloud", url: "https://c.example" }]));

    expect(result.current.coordinators).toEqual([
      { name: "Cloud", url: "https://c.example" },
    ]);
  });
});
