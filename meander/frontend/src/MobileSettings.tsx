import { Info, KeyRound, Network, Scale, ShieldCheck } from "lucide-react";

import MobileSettingsPage, {
  MobileSettingsSection,
  kitSection,
} from "hkp-frontend/src/views/settings/MobileSettingsPage";
import MobileSecretsPage from "hkp-frontend/src/views/secrets/MobileSecretsPage";
import MobilePage from "hkp-frontend/src/views/playground/mobile/MobilePage";
import { RuntimeAccessContent } from "hkp-frontend/src/views/playground/mobile/RuntimeAccessSheet";
import ManageConnectionsContent from "hkp-frontend/src/ui-components/connections/ManageConnectionsContent";
import { LicencesTabContent } from "hkp-frontend/src/ui-components/settings/licencesTab";
import {
  CopyableValue,
  SettingsList,
  SettingsNote,
  SettingsRow,
  SettingsSection,
  SettingsStack,
} from "hkp-frontend/src/ui-components/settings/kit";
import { usePlatform } from "hkp-frontend/src/platform/PlatformContext";
import { useLocalStorageCoordinators } from "hkp-frontend/src/views/start/useLocalStorageCoordinators";
import type { RemotesController } from "hkp-frontend/src/views/start/types";
import { splitBuildVersion } from "hkp-frontend/src/views/start";
import { commitUrl } from "hkp-frontend/src/projectMeta";
import { openInBrowser } from "hkp-frontend/src/runtime/browser/services/helpers";

import { getBackend } from "./backend";
import { currentSurface } from "./currentSurface";

const buildVersion = splitBuildVersion(__READYMADE_BUILD_VERSION__);

const SECRETS_STORAGE_NOTE =
  (window as any).__MEANDER_IOS__ === true
    ? "Kept in this iPhone's Keychain, on this device only: not synced through iCloud Keychain and not restored onto another phone. What you have allowed is kept with the app's own files."
    : "Sealed with a key in this phone's Android Keystore, which never leaves it, so a backup restored onto another phone does not bring them along. What you have allowed is kept with the app's own files.";

/** Stacked above the settings list, as every section page is. */
const SECTION_Z = 61;

function AboutContent() {
  const href = commitUrl(buildVersion.hash);
  const runtimeBaseURL: string | undefined = (window as any).__MEANDER_CONFIG__
    ?.runtimeBaseURL;
  return (
    <SettingsStack>
      <SettingsSection label="Readymade">
        <SettingsList>
          <SettingsRow title="Version" subtitle={buildVersion.version} />
          {buildVersion.hash && (
            <SettingsRow
              title="Build"
              mono
              subtitle={
                href ? (
                  <a
                    href={href}
                    onClick={(e) => {
                      e.preventDefault();
                      openInBrowser(href);
                    }}
                    style={{ color: "inherit", textDecoration: "underline" }}
                  >
                    {buildVersion.hash}
                  </a>
                ) : (
                  buildVersion.hash
                )
              }
            />
          )}
        </SettingsList>
      </SettingsSection>
      {runtimeBaseURL && (
        <SettingsSection
          label="Embedded runtime"
          hint={
            <span style={{ whiteSpace: "normal" }}>
              The runtime this app carries. A board names it as{" "}
              <code className="hkp-set-mono">"remote": "embedded"</code>, on
              this phone and in every other Readymade app.
            </span>
          }
        >
          <CopyableValue value={runtimeBaseURL} />
        </SettingsSection>
      )}
      <SettingsNote>
        Who may reach the runtime from other devices is under Access.
      </SettingsNote>
    </SettingsStack>
  );
}

/** The servers the app knows, in both roles — the start page's sheet, as a page. */
function ConnectionsContent({ remotes }: { remotes: RemotesController }) {
  const coordinators = useLocalStorageCoordinators();
  return <ManageConnectionsContent remotes={remotes} coordinators={coordinators} />;
}

type Props = {
  onClose: () => void;
  /** The section to open at, over the list, rather than the list itself. */
  initialSection?: string;
  /**
   * The remotes the host keeps, the same controller the start page and the
   * playground's runtime picker are given, so a server added here is in both.
   */
  remotes: RemotesController;
};

/**
 * The app's settings on a phone: the desktop dialog's sections (About,
 * Appearance, Board Assist, Connections, Secrets, Access, Licences), each a
 * page.
 */
export default function MobileSettings({ onClose, initialSection, remotes }: Props) {
  const platform = usePlatform();

  const about = kitSection({
    id: "about",
    label: "About",
    icon: <Info size={18} />,
    subtitle: buildVersion.version,
    content: <AboutContent />,
  });

  const sections: MobileSettingsSection[] = [
    kitSection({
      id: "connections",
      label: "Connections",
      icon: <Network size={18} />,
      subtitle: "Runtime servers and coordinators",
      content: <ConnectionsContent remotes={remotes} />,
    }),
    {
      id: "secrets",
      label: "Secrets",
      icon: <KeyRound size={18} />,
      subtitle: "Credentials boards refer to by name",
      render: (onBack) => (
        <MobileSecretsPage
          host={getBackend}
          onBack={onBack}
          storageNote={SECRETS_STORAGE_NOTE}
          zIndex={SECTION_Z}
        />
      ),
    },
    ...(platform.getRuntimeSettings
      ? [
          {
            id: "access",
            label: "Access",
            icon: <ShieldCheck size={18} />,
            subtitle: "Local network, allowed users",
            render: (onBack: () => void) => (
              <MobilePage title="Access" onBack={onBack} zIndex={SECTION_Z}>
                <RuntimeAccessContent />
              </MobilePage>
            ),
          },
        ]
      : []),
    // Last: reference material, consulted rather than configured.
    kitSection({
      id: "licences",
      label: "Licences",
      icon: <Scale size={18} />,
      subtitle: "Open-source components this app ships",
      content: <LicencesTabContent surface={currentSurface()} />,
    }),
  ];

  return (
    <MobileSettingsPage
      onClose={onClose}
      initialSection={initialSection}
      leadingSections={[about]}
      sections={sections}
    />
  );
}
