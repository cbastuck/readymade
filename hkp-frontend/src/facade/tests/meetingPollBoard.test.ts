import { describe, expect, it } from "vitest";

import board from "../../../../boards/meeting-poll-demo-board.json";

/**
 * The meeting poll's wiring, as the board relies on it.
 *
 * Three arrangements carry this board, none of them visible from any one
 * service, so they are pinned here.
 *
 * The first is that **every tap enters the pipeline at its head**. A vote, a
 * proposal and a close all process the first statement, and the intent they
 * carry decides which of the ones after it acts — so the two queries at the end
 * re-read whatever changed, in the same pass, and what a person sees is the
 * state after their own tap rather than a refresh that could race it.
 *
 * The second is that **only the last statement's result travels**. Every
 * statement before it emits its input, which is what lets each of them name its
 * parameters out of the same request; without that the second would be handed
 * the first one's row count and bind every name it asked for to NULL.
 *
 * The third is that **who is acting is never the request's to say**. Shared,
 * the board's entry point is callable by any member with any payload, so the
 * statements read the caller and their role off the run, and what only the
 * owner may do is drawn from rows only the owner is sent.
 */

type Service = {
  uuid: string;
  serviceId: string;
  state: Record<string, unknown>;
};

const services = board.services.office as Service[];
const order = services.map((svc) => svc.uuid);
const schema = services.find((svc) => typeof svc.state.schema === "string")!
  .state.schema as string;

/** Every serviceUuid a facade layout mentions, however deeply nested. */
function referencedUuids(
  node: unknown,
  found = new Set<string>(),
): Set<string> {
  if (Array.isArray(node)) {
    node.forEach((child) => referencedUuids(child, found));
    return found;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key === "serviceUuid" && typeof value === "string") {
        found.add(value);
      } else {
        referencedUuids(value, found);
      }
    }
  }
  return found;
}

/** Every service the facade asks to do something, as opposed to read from. */
function collectProcessTargets(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) {
    node.forEach((child) => collectProcessTargets(child, found));
    return found;
  }
  if (node && typeof node === "object") {
    const record = node as Record<string, unknown>;
    if (record.type === "process" && typeof record.serviceUuid === "string") {
      found.push(record.serviceUuid);
    }
    Object.values(record).forEach((value) =>
      collectProcessTargets(value, found),
    );
  }
  return found;
}

/** Every repeat drawing one row per row a service answers with. */
function repeatsOver(
  node: unknown,
  serviceUuid: string,
  found: Array<{ template: unknown }> = [],
): Array<{ template: unknown }> {
  if (Array.isArray(node)) {
    node.forEach((child) => repeatsOver(child, serviceUuid, found));
    return found;
  }
  if (node && typeof node === "object") {
    const record = node as Record<string, any>;
    if (
      record.type === "repeat" &&
      record.source?.serviceUuid === serviceUuid
    ) {
      found.push(record as { template: unknown });
    }
    repeatsOver(Object.values(record), serviceUuid, found);
  }
  return found;
}

describe("the meeting poll board", () => {
  it("references only services it declares", () => {
    const referenced = [...referencedUuids(board.facade)].sort();
    expect(referenced.length).toBeGreaterThan(0);
    expect(referenced.filter((uuid) => !order.includes(uuid))).toEqual([]);
  });

  it("sends everything a person does to the head of the pipeline", () => {
    const targets = collectProcessTargets(board.facade);
    expect(targets.length).toBeGreaterThan(0);
    expect([...new Set(targets)]).toEqual([order[0]]);
  });

  it("passes the request through every statement but the last", () => {
    const emits = services.map((svc) => svc.state.emit);
    expect(emits.slice(0, -1).every((emit) => emit === "input")).toBe(true);
    expect(emits[emits.length - 1]).toBe("result");
  });

  it("changes rows before it reads them", () => {
    const modes = services.map((svc) => svc.state.mode);
    const lastWrite = modes.lastIndexOf("run");
    const firstRead = modes.indexOf("query");
    expect(firstRead).toBeGreaterThan(lastWrite);
  });

  it("knows who is here before anything acts on them", () => {
    expect(order[0]).toBe("who-is-here");
    expect(order.indexOf("open-poll")).toBeLessThan(
      order.indexOf("put-up-date"),
    );
  });

  it("keeps its tables to itself rather than deriving a name from the title", () => {
    expect(services.every((svc) => svc.state.database === "meetings")).toBe(
      true,
    );
  });

  it("takes who is acting from the run, never from the payload", () => {
    const statements = services.map((svc) => svc.state.statement as string);
    expect(
      statements.some((sql) => /\$(actor|you|voter|organiser)\b/.test(sql)),
    ).toBe(false);
    expect(JSON.stringify(board.facade)).not.toMatch(/"(actor|you)"/);
    // Calling a meeting asks the role the server stated, not the person.
    const call = services.find((svc) => svc.uuid === "open-poll")!.state
      .statement;
    expect(call).toContain("$caller_role = 'owner'");
  });

  it("draws what only the owner may do from rows only the owner is sent", () => {
    const organising = JSON.stringify(repeatsOver(board.facade, "organising"));
    expect(organising).toContain('"intent":"create"');
    expect(organising).toContain('"intent":"propose"');
    expect(organising).toContain('"intent":"{{item.closeIntent}}"');
    const withdrawing = JSON.stringify(
      repeatsOver(board.facade, "withdrawable"),
    );
    expect(withdrawing).toContain('"intent":"withdraw"');
    // Nothing the owner alone may do is drawn from anything else.
    for (const uuid of ["the-dates", "the-poll", "the-meetings"]) {
      const drawn = JSON.stringify(repeatsOver(board.facade, uuid));
      for (const intent of ["create", "propose", "withdraw"]) {
        expect(drawn).not.toContain(`"intent":"${intent}"`);
      }
    }
    for (const uuid of ["organising", "withdrawable"]) {
      const sql = services.find((svc) => svc.uuid === uuid)!.state.statement;
      expect(sql).toContain("WHERE $caller_role = 'owner'");
    }
  });

  it("holds the rules a tap must not break in the schema", () => {
    // One answer per person per date, and one date on the poll however often
    // it is put up: a second tap and a stale page both land on these.
    expect(schema).toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS one_vote_per_option",
    );
    expect(schema).toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS one_option_per_time",
    );
    // The rules a unique index cannot state, said where they are refused with
    // a reason the facade can show.
    expect(schema).toContain("the_owner_calls_the_meetings");
    expect(schema).toContain("a_date_is_for_a_meeting");
    expect(schema).toContain("the_organiser_puts_up_the_dates");
    expect(schema).toContain("a_closed_poll_takes_no_dates");
    expect(schema).toContain("a_closed_poll_takes_no_answers");
    // Withdrawing a date takes the answers given to it.
    expect(schema).toContain("REFERENCES option (id) ON DELETE CASCADE");
  });

  it("shows the reason a refused statement gave", () => {
    const shown = referencedUuids(board.facade);
    const errors = JSON.stringify(board.facade).match(/"path":"error"/g) ?? [];
    expect(errors.length).toBeGreaterThan(0);
    expect(shown.has("put-up-date")).toBe(true);
    expect(shown.has("say-yes")).toBe(true);
  });
});
