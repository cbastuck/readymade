/** When a change in the watched value lets the input through. */
export const EMIT_MODES = ["change", "rise", "fall"] as const;
export type EmitMode = (typeof EMIT_MODES)[number];

export const EMIT_LABELS: { [mode in EmitMode]: string } = {
  change: "Any change",
  rise: "Becomes true",
  fall: "Becomes false",
};
