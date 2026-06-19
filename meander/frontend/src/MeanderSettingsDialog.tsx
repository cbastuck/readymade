import { useState } from "react";
import { Check, Copy, Globe, Lock } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "hkp-frontend/src/ui-components/primitives/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "hkp-frontend/src/ui-components/primitives/tabs";

type MeanderConfig = {
  lanIp?: string;
  runtimePort?: number;
  allowExternalAccess?: boolean;
  // Legacy fields, present on older backends: apiPort is the real runtime port
  // when external access is on, otherwise 0.
  apiPort?: number;
};

function getMeanderConfig(): MeanderConfig {
  return ((window as any).__MEANDER_CONFIG__ as MeanderConfig) ?? {};
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function MeanderSettingsDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[90vw]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="about">
          <TabsList>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>
          <TabsContent value="about">
            <AboutTab />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function AboutTab() {
  const config = getMeanderConfig();
  // Prefer the explicit fields; fall back to the legacy apiPort (real port when
  // exposed, 0 otherwise) so the tab works against older backend builds too.
  const exposed =
    config.allowExternalAccess ?? ((config.apiPort ?? 0) > 0);
  const port = config.runtimePort ?? (config.apiPort || undefined);

  // localhost-only binds 127.0.0.1; LAN mode binds 0.0.0.0 and is reachable at
  // the LAN IP. Fall back to the LAN IP only when it is actually exposed.
  const host = exposed ? (config.lanIp ?? "127.0.0.1") : "127.0.0.1";
  const runtimeUrl = port ? `http://${host}:${port}` : null;

  return (
    <div className="flex flex-col gap-4 pt-2 text-sm">
      <div className="flex flex-col gap-1.5">
        <span className="uppercase tracking-[0.12em] text-muted-foreground text-[0.68rem] font-semibold">
          Runtime server
        </span>
        {runtimeUrl ? (
          <CopyableUrl url={runtimeUrl} />
        ) : (
          <span className="text-muted-foreground">Not available</span>
        )}
      </div>

      <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
        {exposed ? (
          <Globe size={16} className="mt-0.5 shrink-0 text-slate-500" />
        ) : (
          <Lock size={16} className="mt-0.5 shrink-0 text-slate-500" />
        )}
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-slate-800">
            {exposed ? "Exposed to local network" : "Local only"}
          </span>
          <span className="text-[0.8rem] text-slate-500 leading-snug">
            {exposed
              ? "Other devices on this network can connect to this runtime at the URL above."
              : "The runtime is bound to 127.0.0.1 and cannot be reached from other devices. Enable external access to connect from another device."}
          </span>
        </div>
      </div>

      {exposed && (
        <span className="text-[0.78rem] text-amber-700 leading-snug">
          ⚠️ The runtime is currently unauthenticated. Anyone on this network can
          drive it while external access is enabled.
        </span>
      )}
    </div>
  );
}

function CopyableUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable; ignore.
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:bg-slate-50 hover:border-slate-300"
    >
      <code className="font-mono text-slate-800 break-all">{url}</code>
      {copied ? (
        <Check size={15} className="shrink-0 text-emerald-600" />
      ) : (
        <Copy size={15} className="shrink-0 text-slate-400" />
      )}
    </button>
  );
}
