/** What Detect looks for. Each mode reports its findings under its own key. */
export const DETECT_MODES = ["face"] as const;
export type DetectMode = (typeof DETECT_MODES)[number];

export const DETECT_LABELS: { [mode in DetectMode]: string } = {
  face: "Faces",
};
