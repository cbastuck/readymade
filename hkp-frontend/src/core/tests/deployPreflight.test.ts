import { afterEach, describe, expect, it, vi } from "vitest";

import {
  blocksDeploy,
  describePreflight,
  preflightBoard,
} from "../deployPreflight";
import { BoardDescriptor } from "../../types";

/**
 * Checking a board before it is handed over.
 *
 * Each runtime gets its own answer, and the answer names what is wrong: a name
 * this client does not hold, a server that is away, one that turned the person
 * down, one without the board's services and one that cannot connect to a
 * coordinator are five different things to do something about.
 */

const user = { userId: "user-1", idToken: "token-1" };

const remotes = [
  { name: "Laptop", type: "rest", url: "http://laptop:8080" },
  { name: "Studio", type: "rest", url: "http://studio:5000" },
  { name: "Attic", type: "rest", url: "http://attic:5000" },
];

function board(node: Record<string, unknown>): BoardDescriptor {
  return {
    boardName: "Doorbell",
    runtimes: [
      { id: "ui", name: "Browser", type: "browser" },
      { id: "node", name: "Node", type: "rest", ...node },
    ],
    services: {
      ui: [{ uuid: "t", serviceId: "hookup.to/service/timer" }],
      node: [
        { uuid: "m", serviceId: "monitor" },
        { uuid: "s", serviceId: "hookup.to/service/smtp" },
        { uuid: "use", block: "greeting" },
      ],
    },
  } as unknown as BoardDescriptor;
}

const registry = [{ serviceId: "monitor" }, { serviceId: "smtp" }];

/** Runtime servers by origin: what each answers to GET /runtimes. */
function servers(
  answers: Record<string, { status?: number; body?: unknown } | "down">,
) {
  const fetchMock = vi.fn(async (input: string) => {
    const origin = new URL(input).origin;
    const answer = answers[origin];
    if (!answer || answer === "down") {
      throw new TypeError("Failed to fetch");
    }
    return new Response(JSON.stringify(answer.body ?? {}), {
      status: answer.status ?? 200,
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const healthy = (server: string) => ({
  body: { runtimes: [], registry, server, coordinatorLinks: true },
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function nodeFinding(node: Record<string, unknown>) {
  const findings = await preflightBoard(board(node), remotes, user);
  return findings.find((f) => f.runtimeId === "node")!;
}

describe("a runtime that is ready", () => {
  it("is one whose server is up, accepts the person, has the services and can join", async () => {
    const fetchMock = servers({ "http://node.example": healthy("node") });

    const findings = await preflightBoard(
      board({ url: "http://node.example" }),
      remotes,
      user,
    );

    expect(findings.map((f) => f.status)).toEqual(["transient", "ready"]);
    expect(findings.some(blocksDeploy)).toBe(false);
    expect(findings[1]).toMatchObject({
      url: "http://node.example",
      mode: "url",
    });
    // An authored address is what the person wrote; no remote is named for it.
    expect(findings[1].remoteName).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("http://node.example/runtimes", {
      headers: { Authorization: "Bearer token-1" },
    });
  });

  it("is placed on the remote the board names", async () => {
    servers({ "http://studio:5000": healthy("python") });

    const finding = await nodeFinding({ remote: "Studio" });

    expect(finding).toMatchObject({
      status: "ready",
      url: "http://studio:5000",
      mode: "remote",
      remoteName: "Studio",
    });
    expect(describePreflight(finding)).toBe("“Node” is ready on “Studio”");
  });

  it("is placed on the first remote of the kind it asks for, and says which", async () => {
    servers({
      "http://laptop:8080": healthy("node"),
      "http://studio:5000": healthy("python"),
      "http://attic:5000": healthy("python"),
    });

    const finding = await nodeFinding({ requires: { kind: "python" } });

    expect(finding).toMatchObject({
      status: "ready",
      mode: "requires",
      remoteName: "Studio",
    });
  });

  it("asks each runtime server once, however many runtimes land on it", async () => {
    const fetchMock = servers({ "http://laptop:8080": healthy("node") });
    const twice = {
      boardName: "b",
      runtimes: [
        { id: "a", name: "A", type: "rest", remote: "Laptop" },
        { id: "b", name: "B", type: "rest", requires: { kind: "node" } },
      ],
      services: { a: [], b: [] },
    } as unknown as BoardDescriptor;

    const findings = await preflightBoard(twice, [remotes[0]], user);

    expect(findings.map((f) => f.status)).toEqual(["ready", "ready"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("a runtime that stops the deploy", () => {
  it("names the remote this client does not know", async () => {
    servers({});

    const finding = await nodeFinding({ remote: "Someone else's" });

    expect(finding.status).toBe("unresolved");
    expect(blocksDeploy(finding)).toBe(true);
    expect(describePreflight(finding)).toMatch(/Someone else's/);
  });

  it("says no remote is of the kind it needs", async () => {
    servers({ "http://laptop:8080": healthy("node") });

    const finding = await nodeFinding({ requires: { kind: "go" } });

    expect(finding.status).toBe("unresolved");
    expect(describePreflight(finding)).toMatch(/needs a go runtime server/);
  });

  it("refuses one that says where it runs more than once, dialling neither", async () => {
    const fetchMock = servers({});

    const finding = await nodeFinding({
      remote: "Laptop",
      url: "http://evil.example",
    });

    expect(finding.status).toBe("invalid");
    expect(blocksDeploy(finding)).toBe(true);
    expect(describePreflight(finding)).toMatch(/more than once/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says one names no runtime server at all", async () => {
    servers({});

    const finding = await nodeFinding({});

    expect(finding.status).toBe("unresolved");
    expect(describePreflight(finding)).toMatch(/names no runtime server/);
  });

  it("says its server is not running when it does not answer", async () => {
    servers({ "http://laptop:8080": "down" });

    const finding = await nodeFinding({ remote: "Laptop" });

    expect(finding.status).toBe("unreachable");
    expect(blocksDeploy(finding)).toBe(true);
    expect(describePreflight(finding)).toMatch(
      /its runtime server on “Laptop” is not running/,
    );
  });

  it("says its server refused the person", async () => {
    servers({ "http://laptop:8080": { status: 403 } });

    expect((await nodeFinding({ remote: "Laptop" })).status).toBe("refused");
  });

  it("lists the services its server does not have", async () => {
    servers({
      "http://laptop:8080": {
        body: {
          registry: [{ serviceId: "monitor" }],
          server: "node",
          coordinatorLinks: true,
        },
      },
    });

    const finding = await nodeFinding({ remote: "Laptop" });

    expect(finding.status).toBe("missing-services");
    expect(finding.missing).toEqual(["smtp"]);
    expect(describePreflight(finding)).toMatch(/does not have smtp/);
  });

  it("says its server cannot connect to a coordinator", async () => {
    // A runtime server from before coordinators stopped dialling: there is
    // nothing for the coordinator to reach it with any more.
    servers({
      "http://laptop:8080": { body: { registry, server: "c++" } },
    });

    const finding = await nodeFinding({ remote: "Laptop" });

    expect(finding.status).toBe("cannot-join");
    expect(blocksDeploy(finding)).toBe(true);
    expect(describePreflight(finding)).toMatch(/cannot connect to a coordinator/);
  });
});

describe("what does not stop a deploy", () => {
  it("is a browser runtime, which nobody has to be running", async () => {
    servers({ "http://laptop:8080": healthy("node") });

    const [browser] = await preflightBoard(
      board({ remote: "Laptop" }),
      remotes,
      user,
    );

    expect(browser.status).toBe("transient");
    expect(blocksDeploy(browser)).toBe(false);
  });

  it("is a server that reports no registry to check against", async () => {
    servers({
      "http://laptop:8080": { body: { server: "node", coordinatorLinks: true } },
    });

    expect((await nodeFinding({ remote: "Laptop" })).status).toBe("ready");
  });
});
