import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import Toolbar from "hkp-frontend/src/components/Toolbar";
import {
  ThemeProvider,
  type ThemeName,
} from "hkp-frontend/src/ui-components/ThemeContext";

/**
 * Board actions — deploying, and the way into the overview — are shown under
 * every theme. Which theme a board is being looked at in says nothing about
 * what can be done to it, and the theme is remembered per host, so a choice
 * made once would otherwise take those controls away for good.
 */

function renderToolbar(themeName: ThemeName) {
  localStorage.clear();
  return render(
    <MemoryRouter>
      <ThemeProvider defaultThemeName={themeName}>
        <Toolbar
          hideNavigation
          actionsSlot={<button type="button">board action</button>}
        />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("Toolbar actions", () => {
  it.each(["playground", "default", "sketch"] as ThemeName[])(
    "shows them under the %s theme",
    (themeName) => {
      renderToolbar(themeName);
      expect(
        screen.getByRole("button", { name: "board action" }),
      ).toBeDefined();
    },
  );
});
