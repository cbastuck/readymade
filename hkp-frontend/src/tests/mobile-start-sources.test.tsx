import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AppProvider from "../AppContext";
import MobileStartPage from "../views/start/mobile/MobileStartPage";
import type { StartPageStore } from "../views/start/store";
import type { StartPageTree } from "../views/start/types";

// The sources read the logged-in user from AppContext; nobody is logged in
// here, which is what the Cloud Boards source's login hint is about.
vi.mock("@auth0/auth0-react", () => ({
  useAuth0: () => ({
    getIdTokenClaims: async () => undefined,
    getAccessTokenSilently: async () => "",
    isLoading: false,
    isAuthenticated: false,
    logout: async () => {},
  }),
}));

vi.mock("sonner", () => ({
  toast: { info: () => {}, success: () => {}, error: () => {} },
}));

const REMOTE_URL = "http://127.0.0.1:8080";

const emptyStore: StartPageStore = {
  load: async () => ({ version: 1, items: [] }) as StartPageTree,
  save: async () => {},
};

function renderStartPage(canOpen?: () => boolean) {
  render(
    <AppProvider>
      <MobileStartPage
        store={emptyStore}
        listSavedBoards={async () => []}
        onOpen={() => {}}
        onCreateBoard={() => {}}
        manageRemotes={{
          runtimes: [{ type: "rest", name: "Local", url: REMOTE_URL }],
          onAdd: () => {},
          onRemove: () => {},
          onUpdate: () => {},
        }}
        withCloudBoards
        canOpen={canOpen}
      />
    </AppProvider>,
  );
}

describe("mobile start page sources", () => {
  it("drills Remotes → server → runtime into the runtime's services", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        expect(String(input)).toBe(`${REMOTE_URL}/runtimes`);
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              id: "node",
              name: "Node",
              boardName: "Voice Notes",
              services: [
                {
                  uuid: "svc-1",
                  serviceId: "monitor",
                  serviceName: "Monitor",
                  state: { mode: "idle" },
                },
              ],
            },
          ],
        } as Response;
      }),
    );

    renderStartPage();

    fireEvent.click(await screen.findByText("Remotes"));
    fireEvent.click(await screen.findByText("Local"));
    fireEvent.click(await screen.findByText("Node"));

    expect(await screen.findByText("Running on Local")).toBeTruthy();
    expect(screen.getByText(REMOTE_URL)).toBeTruthy();
    expect(screen.getByText("Voice Notes")).toBeTruthy();
    expect(screen.getByText("Monitor")).toBeTruthy();
    expect(screen.getByText("Open runtime")).toBeTruthy();
  });

  it("browses a runtime without an Open action when the host has no view for it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({
            ok: true,
            status: 200,
            json: async () => [{ id: "node", name: "Node", services: [] }],
          }) as Response,
      ),
    );

    renderStartPage(() => false);

    fireEvent.click(await screen.findByText("Remotes"));
    fireEvent.click(await screen.findByText("Local"));
    fireEvent.click(await screen.findByText("Node"));

    expect(await screen.findByText("Running on Local")).toBeTruthy();
    expect(screen.queryByText("Open runtime")).toBeNull();
  });

  it("shows the Cloud Boards source with its login hint when logged out", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => [] }) as Response));

    renderStartPage();

    fireEvent.click(await screen.findByText("Cloud Boards"));

    expect(
      await screen.findByText("Log in to see your cloud boards"),
    ).toBeTruthy();
  });
});
