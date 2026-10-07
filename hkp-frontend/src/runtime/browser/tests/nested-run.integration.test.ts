/**
 * Who a service inside a pipeline inside a service finds itself called by.
 *
 * A service the runtime calls is told the run it is in, and can ask who is
 * signed in to the app. A service one level down — in a sub-service, a branch
 * of a Switch, a track — is called by the service holding it, in a scope of
 * its own that nobody provisions. What is pinned here is that it is told the
 * same two things, by every service that holds a pipeline: a run that arrived
 * from a coordinator is its caller's at any depth, a run that arrived naming
 * nobody is nobody's, and a run that began here is the signed-in person's.
 *
 * The witness is a real `sql` answering with the caller it was bound, because
 * that is the service this matters to.
 */

import { describe, expect, it, vi } from "vitest";

import BrowserRegistry from "hkp-frontend/src/runtime/browser/BrowserRegistry";
import BrowserRuntimeScope from "hkp-frontend/src/runtime/browser/BrowserRuntimeScope";
import {
  addService,
  configureService,
  processRuntime,
} from "hkp-frontend/src/runtime/browser/BrowserRuntimeApi";
import { continuedRun } from "hkp-frontend/src/runtime/processContext";
import { ProcessContext, User } from "hkp-frontend/src/types";

const OWNER = {
  userId: "auth0|owner",
  username: "Owner",
  email: "owner@club.example",
  idToken: "t",
} as unknown as User;
const ANNA = { sub: "auth0|anna", email: "anna@example.com", name: "Anna" };

let counter = 0;

/** A `sql` answering with who it was called by. */
function whoami(instanceId = `whoami-${++counter}`) {
  return {
    serviceId: "sql",
    instanceId,
    serviceName: "Who",
    state: {
      mode: "query",
      database: `nested-run-${Date.now()}-${++counter}`,
      statement: "SELECT $caller_sub AS sub, $caller_email AS email",
    },
  };
}

type Entry = { serviceId: string; instanceId: string; state: object };

/** A browser runtime holding `entries`, with the owner signed in to its app. */
async function runtimeOf(entries: Entry[], user: User | null = OWNER) {
  const scope = new BrowserRuntimeScope(
    { id: "ui", name: "Browser", type: "browser" },
    new BrowserRegistry(),
  );
  scope.authenticatedUser = user;
  for (const entry of entries) {
    const descriptor = await addService(
      scope,
      { serviceId: entry.serviceId, serviceName: entry.serviceId } as never,
      entry.instanceId,
    );
    await configureService(scope, descriptor!, entry.state);
  }
  return scope;
}

const who = (answer: unknown) =>
  (answer as { rows: Array<{ sub: string | null; email: string | null }> })
    .rows[0];

/**
 * Each service that holds a pipeline, holding the witness, and where the
 * witness's answer is found once the runtime has been run.
 */
const HOLDERS: Array<{
  name: string;
  entries: () => Entry[];
  answer: (result: unknown, scope: BrowserRuntimeScope) => unknown;
  /** Something to do before the run, to be able to read the answer after. */
  watch?: (scope: BrowserRuntimeScope) => void;
}> = [
  {
    name: "a sub-service",
    entries: () => [
      { serviceId: "sub-service", instanceId: "holder", state: { pipeline: [whoami()] } },
    ],
    answer: (result) => result,
  },
  {
    name: "a sub-service inside a sub-service",
    entries: () => [
      {
        serviceId: "sub-service",
        instanceId: "holder",
        state: {
          pipeline: [
            {
              serviceId: "sub-service",
              instanceId: "inner",
              state: { pipeline: [whoami()] },
            },
          ],
        },
      },
    ],
    answer: (result) => result,
  },
  {
    name: "an If's pipeline",
    entries: () => [
      {
        serviceId: "hookup.to/service/if",
        instanceId: "holder",
        state: { condition: "true", pipeline: [whoami()] },
      },
    ],
    answer: (result) => result,
  },
  {
    name: "a Switch's case",
    entries: () => [
      {
        serviceId: "hookup.to/service/switch",
        instanceId: "holder",
        state: { cases: [{ when: "true", pipeline: [whoami()] }] },
      },
    ],
    answer: (result) => result,
  },
  {
    name: "a Switch's default",
    entries: () => [
      {
        serviceId: "hookup.to/service/switch",
        instanceId: "holder",
        state: {
          cases: [{ when: "false", pipeline: [] }],
          default: [whoami()],
        },
      },
    ],
    answer: (result) => result,
  },
  {
    name: "a track",
    entries: () => [
      {
        serviceId: "tracks",
        instanceId: "holder",
        state: { tracks: [{ name: "only", pipeline: [whoami()] }] },
      },
    ],
    answer: (result) => (result as unknown[])[0],
  },
  {
    name: "a track run beside another",
    entries: () => [
      {
        serviceId: "tracks",
        instanceId: "holder",
        state: {
          run: "parallel",
          tracks: [
            { name: "one", pipeline: [whoami()] },
            { name: "two", pipeline: [whoami()] },
          ],
        },
      },
    ],
    answer: (result) => (result as unknown[])[1],
  },
  {
    name: "the pipeline reducing tracks",
    entries: () => [
      {
        serviceId: "tracks",
        instanceId: "holder",
        state: {
          tracks: [{ name: "only", pipeline: [whoami()] }],
          reduce: [whoami()],
        },
      },
    ],
    answer: (result) => result,
  },
  {
    name: "a Configurator's pipeline",
    entries: () => [
      {
        serviceId: "hookup.to/service/configurator",
        instanceId: "holder",
        state: { targetServiceUuid: "sink", pipeline: [whoami()] },
      },
      { serviceId: "hookup.to/service/map", instanceId: "sink", state: {} },
    ],
    watch: (scope) => {
      const [sink] = scope.findServiceInstance("sink");
      vi.spyOn(sink!, "configure").mockImplementation(() => undefined);
    },
    // What the pipeline made is what the target was configured with.
    answer: (_result, scope) => {
      const [sink] = scope.findServiceInstance("sink");
      return vi.mocked(sink!.configure).mock.calls.at(-1)?.[0];
    },
  },
  {
    name: "a Process Router's pipeline",
    entries: () => [
      {
        serviceId: "hookup.to/service/process-router",
        instanceId: "holder",
        state: { passThrough: true, pipeline: [whoami()] },
      },
    ],
    watch: (scope) => {
      const [holder] = scope.findServiceInstance("holder");
      vi.spyOn(holder as never, "_transform");
    },
    answer: async (_result, scope) => {
      const [holder] = scope.findServiceInstance("holder");
      const transform = (holder as unknown as { _transform: unknown })
        ._transform;
      return vi.mocked(transform as () => Promise<unknown>).mock.results.at(-1)
        ?.value;
    },
  },
  {
    name: "the service a Process Router hands a value to",
    entries: () => [
      {
        serviceId: "hookup.to/service/process-router",
        instanceId: "holder",
        state: { targetServiceUuid: "target" },
      },
      // After the router, which answers null: the pipeline never reaches it.
      { ...whoami("target") },
    ],
    watch: (scope) => {
      const [target] = scope.findServiceInstance("target");
      vi.spyOn(target!, "process");
    },
    answer: (_result, scope) => {
      const [target] = scope.findServiceInstance("target");
      return vi.mocked(target!.process).mock.results.at(-1)?.value;
    },
  },
];

async function run(
  holder: (typeof HOLDERS)[number],
  context: ProcessContext | null,
  user: User | null = OWNER,
) {
  const scope = await runtimeOf(holder.entries(), user);
  holder.watch?.(scope);
  const result = await processRuntime(scope, {}, null, context);
  return who(await holder.answer(result, scope));
}

describe.each(HOLDERS)("a service inside $name", (holder) => {
  it("is called by whoever the coordinator says began the run", async () => {
    const answer = await run(
      holder,
      continuedRun(
        {
          runId: "run-1",
          actor: {
            kind: "person",
            ...ANNA,
            expiresAt: Date.now() + 60_000,
          },
        },
        { requestId: "r" },
      ),
    );

    // Not the owner, in whose browser this is running.
    expect(answer).toEqual({ sub: ANNA.sub, email: ANNA.email });
  });

  it("is called by nobody in a run that arrived naming nobody", async () => {
    const answer = await run(
      holder,
      continuedRun({ runId: "run-1" }, { requestId: "r" }),
    );

    expect(answer).toEqual({ sub: null, email: null });
  });

  it("is called by whoever is signed in, in a run that began here", async () => {
    expect(await run(holder, null)).toEqual({
      sub: "auth0|owner",
      email: "owner@club.example",
    });
  });

  it("is called by nobody in a run that began here with nobody signed in", async () => {
    expect(await run(holder, null, null)).toEqual({ sub: null, email: null });
  });
});

it("configures a Configurator's target inside the run that reached it", async () => {
  const scope = await runtimeOf([
    {
      serviceId: "hookup.to/service/configurator",
      instanceId: "holder",
      state: { targetServiceUuid: "target" },
    },
    { serviceId: "hookup.to/service/map", instanceId: "target", state: {} },
  ]);
  const [target] = scope.findServiceInstance("target");
  let configuredIn: ProcessContext | undefined;
  vi.spyOn(target!, "configure").mockImplementation(() => {
    configuredIn = scope.app.currentContext?.(target!);
    return undefined;
  });
  const run: ProcessContext = {
    requestId: "",
    runId: "configure-run",
    actor: {
      kind: "person",
      ...ANNA,
      expiresAt: Date.now() + 60_000,
    },
  };

  await processRuntime(scope, { rows: 2 }, null, run);

  expect(configuredIn).toBe(run);
});

describe("a service inside a Feedback's pipeline", () => {
  // A Feedback drives its pipeline itself, from what the pipeline produces: it
  // is board-origin work, not a fresh gesture by whoever happens to be signed
  // in to the surrounding app.
  async function witnessIn(user: User | null) {
    const witness = whoami("witness");
    const scope = await runtimeOf(
      [
        {
          serviceId: "hookup.to/service/feedback",
          instanceId: "holder",
          state: { pipeline: [witness] },
        },
      ],
      user,
    );
    const [holder] = scope.findServiceInstance("holder");
    const feedback = holder as unknown as {
      _scopeBuilding: Promise<void> | null;
      getInnerInstance: (id: string) => { process: (x: unknown) => unknown };
    };
    await feedback._scopeBuilding;
    return feedback.getInnerInstance("witness");
  }

  it("does not acquire whoever is signed in to the app around it", async () => {
    const witness = await witnessIn(OWNER);

    expect(who(await witness.process({}))).toEqual({ sub: null, email: null });
  });

  it("sees nobody when nobody is", async () => {
    const witness = await witnessIn(null);

    expect(who(await witness.process({}))).toEqual({ sub: null, email: null });
  });
});

describe("signing in and out, as a nested service sees it", () => {
  it("is seen without the pipeline being rebuilt", async () => {
    const holder = HOLDERS[0];
    const scope = await runtimeOf(holder.entries(), null);

    expect(who(await processRuntime(scope, {}, null, null)).sub).toBeNull();
    scope.authenticatedUser = OWNER;
    expect(who(await processRuntime(scope, {}, null, null)).sub).toBe("auth0|owner");
    scope.authenticatedUser = null;
    expect(who(await processRuntime(scope, {}, null, null)).sub).toBeNull();
  });
});
