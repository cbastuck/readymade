import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import { defaultRegistry } from "../runtime/browser/registry/Default";
import SqlDescriptor from "../runtime/browser/services/Sql";
import { personRun } from "../runtime/processContext";

/**
 * The browser variant of the Court Booking demo.
 *
 * The same app with the runtime taken away, so the facade and the statements
 * are the other board's, and the test that matters is that they have not
 * drifted apart. What it may not share is the engine: the services it names
 * have to be ones the browser itself provides.
 */

function board(name: string) {
  return JSON.parse(readFileSync(`../boards/${name}`, "utf-8"));
}

const browserBoard = board("court-booking-browser-demo-board.json");
const nodeBoard = board("court-booking-demo-board.json");
const ANNA = {
  userId: "auth0|anna",
  username: "Anna",
  email: "anna@example.com",
};
const BEN = {
  userId: "auth0|ben",
  username: "Ben",
  email: "ben@example.com",
};

describe("the browser Court Booking demo board", () => {
  it("presents the same app as the board that needs a runtime", () => {
    expect(browserBoard.facade).toEqual(nodeBoard.facade);
  });

  it("runs the same statements", () => {
    expect(browserBoard.services).toEqual(nodeBoard.services);
  });

  it("runs on the browser alone", () => {
    expect(browserBoard.runtimes).toHaveLength(1);
    expect(browserBoard.runtimes[0].type).toBe("browser");
    expect(Object.keys(browserBoard.services)).toEqual([
      browserBoard.runtimes[0].id,
    ]);
  });

  it("names only services the browser registry provides", () => {
    const available = new Set(defaultRegistry.map((svc) => svc.serviceId));
    for (const services of Object.values(browserBoard.services) as any[]) {
      for (const svc of services) {
        expect(available, svc.serviceId).toContain(svc.serviceId);
      }
    }
  });

  describe("booking through the pipeline", () => {
    // The board's own statements, on a database of the test's own so nothing
    // a browser kept for the demo is touched.
    const database = `court-booking-test-${Date.now()}`;
    let activeRun = personRun(ANNA);
    const pipeline = browserBoard.services.club.map((svc: any) => {
      const app = {
        notify: vi.fn(),
        log: vi.fn(),
        next: vi.fn(),
        currentContext: () => activeRun,
      };
      const instance: any = SqlDescriptor.create(
        app as any,
        "court-booking",
        SqlDescriptor as any,
        svc.uuid,
      );
      instance.configure({ ...svc.state, database });
      return { uuid: svc.uuid, instance, app };
    });

    /** One tap: every service in order, as the facade's process action runs them. */
    const tap = async (
      payload: Record<string, unknown>,
      user: typeof ANNA | null = ANNA,
    ) => {
      activeRun = personRun(user);
      let value: any = payload;
      for (const { instance } of pipeline) {
        value = await instance.process(value);
        if (value === null) {
          break;
        }
      }
      return value;
    };

    const cell = (day: any, court: number, hour: number) =>
      day.rows.find((row: any) => row.column === court && row.hour === hour);

    const today = { dayOffset: 0, court: 1, hour: 9 };

    it("draws a day of free cells for a member with no booking", async () => {
      const day = await tap({ state: "none", dayOffset: 0 });
      expect(day.count).toBe(15 * 3);
      expect(cell(day, 1, 9)).toMatchObject({ state: "free", label: "" });
    });

    it("takes a free hour, and the day shows it as the member's", async () => {
      const day = await tap({ ...today, state: "free" });
      expect(cell(day, 1, 9)).toMatchObject({ state: "mine", label: "You" });
      // One hour a day: every other free cell is now blocked for her.
      expect(cell(day, 2, 9).state).toBe("blocked");
    });

    it("shows the hour as taken from another member's side", async () => {
      const day = await tap({ ...today, state: "free" }, BEN);
      // Taken, and by the member's display name rather than their address.
      expect(cell(day, 1, 9)).toMatchObject({
        state: "taken",
        label: "Anna",
      });
      expect(JSON.stringify(day.rows)).not.toContain("anna@example.com");
    });

    it("gives the hour back", async () => {
      const day = await tap({ ...today, state: "mine" });
      expect(cell(day, 1, 9).state).toBe("free");
    });

    it("refuses a double booking in the database, not only in the grid", async () => {
      const take = pipeline.find((svc: any) => svc.uuid === "take-hour")!;
      await tap({ ...today, state: "free" });

      // Straight at the table, past the statement's own guards.
      take.instance.configure({
        statement:
          "INSERT INTO court_booking (court, day, hour, member) VALUES ($court, date('now','localtime'), $hour, $member)",
      });
      take.app.notify.mockClear();
      expect(
        await take.instance.process({ ...today, member: "ben@club" }),
      ).toBeNull();
      expect(take.app.notify.mock.calls[0][1].error).toMatch(
        /UNIQUE constraint failed: court_booking\.court, court_booking\.day, court_booking\.hour/,
      );
    });
  });

  describe("booking as whoever is signed in to the app", () => {
    // The statements ask who is calling, and in a browser that is the account
    // signed in to the app — so the board reads the same on both runtimes.
    // Nothing verifies it here: the browser is the person, and the tables are
    // theirs alone.
    const database = `court-booking-signed-in-${Date.now()}`;
    let signedIn: Record<string, string> | null = null;
    let activeRun = personRun(null);
    const pipeline = browserBoard.services.club.map((svc: any) => {
      const app = {
        notify: vi.fn(),
        log: vi.fn(),
        next: vi.fn(),
        getAuthenticatedUser: () => signedIn,
        currentContext: () => activeRun,
      };
      const instance: any = SqlDescriptor.create(
        app as any,
        "court-booking",
        SqlDescriptor as any,
        svc.uuid,
      );
      instance.configure({ ...svc.state, database });
      return instance;
    });
    const tap = async (payload: Record<string, unknown>) => {
      // The runtime snapshots the person at the entry point; SQL reads the
      // run, not mutable browser identity at the moment it executes.
      activeRun = personRun(signedIn as any);
      let value: any = payload;
      for (const instance of pipeline) {
        value = await instance.process(value);
        if (value === null) {
          break;
        }
      }
      return value;
    };
    const cell = (day: any, court: number, hour: number) =>
      day.rows.find((row: any) => row.column === court && row.hour === hour);

    it("books in the account's name, ignoring identity fields in the payload", async () => {
      signedIn = ANNA;
      const hers = await tap({
        state: "free",
        dayOffset: 0,
        court: 2,
        hour: 11,
        member: "somebody-else@club",
      });
      expect(cell(hers, 2, 11)).toMatchObject({ state: "mine", label: "You" });

      // Another signed-in member sees it as Anna's, not as the forged member.
      signedIn = BEN;
      const theirs = await tap({
        state: "none",
        dayOffset: 0,
        member: "somebody-else@club",
      });
      expect(cell(theirs, 2, 11)).toMatchObject({ state: "taken", label: "Anna" });
    });

    it("does not allow an unauthenticated payload to choose a member", async () => {
      signedIn = null;
      const day = await tap({
        state: "free",
        dayOffset: 1,
        court: 1,
        hour: 9,
        member: ANNA.email,
      });

      expect(day.rows.every((row: any) => row.state === "blocked")).toBe(true);
    });
  });
});
