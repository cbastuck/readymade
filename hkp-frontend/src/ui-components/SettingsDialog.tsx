import { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./primitives/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./primitives/tabs";
import AppearanceSettings from "./AppearanceSettings";

/** A tab a host adds beyond Appearance, which every host has. */
export type SettingsTab = {
  /** Identifies the tab in `tab`/`onChangeTab`. */
  id: string;
  label: string;
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
};

/**
 * The application's settings, as every host presents them. Appearance is the
 * one tab all of them share: it is backed by ThemeContext and localStorage
 * alone, so it needs nothing of the host beyond a ThemeProvider above it.
 *
 * With no extra tabs there is nothing to switch between, so the tab strip is
 * left out rather than shown with a single entry in it.
 */
export default function SettingsDialog({
  tab,
  onChangeTab,
  extraTabs = [],
}: Props) {
  return (
    <Dialog
      open={tab !== null}
      onOpenChange={(open) => {
        if (!open) {
          onChangeTab(null);
        }
      }}
    >
      <DialogContent className="max-w-lg w-[90vw]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        {extraTabs.length === 0 ? (
          <AppearanceSettings />
        ) : (
          <Tabs
            value={tab ?? APPEARANCE_TAB}
            onValueChange={(value) => onChangeTab(value)}
          >
            <TabsList>
              <TabsTrigger value={APPEARANCE_TAB}>Appearance</TabsTrigger>
              {extraTabs.map((extra) => (
                <TabsTrigger key={extra.id} value={extra.id}>
                  {extra.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value={APPEARANCE_TAB}>
              <AppearanceSettings />
            </TabsContent>
            {extraTabs.map((extra) => (
              <TabsContent key={extra.id} value={extra.id}>
                <div className="max-h-[60vh] overflow-y-auto pt-2">
                  {extra.content}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
