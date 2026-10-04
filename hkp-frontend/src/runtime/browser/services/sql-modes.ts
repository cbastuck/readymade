/**
 * The SQL service's modes and emit choices, shared by the service and its
 * panel. A module of their own so the panel need not import the service, which
 * imports the panel.
 */

export const MODES = [
  "query",
  "run",
  "exec",
  "databases",
  "export",
  "import",
] as const;
export type SqlMode = (typeof MODES)[number];

/** The modes that run the configured statement, and need one. */
export const STATEMENT_MODES: readonly SqlMode[] = ["query", "run", "exec"];

/** Whether the statement's result travels onward, or the input it ran on. */
export const EMITS = ["result", "input"] as const;
export type SqlEmit = (typeof EMITS)[number];
