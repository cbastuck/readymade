import { inProcessRuntime } from "hkp-frontend/src/core/secretConsent";
import SharedSecretConsentDialog from "hkp-frontend/src/ui-components/SecretConsentDialog";

/**
 * The address of the runtime this app embeds, as this app knows it.
 *
 * `inProcessRuntime` knows what an in-process address looks like; the port it
 * is bound to is the one thing only the host can say.
 */
function isEmbeddedRuntime(url: string): boolean {
  return inProcessRuntime(url, (window as any).__MEANDER_CONFIG__?.runtimePort);
}

/** The consent prompt, with the embedded runtime exempt from it. */
export default function SecretConsentDialog() {
  return <SharedSecretConsentDialog isInProcess={isEmbeddedRuntime} />;
}
