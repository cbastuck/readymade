/**
 * The address a browser opens an authenticated WebSocket at.
 *
 * A browser cannot set a header on a WebSocket handshake, so the token that
 * authenticates every other request would have to ride in the socket's
 * address — and an address is what proxies and access logs keep. So the token
 * buys a ticket first (`POST <server>/ws-tickets`, the token in the
 * `Authorization` header like any request), and the socket is opened with
 * `?ticket=`: good for one socket, for seconds, and worth nothing once written
 * down. Every runtime server and the coordinator issue them
 * (hkp-node `src/wsTickets.ts`, hkp-python `ws_tickets.py`, hkp-rt
 * `http/ws_tickets.h`).
 *
 * A server from before tickets answers the request with "not found", and is
 * given the token in the address as it always was. A ticket that cannot be had
 * for any other reason leaves the socket without a credential: the server then
 * refuses it, which is what a token it does not accept would have led to too.
 */

/** Where the server whose REST base is `base` hands out tickets. */
export function ticketUrlFor(base: string): string {
  return `${base.replace(/\/+$/, "")}/ws-tickets`;
}

function withParam(wsUrl: string, name: string, value: string): string {
  const url = new URL(wsUrl);
  url.searchParams.set(name, value);
  return url.toString();
}

/**
 * `wsUrl`, carrying what lets the caller in: a ticket from `ticketUrl`, the
 * token itself for a server that issues none, or nothing without a token.
 */
export async function authenticatedSocketUrl(
  wsUrl: string,
  ticketUrl: string,
  token: string | null | undefined,
): Promise<string> {
  if (!token) {
    return wsUrl;
  }
  try {
    const response = await fetch(ticketUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const { ticket } = (await response.json()) as { ticket?: unknown };
      if (typeof ticket === "string" && ticket) {
        return withParam(wsUrl, "ticket", ticket);
      }
    } else if (response.status === 404 || response.status === 405) {
      return withParam(wsUrl, "access_token", token);
    }
  } catch {
    // Unreachable for a ticket, so most likely for the socket too; see above.
  }
  return wsUrl;
}
