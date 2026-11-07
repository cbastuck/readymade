import type { ReactNode } from "react";

/**
 * Shown after a board was pinned on iOS. An iOS app cannot put an icon on the
 * Home Screen itself, so pinning makes the board launchable from everything
 * iOS offers — the app icon's quick actions, the Readymade widget, the Open
 * Board shortcut action — and this sheet says how the last step is done.
 *
 * Styling is inline, like the share picker's, to stay clear of the app's
 * global CSS load order.
 */
export default function HomeScreenSheet({
  title,
  onOpenShortcuts,
  onClose,
}: {
  title: string;
  /** Opens the Shortcuts app; the button is left out without it. */
  onOpenShortcuts?: () => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Put “${title}” on the Home Screen`}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#ffffff",
          color: "#1a1a1a",
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          paddingTop: 14,
          paddingBottom: "max(20px, env(safe-area-inset-bottom))",
          maxHeight: "86vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'DM Sans', system-ui, sans-serif",
          boxShadow: "0 -8px 30px rgba(0,0,0,0.18)",
        }}
      >
        <div
          style={{
            width: 38,
            height: 4,
            borderRadius: 2,
            background: "rgba(0,0,0,0.18)",
            alignSelf: "center",
            marginBottom: 14,
          }}
        />

        <div style={{ padding: "0 20px 4px" }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>
            Pinned “{title}”
          </div>
          <div style={{ ...bodyText, marginTop: 6 }}>
            It is in Readymade's quick actions now: touch and hold the
            Readymade icon. To give it a place of its own on the Home Screen:
          </div>
        </div>

        <Way heading="As a widget">
          Touch and hold the Home Screen, tap <b>Edit</b>, then{" "}
          <b>Add Widget</b>, and choose <b>Readymade</b>. The widget opens the
          board you pinned last; touch and hold it and choose{" "}
          <b>Edit Widget</b> to pick another.
        </Way>

        <Way heading="As an icon">
          In Shortcuts, make a new shortcut with Readymade's{" "}
          <b>Open Board</b> action and choose “{title}”. Then tap the share
          button and <b>Add to Home Screen</b>, where you can name it and
          pick its image.
        </Way>

        {onOpenShortcuts && (
          <button onClick={onOpenShortcuts} style={buttonStyle("secondary")}>
            Open Shortcuts
          </button>
        )}
        <button onClick={onClose} style={buttonStyle("primary")}>
          Done
        </button>
      </div>
    </div>
  );
}

const bodyText = {
  fontSize: 14,
  lineHeight: 1.45,
  color: "rgba(0,0,0,0.62)",
};

function Way({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div
      style={{
        margin: "12px 20px 0",
        padding: "12px 14px",
        borderRadius: 12,
        background: "rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700 }}>{heading}</div>
      <div style={{ ...bodyText, marginTop: 4 }}>{children}</div>
    </div>
  );
}

function buttonStyle(tone: "primary" | "secondary") {
  return {
    margin: tone === "primary" ? "10px 20px 0" : "16px 20px 0",
    padding: "14px",
    border: "none",
    borderRadius: 12,
    background: tone === "primary" ? "#1a1a1a" : "rgba(0,0,0,0.06)",
    fontSize: 16,
    fontWeight: 600,
    color: tone === "primary" ? "#ffffff" : "#1a1a1a",
    cursor: "pointer",
  } as const;
}
