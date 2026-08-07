/**
 * Copying text to the clipboard, in one place.
 *
 * The async Clipboard API is only available in a secure context, which the
 * hosts these boards run in do not all provide (a packaged app on a custom
 * scheme, a runtime reached over plain http on a LAN). The hidden-selection
 * fallback still works there, so callers get one call that either copies or
 * reports that it could not.
 */
export async function copyToClipboard(value: string): Promise<boolean> {
  if (!value) {
    return false;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to the legacy copy method.
  }

  const input = document.createElement("textarea");
  input.value = value;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.focus();
  input.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(input);
  }
}
