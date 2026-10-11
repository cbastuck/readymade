/**
 * A board that names a runtime server this client keeps none under.
 *
 * A name is resolved against the person's own remotes and nothing else, so one
 * they do not hold resolves to nothing — and the remedy is theirs alone: say
 * which of their servers the name means, or where one runs. So a restore that
 * meets such a name does not fail straight away. Whoever registered a prompt is
 * asked, and the answer is a remote the person now keeps under that name, which
 * is what the restore then resolves against. With no prompt registered, or an
 * answer of "none", the restore fails as it always did, naming the remote.
 *
 * Nothing here chooses. The name is the board's and resolves differently for
 * everyone, which is exactly why an unknown one is put to the person rather
 * than matched to whatever server looks suitable (`runtime/board/remote`).
 */
import { KnownRemote } from "../runtime/board/remote";

/** A name a board uses, and something that was waiting on it. */
export type UnknownRemote = {
  /** The name the board gave. */
  name: string;
  /** The runtime that wants it; one of them, if several do. */
  runtimeName: string;
  /** What kind of server the name stands for, when boards share it. */
  kind?: string;
};

/** The remote the person now keeps under the name, or null for none. */
export type RemoteAnswer = KnownRemote | null;

export type RemotePrompt = (wanted: UnknownRemote) => Promise<RemoteAnswer>;

// A stack rather than a slot, as for a server that gives no answer
// (`runtimeReach`): more than one board can be on a page.
const prompts: RemotePrompt[] = [];

/** Registers how to ask; returns how to stop being asked. */
export function registerRemotePrompt(prompt: RemotePrompt): () => void {
  prompts.push(prompt);
  return () => {
    const index = prompts.lastIndexOf(prompt);
    if (index >= 0) {
      prompts.splice(index, 1);
    }
  };
}

// One question per name. A board restores its runtimes at once, and four of
// them on `node` are one thing to ask somebody, not four.
const asking = new Map<string, Promise<RemoteAnswer>>();

/**
 * Asks which runtime server `wanted.name` is, and answers with the remote the
 * person keeps under it from now on — or null when nobody could be asked or
 * they said none.
 */
export function askAboutRemote(wanted: UnknownRemote): Promise<RemoteAnswer> {
  const prompt = prompts[prompts.length - 1];
  if (!prompt) {
    return Promise.resolve(null);
  }
  const pending = asking.get(wanted.name);
  if (pending) {
    return pending;
  }
  const asked = prompt(wanted)
    .catch((): RemoteAnswer => null)
    .finally(() => asking.delete(wanted.name));
  asking.set(wanted.name, asked);
  return asked;
}

/** For tests. */
export function resetRemotePrompt(): void {
  prompts.length = 0;
  asking.clear();
}
