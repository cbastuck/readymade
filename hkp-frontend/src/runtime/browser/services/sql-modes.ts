/**
 * The SQL service's modes and emit choices, shared by the service and its
 * panel. A module of their own so the panel need not import the service, which
 * imports the panel.
 */

export const MODES = ["query", "run", "exec"] as const;
export type SqlMode = (typeof MODES)[number];

/** Whether the statement's result travels onward, or the input it ran on. */
export const EMITS = ["result", "input"] as const;
export type SqlEmit = (typeof EMITS)[number];
