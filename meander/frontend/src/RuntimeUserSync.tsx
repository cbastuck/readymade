import { useEffect } from "react";

import { useAppContext } from "hkp-frontend/src/AppContext";
import { usePlatform } from "hkp-frontend/src/platform/PlatformContext";

// Keeps the host's embedded-runtime allow-list in sync with the signed-in user.
// Renders nothing. On platforms that implement setRuntimeAllowedUser (iOS) this
// pushes the owner's email to the native runtime so it admits their other
// devices; null on sign-out re-locks it. No-op everywhere else.
export default function RuntimeUserSync() {
  const { user } = useAppContext();
  const platform = usePlatform();
  const email = user?.email ?? null;

  useEffect(() => {
    platform.setRuntimeAllowedUser?.(email);
  }, [platform, email]);

  return null;
}
