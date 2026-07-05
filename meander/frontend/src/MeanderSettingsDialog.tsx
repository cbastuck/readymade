import { useEffect, useState } from "react";
import { Check, Copy, Globe, Lock, Plus, X } from "lucide-react";

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
import { Button } from "hkp-frontend/src/ui-components/primitives/button";
import AppearanceSettings from "hkp-frontend/src/ui-components/AppearanceSettings";
import ManageRuntimesContent from "hkp-frontend/src/ui-components/toolbar/ManageRuntimesContent";
import { useBoardContext } from "hkp-frontend/src/BoardContext";
import {
  isRuntimeGraphQLClassType,
  isRuntimeRestClassType,
  RuntimeClass,
} from "hkp-frontend/src/types";
import { isDiscoverySupported } from "hkp-frontend/src/runtime/discovery/DiscoveryApi";

import { getBackend } from "./backend";
import { RuntimeSettings } from "./backend/types";
import { useBackendRemotes } from "./useBackendRemotes";

type MeanderConfig = {
  lanIp?: string;
  runtimePort?: number;
  allowExternalAccess?: boolean;
  // True when exposed AND an auth allow-list is configured (auth enforced).
  // Absent on older backends that predate runtime auth.
  authConfigured?: boolean;
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
  const canManageRemotes = isDiscoverySupported();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[90vw]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="about">
          <TabsList>
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            {canManageRemotes && (
              <TabsTrigger value="remotes">Remotes</TabsTrigger>
            )}
            <TabsTrigger value="access">Access</TabsTrigger>
          </TabsList>
          <TabsContent value="about">
            <AboutTab />
          </TabsContent>
          <TabsContent value="appearance">
            <AppearanceSettings />
          </TabsContent>
          {canManageRemotes && (
            <TabsContent value="remotes">
              <RemotesTab />
            </TabsContent>
          )}
          <TabsContent value="access">
            <AccessTab />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

const isRemoteRuntime = (rt: RuntimeClass) =>
  isRuntimeGraphQLClassType(rt.type) || isRuntimeRestClassType(rt.type);

function RemotesTab() {
  // Remote management works anywhere inside the Meander host. On a board it is
  // backed by the live board context; on the start page (no board) it is backed
  // directly by the persisted remotes in settings.json. The backend hook
  // fetches on mount, and the tab mounts when selected, so the list is fresh
  // each time the tab is opened.
  const boardContext = useBoardContext();
  const backendRemotes = useBackendRemotes();

  const persistRemoteRuntimes = (allEngines: RuntimeClass[]) => {
    localStorage.setItem(
      "available-remote-runtimes",
      JSON.stringify(allEngines.filter(isRemoteRuntime)),
    );
  };

  let remoteRuntimes: RuntimeClass[];
  let onAddRuntimeEngine: (desc: RuntimeClass) => void;
  let onRemoveRuntimeEngine: (desc: RuntimeClass) => void;
  let onUpdateRuntimeEngine: (desc: RuntimeClass) => void;

  if (boardContext) {
    // Mirror RuntimeMenu so a runtime added here matches the toolbar's behaviour.
    remoteRuntimes = (boardContext.availableRuntimeEngines ?? []).filter(
      isRemoteRuntime,
    );
    onAddRuntimeEngine = (desc) =>
      persistRemoteRuntimes(boardContext.addAvailableRuntime(desc, false) ?? []);
    onRemoveRuntimeEngine = (desc) =>
      persistRemoteRuntimes(boardContext.removeAvailableRuntime(desc) ?? []);
    onUpdateRuntimeEngine = (desc) =>
      persistRemoteRuntimes(boardContext.addAvailableRuntime(desc, true) ?? []);
  } else {
    remoteRuntimes = backendRemotes.runtimes;
    onAddRuntimeEngine = backendRemotes.onAdd;
    onRemoveRuntimeEngine = backendRemotes.onRemove;
    onUpdateRuntimeEngine = backendRemotes.onUpdate;
  }

  return (
    <div className="max-h-[60vh] overflow-y-auto pt-2">
      <ManageRuntimesContent
        remoteRuntimes={remoteRuntimes}
        onAddRuntimeEngine={onAddRuntimeEngine}
        onRemoveRuntimeEngine={onRemoveRuntimeEngine}
        onUpdateRuntimeEngine={onUpdateRuntimeEngine}
        inlineNewRuntimePanel
      />
    </div>
  );
}

function AboutTab() {
  const config = getMeanderConfig();
  // Prefer the explicit fields; fall back to the legacy apiPort (real port when
  // exposed, 0 otherwise) so the tab works against older backend builds too.
  const exposed =
    config.allowExternalAccess ?? ((config.apiPort ?? 0) > 0);
  // authConfigured is set by the backend; when undefined we're on an older build
  // and can't tell, so we don't claim either way.
  const authKnown = config.authConfigured !== undefined;
  const authConfigured = config.authConfigured === true;
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

      {exposed && authKnown && authConfigured && (
        <span className="text-[0.78rem] text-emerald-700 leading-snug">
          🔒 Authentication is enforced. Only allow-listed users can drive this
          runtime from another device.
        </span>
      )}
      {exposed && authKnown && !authConfigured && (
        <span className="text-[0.78rem] text-amber-700 leading-snug">
          ⚠️ External access is on but no allowed users are configured, so all
          external requests are denied. Add trusted issuers and allowed users
          under "auth" in settings.json.
        </span>
      )}
      {exposed && !authKnown && (
        <span className="text-[0.78rem] text-amber-700 leading-snug">
          ⚠️ Exposed to the local network. Configure trusted issuers and allowed
          users under "auth" in settings.json so only allow-listed users can
          drive this runtime.
        </span>
      )}
    </div>
  );
}

function AccessTab() {
  const [settings, setSettings] = useState<RuntimeSettings | null>(null);
  const [supported, setSupported] = useState(true);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const backend = await getBackend();
      if (!backend.getRuntimeSettings) {
        if (!cancelled) {
          setSupported(false);
          setLoading(false);
        }
        return;
      }
      try {
        const s = await backend.getRuntimeSettings();
        if (!cancelled) {
          setSettings(s);
        }
      } catch {
        if (!cancelled) {
          setSupported(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = async (patch: Partial<RuntimeSettings>) => {
    const backend = await getBackend();
    if (!backend.setRuntimeSettings) {
      return;
    }
    const updated = await backend.setRuntimeSettings(patch);
    setSettings(updated);
  };

  if (loading) {
    return <div className="pt-2 text-sm text-slate-500">Loading…</div>;
  }
  if (!supported || !settings) {
    return (
      <div className="pt-2 text-sm text-slate-500">
        Runtime access settings are only editable inside the Readymade app.
      </div>
    );
  }

  const { allowExternalRuntimeAccess, allowedUsers } = settings;

  const addEmail = () => {
    const email = newEmail.trim();
    setNewEmail("");
    if (!email || allowedUsers.includes(email)) {
      return;
    }
    void persist({ allowedUsers: [...allowedUsers, email] });
  };

  const removeEmail = (email: string) => {
    void persist({ allowedUsers: allowedUsers.filter((e) => e !== email) });
  };

  return (
    <div className="flex flex-col gap-4 pt-2 text-sm">
      <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-slate-800">
            Expose to local network
          </span>
          <span className="text-[0.8rem] text-slate-500 leading-snug">
            {allowExternalRuntimeAccess
              ? "Bound to 0.0.0.0 — other devices can connect (authenticated)."
              : "Bound to 127.0.0.1 — reachable only from this device."}
          </span>
        </div>
        <button
          onClick={() =>
            void persist({
              allowExternalRuntimeAccess: !allowExternalRuntimeAccess,
            })
          }
          className={`shrink-0 rounded-full px-3 py-1 text-[0.8rem] font-semibold transition-colors ${
            allowExternalRuntimeAccess
              ? "bg-emerald-100 text-emerald-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {allowExternalRuntimeAccess ? "On" : "Off"}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="uppercase tracking-[0.12em] text-muted-foreground text-[0.68rem] font-semibold">
          Allowed users
        </span>
        <span className="text-[0.8rem] text-slate-500 leading-snug">
          Emails permitted to drive this runtime from other devices.
        </span>

        {allowedUsers.length === 0 && (
          <span className="text-[0.8rem] italic text-slate-400">
            No users yet — while exposed, all external requests are denied.
          </span>
        )}
        {allowedUsers.map((email) => (
          <div
            key={email}
            className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2"
          >
            <span className="truncate text-slate-800">{email}</span>
            <button
              onClick={() => removeEmail(email)}
              aria-label={`Remove ${email}`}
              className="shrink-0 text-slate-400 hover:text-red-600"
            >
              <X size={15} />
            </button>
          </div>
        ))}

        <div className="flex items-center gap-2">
          <input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addEmail();
              }
            }}
            placeholder="name@example.com"
            className="flex-1 rounded-md border border-slate-200 px-3 py-2 outline-none focus:border-slate-400"
            style={{ fontSize: 16 }}
          />
          <Button variant="outline" size="sm" onClick={addEmail} className="gap-1">
            <Plus size={14} />
            Add
          </Button>
        </div>
      </div>

      <span className="text-[0.78rem] text-amber-700 leading-snug">
        ⚠️ Changes take effect after restarting the app.
      </span>
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
