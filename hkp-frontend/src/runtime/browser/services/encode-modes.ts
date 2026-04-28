export const ENCODE_MODES = [
  "base64-encode",
  "base64-decode",
  "url-encode",
  "url-decode",
  "hex-encode",
  "hex-decode",
] as const;

export type EncodeMode = (typeof ENCODE_MODES)[number];
