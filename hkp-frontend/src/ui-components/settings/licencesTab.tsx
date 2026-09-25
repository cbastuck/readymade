import { Scale } from "lucide-react";

import Licenses from "hkp-frontend/src/components/Licenses";
import type { Surface } from "hkp-frontend/src/components/Licenses/data";
import type { SettingsTab } from "hkp-frontend/src/ui-components/SettingsDialog";

import { SettingsSection, SettingsStack } from "./kit";

export const LICENCES_TAB = "licences";

/**
 * The open-source components one build ships, and the licence text each of them
 * asks be reproduced wherever the code is distributed.
 *
 * The surface is the host's to name because the index carries every one of them
 * at once and they do not ship the same components — a browser bundle links
 * none of the native code an app does, and the mobile apps leave out the local
 * speech and language models the desktop ones carry. Attribution is owed for
 * what the reader actually received, so a host lists itself rather than
 * everything that exists.
 */
export function LicencesTabContent({ surface }: { surface: Surface }) {
  return (
    <SettingsStack>
      <SettingsSection
        label="Third-party components"
        hint={
          <span style={{ whiteSpace: "normal" }}>
            Readymade is built on open-source work by other people. Everything
            you are running is listed here with its version, its licence and the
            full text of that licence — which is what those licences ask for in
            return. The list is generated from the manifests and lockfiles the
            build was made from, so it reflects what is actually shipped.
          </span>
        }
      >
        <Licenses surfaces={[surface]} />
      </SettingsSection>
    </SettingsStack>
  );
}

/**
 * The licences as a tab, ready to pass to `SettingsDialog`.
 *
 * Every host that distributes Readymade owes this, so it is offered as one
 * definition rather than rebuilt per host — but it stays something a host adds
 * rather than a built-in like Appearance, because only the host knows which
 * surface it is. Hosts list it last: it is reference material, consulted rather
 * than configured.
 */
export function licencesTab(surface: Surface): SettingsTab {
  return {
    id: LICENCES_TAB,
    label: "Licences",
    icon: <Scale size={15} />,
    content: <LicencesTabContent surface={surface} />,
  };
}
