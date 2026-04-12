// Populated by the Meander C++ host via webview->inject() at page creation time.
// Undefined when running in a plain browser (e.g. a phone opening the webapp).
declare const __MEANDER_CONFIG__: Record<string, any> | undefined;

function getMeanderConfig(): Record<string, any> {
  return typeof __MEANDER_CONFIG__ !== "undefined" ? __MEANDER_CONFIG__ : {};
}

/**
 * Returns the current map of template variable names to their resolved values,
 * e.g. { HKP_WEBAPP_URL: "http://192.168.1.5:9090", HKP_RUNTIME_URL: "..." }.
 * Returns an empty object when the host config is not available.
 */
export function getTemplateVarMap(): Record<string, string> {
  const config = getMeanderConfig();
  if (!config.lanIp) return {};
  return {
    HKP_WEBAPP_URL: `http://${config.lanIp}:${config.frontendPort}`,
    HKP_RUNTIME_URL: `http://${config.lanIp}:${config.apiPort}`,
    HKP_RUNTIME_HOST: config.lanIp,
  };
}

/**
 * Replaces HKP_WEBAPP_URL and HKP_RUNTIME_URL template variables in a string
 * using config injected by the host at startup. Returns the string unchanged if
 * the config is not available (e.g. plain browser context).
 */
export function resolveTemplateVars(value: string): string {
  const vars = getTemplateVarMap();
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
