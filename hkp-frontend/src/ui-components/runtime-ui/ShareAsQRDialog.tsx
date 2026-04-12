import { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import {
  RuntimeDescriptor,
  RuntimeScope,
  ServiceDescriptor,
} from "hkp-frontend/src/types";
import BrowserRuntimeApi from "hkp-frontend/src/runtime/browser/BrowserRuntimeApi";
import ShareQRCodeDialog from "hkp-frontend/src/components/ShareQRCodeDialog";
import { resolveTemplateVars } from "hkp-frontend/src/templateVars";

import shareAsQRActionJson from "./actions/share-as-qr.json";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  runtimeSource: object | null;
};

function loadQRPipelineServices(): ServiceDescriptor[] {
  // Resolve HKP_WEBAPP_URL (and any other template vars) in the action board JSON.
  const resolved = JSON.parse(
    resolveTemplateVars(JSON.stringify(shareAsQRActionJson)),
  );
  // Each service gets a fresh UUID so parallel dialogs don't share instance IDs.
  return (resolved.services as ServiceDescriptor[]).map((svc) => ({
    ...svc,
    uuid: uuidv4(),
  }));
}

export default function ShareAsQRDialog({
  isOpen,
  onClose,
  runtimeSource,
}: Props) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const scopeRef = useRef<RuntimeScope | null>(null);
  const runtimeRef = useRef<RuntimeDescriptor | null>(null);

  useEffect(() => {
    if (!isOpen || !runtimeSource) return;

    let cancelled = false;

    async function setup() {
      const runtimeDescriptor: RuntimeDescriptor = {
        id: uuidv4(),
        type: "browser",
        name: "Share as QR",
      };

      const result = await BrowserRuntimeApi.restoreRuntime(
        runtimeDescriptor,
        loadQRPipelineServices(),
        null,
      );
      if (!result || cancelled) return;

      const { scope, runtime } = result;
      scopeRef.current = scope;
      runtimeRef.current = runtime;

      scope.onResult = async (_instanceId: string | null, url: unknown) => {
        if (!cancelled) {
          setQrUrl(typeof url === "string" ? url : JSON.stringify(url));
        }
      };

      await BrowserRuntimeApi.processRuntime(scope, runtimeSource, null);
    }

    setQrUrl(null);
    setup();

    return () => {
      cancelled = true;
    };
  }, [isOpen, runtimeSource]);

  // Clean up the transient runtime when the dialog closes.
  useEffect(() => {
    if (isOpen) return;
    const scope = scopeRef.current;
    const runtime = runtimeRef.current;
    if (scope && runtime) {
      BrowserRuntimeApi.removeRuntime(scope, runtime, null);
      scopeRef.current = null;
      runtimeRef.current = null;
    }
    setQrUrl(null);
  }, [isOpen]);

  return (
    <ShareQRCodeDialog
      title="Share as QR"
      isOpen={isOpen}
      url={qrUrl}
      onClose={onClose}
    />
  );
}
