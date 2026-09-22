const COORDINATOR_PATH = "/coordinator";

/** A server's base URL: trimmed, without trailing slashes or the coordinator
 *  path, so a coordinator's own URL can be pasted where a server's is asked. */
export function toServerBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  return trimmed.endsWith(COORDINATOR_PATH)
    ? trimmed.slice(0, -COORDINATOR_PATH.length)
    : trimmed;
}

/** The coordinator endpoint of the server at `url` — `<base>/coordinator`,
 *  whether or not `url` already names it. */
export function toCoordinatorUrl(url: string): string {
  return `${toServerBaseUrl(url)}${COORDINATOR_PATH}`;
}
