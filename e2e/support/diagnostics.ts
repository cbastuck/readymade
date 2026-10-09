/** Do not put session/capability tokens in the additional diagnostic artifacts. */
export function redact(text: string): string {
  return text
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer [redacted]")
    .replace(/([?&](?:access_token|token|ticket)=)[^&\s"']+/gi, "$1[redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, "[redacted JWT]");
}

export function safeUrl(value: string): string {
  try {
    const url = new URL(value);
    // Requests are identified by origin/path. Bodies, credentials and query
    // values are not needed to diagnose which dependency failed.
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return redact(value);
  }
}
