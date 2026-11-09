import { useEffect, useState } from "react";

import {
  RemoveButton,
  SettingsButton,
  SettingsList,
  SettingsNote,
  SettingsRow,
  SettingsSection,
  SettingsStack,
} from "hkp-frontend/src/ui-components/settings/kit";
import { findDemoBoard } from "hkp-frontend/src/demoRegistry";

import { getBackend } from "../backend";
import { listPins, Pin, PINS_CHANGED, removePin } from "./homeScreen";

const AFTER_UNPIN_NOTE =
  (window as any).__MEANDER_IOS__ === true
    ? "Unpinning takes a board out of the app icon's quick actions and the boards Shortcuts and the widget offer. A shortcut you built from it in Shortcuts, or a widget showing it, stays until you remove it there."
    : "Unpinning takes a board out of the app icon's long-press menu and disables an icon already on the Home Screen, which you then remove yourself.";

function reasonOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Every board pinned to the Home Screen, in one place — the only place a pin
 * whose board has gone (deleted, renamed, a demo this version no longer
 * ships) can be unpinned, since it has no details of its own to do it from.
 */
export default function HomeScreenSettings() {
  const [pins, setPins] = useState<Pin[] | null>(null);
  // Null until read, or when it could not be: nothing is called gone then.
  const [savedNames, setSavedNames] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listPins()
      .then(setPins)
      .catch((err: unknown) => {
        setPins([]);
        setError(reasonOf(err));
      });
    void getBackend()
      .then((backend) => backend.fetchSavedBoards())
      .then(setSavedNames)
      .catch(() => {});
    const onChanged = (event: Event) =>
      setPins((event as CustomEvent<Pin[]>).detail);
    window.addEventListener(PINS_CHANGED, onChanged);
    return () => window.removeEventListener(PINS_CHANGED, onChanged);
  }, []);

  const isGone = (pin: Pin) =>
    pin.kind === "saved"
      ? savedNames !== null && !savedNames.includes(pin.id)
      : !findDemoBoard(pin.id);

  const unpin = async (targets: Pin[]) => {
    setBusy(true);
    setError(null);
    try {
      // One at a time: the shells unpin one board per call.
      for (const pin of targets) {
        await removePin(pin);
      }
    } catch (err) {
      setError(reasonOf(err));
    } finally {
      setBusy(false);
    }
  };

  const gone = (pins ?? []).filter(isGone);

  return (
    <SettingsStack>
      <SettingsSection
        label="Pinned boards"
        action={
          pins && pins.length > 0 ? (
            <SettingsButton disabled={busy} onClick={() => void unpin(pins)}>
              Unpin all
            </SettingsButton>
          ) : undefined
        }
      >
        <SettingsList empty={pins ? "No boards are pinned" : "Reading…"}>
          {(pins ?? []).map((pin) => (
            <SettingsRow
              key={`${pin.kind}:${pin.id}`}
              title={pin.title}
              subtitle={
                isGone(pin)
                  ? "No longer on this device"
                  : pin.kind === "demo"
                    ? "Demo"
                    : "Saved board"
              }
              trailing={
                <RemoveButton
                  label={`Unpin ${pin.title}`}
                  onClick={() => void unpin([pin])}
                />
              }
            />
          ))}
        </SettingsList>
        {gone.length > 0 && (
          <SettingsButton
            variant="block"
            disabled={busy}
            onClick={() => void unpin(gone)}
          >
            {gone.length === 1
              ? "Unpin the board that is gone"
              : `Unpin the ${gone.length} boards that are gone`}
          </SettingsButton>
        )}
      </SettingsSection>
      {error && <SettingsNote tone="warn">{error}</SettingsNote>}
      <SettingsNote>{AFTER_UNPIN_NOTE}</SettingsNote>
    </SettingsStack>
  );
}
