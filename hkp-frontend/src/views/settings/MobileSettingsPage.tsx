import { useState, type ReactNode } from "react";
import { ChevronRight, Palette } from "lucide-react";

import AppearanceSettings from "../../ui-components/AppearanceSettings";
import MobilePage from "../playground/mobile/MobilePage";
import { M } from "../playground/mobile/tokens";
import "../../ui-components/settings/settings.css";

/** One row of the settings list, and the page it opens. */
export type MobileSettingsSection = {
  id: string;
  label: string;
  icon: ReactNode;
  /** One line under the label, saying what is there. */
  subtitle?: string;
  /** The section's page, stacked over the list; `onBack` returns to it. */
  render: (onBack: () => void) => ReactNode;
};

/** Stacked above the settings list, which sits at the page level. */
const SECTION_Z = 61;

/**
 * A section whose content is written in the settings kit — what the desktop
 * dialog's tabs are made of — framed as a page. The kit sizes its inputs for
 * a pointer; on a phone anything under 16px makes iOS zoom into the field on
 * focus and never zoom back, hence the override.
 */
export function kitSection(section: {
  id: string;
  label: string;
  icon: ReactNode;
  subtitle?: string;
  content: ReactNode;
}): MobileSettingsSection {
  return {
    id: section.id,
    label: section.label,
    icon: section.icon,
    subtitle: section.subtitle,
    render: (onBack) => (
      <MobilePage title={section.label} onBack={onBack} zIndex={SECTION_Z}>
        <style>{`
          .hkp-set-mobile input,
          .hkp-set-mobile select,
          .hkp-set-mobile textarea {
            font-size: 16px;
          }
        `}</style>
        <div className="hkp-set hkp-set-mobile">{section.content}</div>
      </MobilePage>
    ),
  };
}

const appearanceSection = kitSection({
  id: "appearance",
  label: "Appearance",
  icon: <Palette size={18} />,
  subtitle: "Theme, accent colours, font",
  content: <AppearanceSettings />,
});

type Props = {
  /** Leaves the settings and returns to whatever was showing. */
  onClose: () => void;
  /** Host sections listed before Appearance, as in the desktop dialog. */
  leadingSections?: MobileSettingsSection[];
  /** Host sections listed after it. */
  sections?: MobileSettingsSection[];
};

/**
 * The application's settings as the touch hosts present them: the desktop
 * dialog's tabs as a list, each opening its own page. Appearance is the one
 * section every host has; the rest are the host's to pass, because only the
 * host knows what it can settle — a runtime it embeds, a secret store.
 *
 * Raised over whatever is showing, like every page here, so opening the
 * settings from a running board leaves the board as it was.
 */
export default function MobileSettingsPage({
  onClose,
  leadingSections = [],
  sections = [],
}: Props) {
  const all = [...leadingSections, appearanceSection, ...sections];
  const [openId, setOpenId] = useState<string | null>(null);
  const open = all.find((section) => section.id === openId);

  return (
    <MobilePage
      title="Settings"
      onBack={onClose}
      overlay={open?.render(() => setOpenId(null))}
    >
      <div
        style={{
          background: M.card,
          border: `1px solid ${M.border}`,
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {all.map((section, index) => (
          <button
            key={section.id}
            type="button"
            onClick={() => setOpenId(section.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              width: "100%",
              padding: "13px 14px",
              border: "none",
              borderTop: index ? `1px solid ${M.border}` : "none",
              background: "none",
              textAlign: "left",
              fontFamily: "inherit",
              color: M.textPrimary,
              cursor: "pointer",
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: M.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: M.textSecondary,
                flexShrink: 0,
              }}
            >
              {section.icon}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>
                {section.label}
              </span>
              {section.subtitle && (
                <span
                  style={{ display: "block", fontSize: 12.5, color: M.textSecondary }}
                >
                  {section.subtitle}
                </span>
              )}
            </span>
            <ChevronRight size={18} color={M.textMuted} />
          </button>
        ))}
      </div>
    </MobilePage>
  );
}
