/**
 * Client for the cloud board storage (hkp-website api/boards.php): boards
 * uploaded per user to PostgreSQL, shareable read-only with other people by
 * email. Distinct from the coordinator "cloud boards" (running runtimes) —
 * this is persistence, not execution.
 *
 * Every call needs the Auth0 ID token from the shared cloud login
 * (AppContext user.idToken); the endpoint verifies issuer + audience.
 * The default base URL is same-origin `/api`, which is right for the
 * website; hosts on other origins (Meander) pass an absolute `baseUrl`.
 */

export interface CloudBoardsOptions {
  idToken: string;
  /** e.g. "https://hookitapp.com/api"; defaults to same-origin "/api". */
  baseUrl?: string;
}

export interface CloudBoardSummary {
  id: string;
  name: string;
  ownerEmail: string | null;
  metadata: Record<string, unknown> | null;
  hasImage: boolean;
  /** "owner" for own boards, "viewer" for boards shared with the caller. */
  role: "owner" | "viewer";
  /** Share recipients; only present on boards the caller owns. */
  sharedWith?: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface CloudBoard extends CloudBoardSummary {
  /** The board JSON (runtimes, services, facade …). */
  data: Record<string, unknown>;
  /** Share recipients; present only when the caller is the owner. */
  sharedWith?: string[];
}

export interface CloudBoardUpload {
  name: string;
  data: Record<string, unknown>;
  /** App-level extras (description, artwork descriptor, …). Omitting it on a
   *  re-upload keeps the stored metadata. */
  metadata?: Record<string, unknown>;
}

function endpoint(options: CloudBoardsOptions, query = ""): string {
  return `${options.baseUrl ?? "https://readymadeit.com/api"}/boards.php${query}`;
}

function headers(options: CloudBoardsOptions): Record<string, string> {
  return {
    Authorization: `Bearer ${options.idToken}`,
    "Content-Type": "application/json",
  };
}

/** Resolves the response body, or throws with the endpoint's error reason. */
async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const reason = await res
      .json()
      .then((data: { error?: string }) => data.error)
      .catch(() => undefined);
    throw new Error(reason || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

/** Boards the user owns plus boards shared with their (verified) email. */
export async function listCloudBoards(
  options: CloudBoardsOptions,
): Promise<CloudBoardSummary[]> {
  const res = await fetch(endpoint(options), { headers: headers(options) });
  const { boards } = await jsonOrThrow<{ boards: CloudBoardSummary[] }>(res);
  return boards;
}

export async function getCloudBoard(
  options: CloudBoardsOptions,
  id: string,
): Promise<CloudBoard> {
  const res = await fetch(endpoint(options, `?id=${encodeURIComponent(id)}`), {
    headers: headers(options),
  });
  return jsonOrThrow<CloudBoard>(res);
}

/** Creates the board, or updates it when the user already has one with that
 *  name. Returns the board's cloud id for follow-up calls (share, image). */
export async function upsertCloudBoard(
  options: CloudBoardsOptions,
  board: CloudBoardUpload,
): Promise<{ id: string; name: string; createdAt: string; updatedAt: string }> {
  const res = await fetch(endpoint(options), {
    method: "PUT",
    headers: headers(options),
    body: JSON.stringify(board),
  });
  return jsonOrThrow(res);
}

/** Stores the (already downscaled) artwork with the board. Owner only. */
export async function uploadCloudBoardImage(
  options: CloudBoardsOptions,
  id: string,
  image: Blob,
): Promise<void> {
  const res = await fetch(
    endpoint(options, `?id=${encodeURIComponent(id)}&image=1`),
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${options.idToken}`,
        "Content-Type": "application/octet-stream",
      },
      body: image,
    },
  );
  await jsonOrThrow(res);
}

/** Fetches the board's artwork (needs the auth header, so no plain <img>). */
export async function fetchCloudBoardImage(
  options: CloudBoardsOptions,
  id: string,
): Promise<Blob | null> {
  const res = await fetch(
    endpoint(options, `?id=${encodeURIComponent(id)}&image=1`),
    { headers: { Authorization: `Bearer ${options.idToken}` } },
  );
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Request failed (${res.status})`);
  }
  return res.blob();
}

/** Grants (read-only) access to the person with this email. Owner only. */
export async function shareCloudBoard(
  options: CloudBoardsOptions,
  id: string,
  email: string,
): Promise<void> {
  const res = await fetch(
    endpoint(options, `?id=${encodeURIComponent(id)}&action=share`),
    {
      method: "POST",
      headers: headers(options),
      body: JSON.stringify({ email }),
    },
  );
  await jsonOrThrow(res);
}

export async function unshareCloudBoard(
  options: CloudBoardsOptions,
  id: string,
  email: string,
): Promise<void> {
  const res = await fetch(
    endpoint(options, `?id=${encodeURIComponent(id)}&action=unshare`),
    {
      method: "POST",
      headers: headers(options),
      body: JSON.stringify({ email }),
    },
  );
  await jsonOrThrow(res);
}

export async function deleteCloudBoard(
  options: CloudBoardsOptions,
  id: string,
): Promise<void> {
  const res = await fetch(endpoint(options, `?id=${encodeURIComponent(id)}`), {
    method: "DELETE",
    headers: headers(options),
  });
  await jsonOrThrow(res);
}
