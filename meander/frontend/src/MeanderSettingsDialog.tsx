import { useEffect, useState } from "react";
import {
  Globe,
  Info,
  KeyRound,
  Lock,
  Network,
  Plus,
  ShieldCheck,
} from "lucide-react";

import SettingsDialog from "hkp-frontend/src/ui-components/SettingsDialog";
import {
  CopyableValue,
  RemoveButton,
  SettingsButton,
  SettingsCard,
  SettingsInput,
  SettingsList,
  SettingsNote,
  SettingsRow,
  SettingsSection,
  SettingsStack,
  SettingsSwitch,
} from "hkp-frontend/src/ui-components/settings/kit";
import ManageConnectionsContent from "hkp-frontend/src/ui-components/connections/ManageConnectionsContent";
import { useRemoteRuntimeEditing } from "hkp-frontend/src/ui-components/toolbar/useRemoteRuntimeEditing";
import { useBoardContext } from "hkp-frontend/src/BoardContext";
import {
  isRuntimeGraphQLClassType,
  isRuntimeRestClassType,
  RuntimeClass,
} from "hkp-frontend/src/types";
import { isDiscoverySupported } from "hkp-frontend/src/runtime/discovery/DiscoveryApi";
import { useLocalStorageCoordinators } from "hkp-frontend/src/views/start/useLocalStorageCoordinators";
import type {
  CoordinatorsController,
  RemotesController,
} from "hkp-frontend/src/views/start/types";

import SecretsTab from "./SecretsTab";
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

const ABOUT_TAB = "about";

// The shared settings dialog with the tabs only the app can fill: the runtime
// it hosts, the servers it knows, the secrets it holds and who may reach it.
export default function MeanderSettingsDialog({ open, onOpenChange }: Props) {
  const canManageRemotes = isDiscoverySupported();
  const [tab, setTab] = useState(ABOUT_TAB);

  return (
    <SettingsDialog
      tab={open ? tab : null}
      onChangeTab={(next) => {
        if (next === null) {
          onOpenChange(false);
          setTab(ABOUT_TAB);
          return;
        }
        setTab(next);
      }}
      leadingTabs={[
        {
          id: ABOUT_TAB,
          label: "About",
          icon: <Info size={15} />,
          content: <AboutTab />,
        },
      ]}
      extraTabs={[
        {
          id: "connections",
          label: "Connections",
          icon: <Network size={15} />,
          content: <ConnectionsTab canManageRemotes={canManageRemotes} />,
        },
        {
          id: "secrets",
          label: "Secrets",
          icon: <KeyRound size={15} />,
          content: <SecretsTab />,
        },
        {
          id: "access",
          label: "Access",
          icon: <ShieldCheck size={15} />,
          content: <AccessTab />,
        },
      ]}
    />
  );
}

const isRemoteRuntime = (rt: RuntimeClass) =>
  isRuntimeGraphQLClassType(rt.type) || isRuntimeRestClassType(rt.type);

function ConnectionsTab({ canManageRemotes }: { canManageRemotes: boolean }) {
  // Coordinators live in the webview's localStorage, the one list the deploy
  // menu, the Cloud Boards view and the engine picker read.
  const coordinators = useLocalStorageCoordinators();
  return canManageRemotes ? (
    <ConnectionsWithRemotes coordinators={coordinators} />
  ) : (
    <ManageConnectionsContent coordinators={coordinators} />
  );
}

function ConnectionsWithRemotes({
  coordinators,
}: {
  coordinators: CoordinatorsController;
}) {
  // Remote management works anywhere inside the Meander host. On a board it is
  // backed by the live board context, persisting through the board host's
  // store; on the start page (no board) it is backed
  // directly by the persisted remotes in settings.json. The backend hook
  // fetches on mount, and the tab mounts when selected, so the list is fresh
  // each time the tab is opened.
  const boardContext = useBoardContext();
  const backendRemotes = useBackendRemotes();
  const boardRemotes = useRemoteRuntimeEditing();

  // Mirror RuntimeMenu so a runtime added here matches the toolbar's behaviour.
  const remotes: RemotesController = boardContext
    ? {
        runtimes: (boardContext.availableRuntimeEngines ?? []).filter(
          isRemoteRuntime,
        ),
        onAdd: boardRemotes.onAdd,
        onRemove: boardRemotes.onRemove,
        onUpdate: boardRemotes.onUpdate,
      }
    : backendRemotes;

  return (
    <ManageConnectionsContent remotes={remotes} coordinators={coordinators} />
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
    <SettingsStack>
      <SettingsSection label="Runtime server">
        {runtimeUrl ? (
          <CopyableValue value={runtimeUrl} />
        ) : (
          <p className="hkp-set-hint">Not available</p>
        )}
      </SettingsSection>

      <SettingsSection label="Network">
        <SettingsList>
          <SettingsRow
            icon={exposed ? <Globe size={15} /> : <Lock size={15} />}
            title={exposed ? "Exposed to local network" : "Local only"}
            subtitle={
              <span style={{ whiteSpace: "normal" }}>
                {exposed
                  ? "Other devices on this network can connect to this runtime at the URL above."
                  : "The runtime is bound to 127.0.0.1 and cannot be reached from other devices. Enable external access to connect from another device."}
              </span>
            }
          />
        </SettingsList>
        {exposed && authKnown && authConfigured && (
          <SettingsNote tone="ok">
            Authentication is enforced. Only allow-listed users can drive this
            runtime from another device.
          </SettingsNote>
        )}
        {exposed && authKnown && !authConfigured && (
          <SettingsNote tone="warn">
            External access is on but no allowed users are configured, so all
            external requests are denied. Add trusted issuers and allowed users
            under "auth" in settings.json.
          </SettingsNote>
        )}
        {exposed && !authKnown && (
          <SettingsNote tone="warn">
            Exposed to the local network. Configure trusted issuers and allowed
            users under "auth" in settings.json so only allow-listed users can
            drive this runtime.
          </SettingsNote>
        )}
      </SettingsSection>
    </SettingsStack>
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
    return <p className="hkp-set-hint">Loading…</p>;
  }
  if (!supported || !settings) {
    return (
      <SettingsNote>
        Runtime access settings are only editable inside the Readymade app.
      </SettingsNote>
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
    <SettingsStack>
      <SettingsSection label="Local network">
        <SettingsCard>
          <div className="hkp-set-inline" style={{ justifyContent: "space-between", gap: 16 }}>
            <div style={{ minWidth: 0 }}>
              <div className="hkp-set-row-title">Expose to local network</div>
              <p className="hkp-set-hint">
                {allowExternalRuntimeAccess
                  ? "Bound to 0.0.0.0 — other devices can connect (authenticated)."
                  : "Bound to 127.0.0.1 — reachable only from this device."}
              </p>
            </div>
            <SettingsSwitch
              label="Expose to local network"
              checked={allowExternalRuntimeAccess}
              onChange={(checked) =>
                void persist({ allowExternalRuntimeAccess: checked })
              }
            />
          </div>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        label="Allowed users"
        hint="Emails permitted to drive this runtime from other devices."
      >
        <SettingsList empty="No users yet — while exposed, all external requests are denied.">
          {allowedUsers.map((email) => (
            <SettingsRow
              key={email}
              title={email}
              trailing={
                <RemoveButton
                  label={`Remove ${email}`}
                  onClick={() => removeEmail(email)}
                />
              }
            />
          ))}
        </SettingsList>
        <div className="hkp-set-inline">
          <SettingsInput
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addEmail();
              }
            }}
            placeholder="name@example.com"
          />
          <SettingsButton onClick={addEmail} disabled={!newEmail.trim()}>
            <Plus size={14} />
            Add
          </SettingsButton>
        </div>
      </SettingsSection>

      <SettingsNote tone="warn">
        Changes take effect after restarting the app.
      </SettingsNote>
    </SettingsStack>
  );
}
