import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { RuntimeClass, RuntimeDescriptor } from "hkp-frontend/src/types";
import {
  Dialog,
  DialogContent,
} from "hkp-frontend/src/ui-components/primitives/dialog";
import {
  SettingsButton,
  SettingsList,
  SettingsNote,
  SettingsRow,
  SettingsSection,
  SettingsStack,
} from "../settings/kit";
import "../settings/settings.css";

type Props = {
  isOpen: boolean;
  runtime: RuntimeDescriptor;
  /** Every runtime server this client keeps, the runtime's own among them. */
  servers: Array<RuntimeClass>;
  /** Moves the runtime; throws, having changed nothing, when it could not. */
  onMove: (target: RuntimeClass) => Promise<void>;
  onClose: () => void;
};

const address = (url?: string) => (url ?? "").replace(/\/+$/, "");

// Sizing inline rather than through utilities, as the settings dialog does: it
// has to beat the primitive's own classes whatever order the stylesheets load in.
const frameStyle: React.CSSProperties = {
  display: "flex",
  width: "min(560px, 94vw)",
  maxWidth: "none",
  maxHeight: "88vh",
  padding: 0,
  gap: 0,
  overflow: "hidden",
  borderRadius: 16,
};

/**
 * Where a runtime is moved to: the runtime servers this client keeps, as the
 * connections dialog lists them, with the one it runs on now marked.
 *
 * Addresses are shown because names alone do not say which server is this
 * machine — two servers can answer to the names a board uses. What a move
 * leaves behind is said before anything is pressed, and a move that fails is
 * reported beside the server it was meant for, with the dialog still open.
 */
export default function MoveRuntimeDialog({
  isOpen,
  runtime,
  servers,
  onMove,
  onClose,
}: Props) {
  // The server being moved to, by address; one move at a time.
  const [moving, setMoving] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ url: string; message: string } | null>(
    null,
  );

  useEffect(() => {
    if (isOpen) {
      setMoving(null);
      setFailed(null);
    }
  }, [isOpen]);

  const here = servers.find(
    (server) => address(server.url) === address(runtime.url),
  );
  // A runtime on an address this client keeps nothing under still has a
  // place it runs, and is listed there.
  const rows: Array<RuntimeClass> = here
    ? servers
    : [{ name: runtime.url ?? "", type: runtime.type, url: runtime.url }, ...servers];
  const from = here?.name ?? runtime.url;

  const move = async (target: RuntimeClass) => {
    setMoving(address(target.url));
    setFailed(null);
    try {
      await onMove(target);
      onClose();
    } catch (err) {
      setFailed({
        url: address(target.url),
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setMoving(null);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent
        className="hkp-set hkp-set-dialog"
        style={frameStyle}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="hkp-set-pane">
          <div className="hkp-set-pane-header">
            <DialogPrimitive.Title className="hkp-set-pane-title">
              Move “{runtime.name}”
            </DialogPrimitive.Title>
          </div>
          <div className="hkp-set-pane-body">
            <SettingsStack>
              <DialogPrimitive.Description className="hkp-set-hint">
                The runtime is rebuilt on the server you choose, with the state
                its services have now. What {from} keeps for this board —
                tables, records, files — stays there.
              </DialogPrimitive.Description>

              <SettingsSection label="Runtime servers">
                <SettingsList>
                  {rows.map((server) => {
                    const url = address(server.url);
                    const isHere = url === address(runtime.url);
                    return (
                      <SettingsRow
                        key={url}
                        bareIcon
                        icon={
                          <span
                            aria-hidden
                            className="h-7 w-7 shrink-0"
                            style={{
                              borderRadius: 8,
                              border: "1px solid var(--set-line)",
                              background: server.color || "white",
                            }}
                          />
                        }
                        title={server.name}
                        subtitle={
                          server.aliases?.length
                            ? `${server.url} · also ${server.aliases.join(", ")}`
                            : server.url
                        }
                        trailing={
                          isHere ? (
                            <span className="hkp-set-label">here</span>
                          ) : (
                            <SettingsButton
                              disabled={moving !== null}
                              aria-label={`Move to ${server.name}`}
                              onClick={() => void move(server)}
                            >
                              {moving === url ? "Moving …" : "Move here"}
                            </SettingsButton>
                          )
                        }
                      >
                        {failed?.url === url && (
                          <div style={{ padding: "0 12px 10px" }}>
                            <SettingsNote tone="warn">
                              Could not move it to {server.name} — it is still
                              on {from}. {failed.message}
                            </SettingsNote>
                          </div>
                        )}
                      </SettingsRow>
                    );
                  })}
                </SettingsList>
              </SettingsSection>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <SettingsButton onClick={onClose}>Cancel</SettingsButton>
              </div>
            </SettingsStack>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
