/**
 * A runtime server that gives this page no answer.
 *
 * Two things produce that, and a page cannot tell them apart: the server is
 * not running, or it is running and does not allow pages from this page's
 * origin. The second is deliberate — a server that refuses a page answers it
 * with nothing the page can read, so that a site somebody merely has open
 * learns nothing about what runs on their machine (`origins.ts` in hkp-node,
 * `origins.py` in hkp-python, `origins.h` in hkp-rt).
 *
 * Either way the remedy is at the server's end, and the person at this page
 * is the one who can apply it. So a request that fails this way is not turned
 * into an error straight away: whoever registered a prompt is asked, says what
 * to change and waits, and the request is made again once the server answers.
 * With no prompt registered the failure is reported as it always was.
 */

/** A server that did not answer, and something that was waiting on it. */
export type UnreachableServer = {
  /** The server's address, as the board resolved it. */
  url: string;
  /** The runtime that was being reached; one of them, if several were. */
  runtimeName: string;
};

/** Try the request again, or let it fail. */
export type ReachDecision = "retry" | "give-up";

export type ReachPrompt = (server: UnreachableServer) => Promise<ReachDecision>;

// A stack rather than a slot: more than one board can be on a page, each with
// its own dialog, and the one that leaves must not take the others' with it.
const prompts: ReachPrompt[] = [];

/** Registers how to ask; returns how to stop being asked. */
export function registerReachPrompt(prompt: ReachPrompt): () => void {
  prompts.push(prompt);
  return () => {
    const index = prompts.lastIndexOf(prompt);
    if (index >= 0) {
      prompts.splice(index, 1);
    }
  };
}

// One question per server. A board restores its runtimes at once, and three
// of them on a server that is down are one thing to tell somebody, not three.
const asking = new Map<string, Promise<ReachDecision>>();

function serverKey(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

function askAbout(server: UnreachableServer): Promise<ReachDecision> {
  const prompt = prompts[prompts.length - 1];
  if (!prompt) {
    return Promise.resolve("give-up");
  }
  const key = serverKey(server.url);
  const pending = asking.get(key);
  if (pending) {
    return pending;
  }
  const asked = prompt(server)
    .catch((): ReachDecision => "give-up")
    .finally(() => asking.delete(key));
  asking.set(key, asked);
  return asked;
}

/**
 * Whether a failed request is the kind this is about: no answer at all.
 *
 * `fetch` rejects with a TypeError when nothing could be read — the connection
 * was refused, or the browser withheld a response the server did not open to
 * this page. A response with a status, however unwelcome, is an answer.
 */
function isNoAnswer(error: unknown): boolean {
  return error instanceof TypeError;
}

/** Only a server reached over the network can refuse a page for its origin. */
function isNetworkAddress(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/**
 * Makes `request` to the server at `url`, and when it gets no answer asks
 * whether to make it again — for as long as the answer is yes.
 */
export async function requestFromServer(
  server: UnreachableServer,
  request: () => Promise<Response>,
): Promise<Response> {
  for (;;) {
    try {
      return await request();
    } catch (error) {
      if (!isNoAnswer(error) || !isNetworkAddress(server.url)) {
        throw error;
      }
      if ((await askAbout(server)) !== "retry") {
        throw error;
      }
    }
  }
}

/**
 * Whether the server at `url` answers this page now.
 *
 * Any answer counts, a refusal for want of a token included: what is being
 * asked is whether the page may talk to the server, not whether the person
 * may use it. Sent with nothing a browser would ask permission for first, so
 * it is the server's own answer that is read.
 */
export async function reachesServer(url: string): Promise<boolean> {
  try {
    await fetch(`${url.replace(/\/+$/, "")}/runtimes`);
    return true;
  } catch {
    return false;
  }
}

const APP_ORIGINS = [
  "saucer://embedded",
  "hkp://app",
  "https://appassets.androidplatform.net",
];

/** True for the origin of a page, or a server, on the machine itself. */
function isLoopbackOrigin(origin: string): boolean {
  const match = /^https?:\/\/(\[[^\]]*\]|[^:/]+)(?::\d+)?$/.exec(
    origin.toLowerCase(),
  );
  if (!match) {
    return false;
  }
  const host = match[1];
  return (
    host === "localhost" ||
    host === "[::1]" ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
  );
}

/**
 * Whether a runtime server allows pages from `origin` without being told: the
 * Readymade apps, and pages served from the machine itself. A copy of what the
 * servers decide, kept only to say the right thing to somebody — for such a
 * page "not running" is the likely cause, and for any other the server has to
 * be told first.
 */
export function isAllowedUnasked(origin: string): boolean {
  return (
    APP_ORIGINS.includes(origin.toLowerCase()) || isLoopbackOrigin(origin)
  );
}

/**
 * Whether the browser itself stops this page from calling `url`: a page loaded
 * over https may not call http, except on the machine it is shown on. That
 * failure looks like the other two and has a different remedy.
 */
export function isBlockedAsMixedContent(pageUrl: string, url: string): boolean {
  try {
    const page = new URL(pageUrl);
    const target = new URL(url);
    return (
      page.protocol === "https:" &&
      target.protocol === "http:" &&
      !isLoopbackOrigin(target.origin)
    );
  } catch {
    return false;
  }
}

/** For tests. */
export function resetRuntimeReach(): void {
  prompts.length = 0;
  asking.clear();
}
