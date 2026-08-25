// Populated by the Readymade C++ host via webview->inject() at page creation time.
// Undefined when running in a plain browser (e.g. a phone opening the webapp).
declare const __MEANDER_CONFIG__: Record<string, any> | undefined;

function getMeanderConfig(): Record<string, any> {
  return typeof __MEANDER_CONFIG__ !== "undefined" ? __MEANDER_CONFIG__ : {};
}

/**
 * Returns the current map of template variable names to their resolved values,
 * e.g. { HKP_WEBAPP_URL: "http://192.168.1.5:9090", HKP_RUNTIME_URL: "..." }.
 * Returns an empty object when the host config is not available.
 *
 * These are the host's addresses, which a receiving device cannot derive on its
 * own — that is what makes them worth carrying to a partner board. For plain
 * substitution use resolveTemplateVars, which also covers the browser case.
 */
export function getTemplateVarMap(): Record<string, string> {
  const config = getMeanderConfig();
  if (!config.lanIp) {
    return {};
  }
  return {
    HKP_WEBAPP_URL: `http://${config.lanIp}:${config.frontendPort}`,
    HKP_RUNTIME_URL: `http://${config.lanIp}:${config.apiPort}`,
    HKP_RUNTIME_HOST: config.lanIp,
  };
}

/**
 * Returns the origin the webapp is served from, used as the value of
 * HKP_WEBAPP_URL when the host has not injected its LAN address. Empty when
 * there is no document to read an origin from.
 */
function getWebappOrigin(): string {
  return typeof window !== "undefined" ? window.location.origin : "";
}

/**
 * Returns the map used to substitute template variables. This is the host
 * config map, plus a HKP_WEBAPP_URL falling back to the origin the webapp is
 * served from, so a link built in a plain browser is still absolute.
 */
function getResolutionMap(): Record<string, string> {
  const vars = getTemplateVarMap();
  if (!vars.HKP_WEBAPP_URL) {
    const origin = getWebappOrigin();
    if (origin) {
      return { ...vars, HKP_WEBAPP_URL: origin };
    }
  }
  return vars;
}

/**
 * Replaces HKP_WEBAPP_URL and HKP_RUNTIME_URL template variables in a string
 * using config injected by the host at startup. HKP_WEBAPP_URL falls back to
 * the webapp's own origin; the runtime variables are left in place when the
 * host config is not available (e.g. plain browser context).
 */
export function resolveTemplateVars(value: string): string {
  const vars = getResolutionMap();
  for (const [key, resolved] of Object.entries(vars)) {
    value = value.split(key).join(resolved);
  }
  return value;
}

/**
 * Resolves all template variables inside an arbitrary JSON-serialisable object.
 * Serialises to JSON, substitutes all known variable names, then parses back.
 * The return type matches the input type so callers stay fully typed.
 */
export function resolveTemplateVarsInObject<T>(obj: T): T {
  return JSON.parse(resolveTemplateVars(JSON.stringify(obj))) as T;
}

/**
 * Returns true when the given URL (after template variable resolution) points
 * to the local machine (localhost / 127.0.0.1 / ::1).
 *
 * Use this to decide whether a runtime should be excluded from a partner board
 * link: localhost runtimes are specific to the originator's machine and cannot
 * be reached by a partner on a different device.
 */
export function isLocalhostUrl(url: string | undefined): boolean {
  if (!url) {
    return false;
  }
  const resolved = resolveTemplateVars(url);
  try {
    const { hostname } = new URL(resolved);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    );
  } catch {
    return false;
  }
}
