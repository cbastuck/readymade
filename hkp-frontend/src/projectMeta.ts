/**
 * Metadata about the project itself — where its source lives and how to point
 * at parts of it. Not application logic: nothing here depends on the state of
 * a board, a runtime, or the UI.
 */

/** Public source repository. */
export const REPO_URL = "https://github.com/cbastuck/readymade";

/** Web address of a commit in the source repository, for linking a build hash.
 *  Undefined for anything that is not a hash — a build made outside a git
 *  checkout reports "dev". */
export function commitUrl(hash?: string): string | undefined {
  if (!hash || !/^[0-9a-f]{7,40}$/i.test(hash)) {
    return undefined;
  }
  return `${REPO_URL}/commit/${hash}`;
}
