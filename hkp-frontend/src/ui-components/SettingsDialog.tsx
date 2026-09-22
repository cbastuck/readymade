import { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { Palette } from "lucide-react";

import { Dialog, DialogContent } from "./primitives/dialog";
import AppearanceSettings from "./AppearanceSettings";
import "./settings/settings.css";

/** A tab a host adds beyond Appearance, which every host has. */
export type SettingsTab = {
  /** Identifies the tab in `tab`/`onChangeTab`. */
  id: string;
  label: string;
  /** Shown beside the label in the navigation. */
  icon?: ReactNode;
  content: ReactNode;
};

export const APPEARANCE_TAB = "appearance";

type Props = {
  /** The open tab; null closes the dialog. */
  tab: string | null;
  onChangeTab: (tab: string | null) => void;
  /**
   * Tabs this host can offer on top of Appearance. What a host can settle
   * differs — a runtime bound to a network card, a secret store — so the tabs
   * are the host's to pass rather than something this dialog knows about.
   */
  extraTabs?: SettingsTab[];
  /** Host tabs listed before Appearance rather than after it. */
  leadingTabs?: SettingsTab[];
};

const appearanceTab: SettingsTab = {
  id: APPEARANCE_TAB,
  label: "Appearance",
  icon: <Palette size={15} />,
  content: <AppearanceSettings />,
};

// Sizing inline rather than through utilities: it has to beat the primitive's
// own classes whatever order the stylesheets load in.
const frameStyle: React.CSSProperties = {
  display: "flex",
  width: "min(860px, 94vw)",
  maxWidth: "none",
  height: "min(620px, 88vh)",
  padding: 0,
  gap: 0,
  overflow: "hidden",
  borderRadius: 16,
};

/**
 * The application's settings, as every host presents them. Appearance is the
 * one tab all of them share: it is backed by ThemeContext and localStorage
 * alone, so it needs nothing of the host beyond a ThemeProvider above it.
 *
 * The tabs are a navigation column beside one pane of fixed size, so switching
 * tabs never resizes the dialog. With no host tabs there is nothing to switch
 * between, so the navigation is left out rather than shown with a single entry.
 */
export default function SettingsDialog({
  tab,
  onChangeTab,
  extraTabs = [],
  leadingTabs = [],
}: Props) {
  const tabs = [...leadingTabs, appearanceTab, ...extraTabs];
  const single = tabs.length === 1;

  return (
    <Dialog
      open={tab !== null}
      onOpenChange={(open) => {
        if (!open) {
          onChangeTab(null);
        }
      }}
    >
      <DialogContent
        className="hkp-set hkp-set-dialog"
        style={
          single
            ? { ...frameStyle, width: "min(560px, 94vw)", height: "auto", maxHeight: "88vh" }
            : frameStyle
        }
        aria-describedby={undefined}
        // Focus the dialog itself rather than its first tab, which would open
        // with a focus ring on it before anyone has touched the keyboard.
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        {single ? (
          <div className="hkp-set-pane">
            <div className="hkp-set-pane-header">
              <DialogPrimitive.Title className="hkp-set-pane-title">
                Settings
              </DialogPrimitive.Title>
            </div>
            <div className="hkp-set-pane-body">{appearanceTab.content}</div>
          </div>
        ) : (
          <TabsPrimitive.Root
            className="hkp-set-frame"
            orientation="vertical"
            value={tab ?? APPEARANCE_TAB}
            onValueChange={(value) => onChangeTab(value)}
          >
            <div className="hkp-set-nav">
              <DialogPrimitive.Title className="hkp-set-nav-title">
                Settings
              </DialogPrimitive.Title>
              <TabsPrimitive.List className="hkp-set-nav-list" aria-label="Settings">
                {tabs.map((entry) => (
                  <TabsPrimitive.Trigger
                    key={entry.id}
                    value={entry.id}
                    className="hkp-set-nav-item"
                  >
                    {entry.icon && (
                      <span className="hkp-set-nav-icon">{entry.icon}</span>
                    )}
                    {entry.label}
                  </TabsPrimitive.Trigger>
                ))}
              </TabsPrimitive.List>
            </div>
            {tabs.map((entry) => (
              <TabsPrimitive.Content
                key={entry.id}
                value={entry.id}
                className="hkp-set-pane"
              >
                <div className="hkp-set-pane-header">
                  <h3 className="hkp-set-pane-title">{entry.label}</h3>
                </div>
                <div className="hkp-set-pane-body">{entry.content}</div>
              </TabsPrimitive.Content>
            ))}
          </TabsPrimitive.Root>
        )}
      </DialogContent>
    </Dialog>
  );
}
