import { useEffect, useState } from "react";

import {
  RemoveButton,
  SettingsButton,
  SettingsList,
  SettingsNote,
  SettingsRow,
  SettingsSection,
  SettingsStack,
  SettingsSwitch,
} from "hkp-frontend/src/ui-components/settings/kit";
import { findDemoBoard } from "hkp-frontend/src/demoRegistry";

import { getBackend } from "../backend";
import {
  listPins,
  opensAsApp,
  Pin,
  PINS_AS_APP_CHANGED,
  PINS_CHANGED,
  removePin,
  setOpensAsApp,
} from "./homeScreen";

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
  // Read from its store on every render; bumped to render when it changes.
  const [, setAsAppVersion] = useState(0);

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
    const onAsAppChanged = () => setAsAppVersion((n) => n + 1);
    window.addEventListener(PINS_CHANGED, onChanged);
    window.addEventListener(PINS_AS_APP_CHANGED, onAsAppChanged);
    return () => {
      window.removeEventListener(PINS_CHANGED, onChanged);
      window.removeEventListener(PINS_AS_APP_CHANGED, onAsAppChanged);
    };
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
  const present = (pins ?? []).filter((pin) => !isGone(pin));

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
      {present.length > 0 && (
        <SettingsSection
          label="Open as app"
          hint="Its facade fills the screen. Go back, or hold two fingers on the screen, to see the board around it. A board without a facade opens as usual."
        >
          <SettingsList>
            {present.map((pin) => {
              const asApp = opensAsApp(pin);
              return (
                <SettingsRow
                  key={`${pin.kind}:${pin.id}`}
                  title={pin.title}
                  subtitle={asApp ? "Opens as an app" : "Opens with the board"}
                  trailing={
                    <SettingsSwitch
                      label={`Open ${pin.title} as an app`}
                      checked={asApp}
                      onChange={(next) => setOpensAsApp(pin, next)}
                    />
                  }
                />
              );
            })}
          </SettingsList>
        </SettingsSection>
      )}
    </SettingsStack>
  );
}
