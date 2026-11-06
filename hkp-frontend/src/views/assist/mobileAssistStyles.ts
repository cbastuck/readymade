import type { CSSProperties } from "react";

import { M } from "../playground/mobile/tokens";

export const sectionLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: M.textMuted,
  margin: "20px 4px 8px",
};

/** A button of the page: the one to press, or one beside it. */
export function button(tone: "primary" | "plain", enabled: boolean): CSSProperties {
  return {
    flex: 1,
    padding: "12px 14px",
    borderRadius: 12,
    border: tone === "plain" ? `1px solid ${M.borderStrong}` : "none",
    background: tone === "primary" ? (enabled ? M.teal : M.border) : M.card,
    color: tone === "primary" ? "#fff" : M.textPrimary,
    fontSize: 15,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: enabled ? "pointer" : "default",
    opacity: tone === "plain" && !enabled ? 0.5 : 1,
  };
}

/**
 * The connection notice and confirmations are the desktop's own components,
 * so what they say is written once; this sizes them for a finger.
 */
export const confirmCss = `
.hkp-assist-mobile .hkp-assist-confirm {
  margin: 0 0 12px;
  padding: 12px 14px;
  border: 1px solid ${M.danger};
  border-radius: 12px;
  background: ${M.card};
  font-size: 14px;
  line-height: 1.45;
}
.hkp-assist-mobile .hkp-assist-confirm p,
.hkp-assist-mobile .hkp-assist-confirm ul { margin: 6px 0; }
.hkp-assist-mobile .hkp-assist-confirm ul { padding-left: 18px; }
.hkp-assist-mobile .hkp-assist-confirm code { overflow-wrap: anywhere; font-size: 12.5px; }
.hkp-assist-mobile .hkp-assist-confirm .hkp-assist-row { display: flex; gap: 10px; margin-top: 10px; }
.hkp-assist-mobile .hkp-assist-confirm button {
  flex: 1;
  padding: 11px 12px;
  border-radius: 10px;
  border: 1px solid ${M.borderStrong};
  background: ${M.card};
  color: ${M.textPrimary};
  font: inherit;
  font-weight: 600;
}
`;
