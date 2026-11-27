/**
 * A board that needs a resource nobody has bound yet, and where the person's
 * answers are kept.
 *
 * A board says *what* it needs from outside Readymade — an Ollama server, a
 * Postgres database, an S3 bucket — by kind (`runtime/board/resources`).
 * Providing one is the host's and the person's: starting one locally, finding
 * an installed one, or naming an address.
 *
 * The answer is kept per board and resource id, so opening the board again
 * binds the same one. When a board opens with a resource that has no binding,
 * whoever registered a prompt is asked. Answering `null` ("Not now") leaves
 * the board loading, with the services that need the resource reporting that
 * it is not bound when they resolve it — unlike an unknown remote, an unbound
 * resource does not stop the board from opening (`plans/TODO-RESOURCES.md` §3).
 */
import {
  ResourceBinding,
  ResourceDescriptor,
  readResourceBinding,
} from "../runtime/board/resources";

/** A resource a board declares and this client has no binding for yet. */
export type UnboundResource = {
  /** The board asking. */
  boardName: string;
  /** What the board asked for: id, kind, and any requested models/version/buckets. */
  resource: ResourceDescriptor;
};

/** The binding the person chose, or null for "Not now". */
export type ResourceAnswer = ResourceBinding | null;

export type ResourcePrompt = (wanted: UnboundResource) => Promise<ResourceAnswer>;

export type ResourceBindingStore = {
  get(boardName: string, resourceId: string): ResourceBinding | null;
  set(boardName: string, binding: ResourceBinding): void;
  delete(boardName: string, resourceId: string): void;
  list(boardName: string): ResourceBinding[];
};

const STORAGE_PREFIX = "hkp.resource-bindings";

export function bindingKey(boardName: string, resourceId: string): string {
  return JSON.stringify([boardName || "(unsaved)", resourceId]);
}

const localBindingStore: ResourceBindingStore = {
  get(boardName: string, resourceId: string): ResourceBinding | null {
    try {
      const raw = window.localStorage.getItem(
        `${STORAGE_PREFIX}:${bindingKey(boardName, resourceId)}`,
      );
      if (!raw) {
        return null;
      }
      return readResourceBinding(JSON.parse(raw), resourceId);
    } catch {
      return null;
    }
  },
  set(boardName: string, binding: ResourceBinding): void {
    try {
      window.localStorage.setItem(
        `${STORAGE_PREFIX}:${bindingKey(boardName, binding.id)}`,
        JSON.stringify(binding),
      );
    } catch {
      // Session-only when storage is unavailable.
    }
  },
  delete(boardName: string, resourceId: string): void {
    try {
      window.localStorage.removeItem(
        `${STORAGE_PREFIX}:${bindingKey(boardName, resourceId)}`,
      );
    } catch {
      // Ignore storage errors.
    }
  },
  list(boardName: string): ResourceBinding[] {
    const found: ResourceBinding[] = [];
    try {
      const prefix = `${STORAGE_PREFIX}:`;
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (!key || !key.startsWith(prefix)) {
          continue;
        }
        const parts = JSON.parse(key.slice(prefix.length));
        if (
          Array.isArray(parts) &&
          parts.length === 2 &&
          parts[0] === (boardName || "(unsaved)") &&
          typeof parts[1] === "string"
        ) {
          const raw = window.localStorage.getItem(key);
          const binding = raw ? readResourceBinding(JSON.parse(raw), parts[1]) : null;
          if (binding) {
            found.push(binding);
          }
        }
      }
    } catch {
      return [];
    }
    return found;
  },
};

let store: ResourceBindingStore = localBindingStore;

export function setResourceBindingStore(next: ResourceBindingStore | null): void {
  store = next ?? localBindingStore;
}

export function resourceBindingStore(): ResourceBindingStore {
  return store;
}

const prompts: ResourcePrompt[] = [];

/** Registers how to ask; returns how to stop being asked. */
export function registerResourcePrompt(prompt: ResourcePrompt): () => void {
  prompts.push(prompt);
  return () => {
    const index = prompts.lastIndexOf(prompt);
    if (index >= 0) {
      prompts.splice(index, 1);
    }
  };
}

const asking = new Map<string, Promise<ResourceAnswer>>();

/**
 * Asks how to bind `wanted.resource` for `wanted.boardName`, keeps a binding
 * the person gives in the binding store, and returns it — or null when nobody
 * could be asked or they chose "Not now".
 */
export function askAboutResource(wanted: UnboundResource): Promise<ResourceAnswer> {
  const prompt = prompts[prompts.length - 1];
  if (!prompt) {
    return Promise.resolve(null);
  }
  const key = bindingKey(wanted.boardName, wanted.resource.id);
  const pending = asking.get(key);
  if (pending) {
    return pending;
  }
  const asked = prompt(wanted)
    .then((answer) => {
      if (answer && answer.kind === wanted.resource.kind) {
        const normalized: ResourceBinding = { ...answer, id: wanted.resource.id };
        store.set(wanted.boardName, normalized);
        return normalized;
      }
      return null;
    })
    .catch((): ResourceAnswer => null)
    .finally(() => asking.delete(key));
  asking.set(key, asked);
  return asked;
}

/**
 * Ensures every resource declared by `resources` has a binding looked up (or
 * asked for, when a prompt is registered), and returns the bindings that are
 * available for this board. Unbound resources are omitted rather than throwing:
 * the board still loads, and services naming an unbound resource report it when
 * they resolve it.
 */
export async function ensureBoardResourceBindings(
  boardName: string,
  resources: ResourceDescriptor[] | undefined,
  from: ResourceBindingStore = store,
): Promise<ResourceBinding[]> {
  if (!resources?.length) {
    return [];
  }
  const bindings: ResourceBinding[] = [];
  for (const descriptor of resources) {
    const existing = from.get(boardName, descriptor.id);
    if (existing && existing.kind === descriptor.kind) {
      bindings.push(existing);
      continue;
    }
    const answered = await askAboutResource({ boardName, resource: descriptor });
    if (answered && answered.kind === descriptor.kind) {
      bindings.push(answered);
    }
  }
  return bindings;
}

/** For tests. */
export function resetResourcePrompt(): void {
  prompts.length = 0;
  asking.clear();
  store = localBindingStore;
}
