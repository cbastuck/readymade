/**
 * The methods `http-client` accepts, in their own module so the service and its
 * panel can each read them without importing the other.
 *
 * Lower case, as every runtime's client stores them, so a board moved between
 * runtimes keeps the method it was saved with.
 */
export const METHODS = ["get", "post", "put", "patch", "delete"] as const;

export type HttpMethod = (typeof METHODS)[number];
