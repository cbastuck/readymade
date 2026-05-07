import { useEffect, useState, type ReactNode } from "react";
import MobileIcon from "./MobileIcon";
import { M } from "./tokens";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  height?: string;
};

export default function BottomSheet({ open, onClose, title, children, height = "75%" }: Props) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      const id = requestAnimationFrame(() => setAnimating(true));
      return () => cancelAnimationFrame(id);
    } else {
      setAnimating(false);
      const t = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!visible) {
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 100,
        background: animating ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0)",
        transition: "background 0.3s",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          background: M.card,
          borderRadius: "20px 20px 0 0",
          height,
          transition: "transform 0.3s cubic-bezier(0.32,0.72,0,1)",
          transform: animating ? "translateY(0)" : "translateY(100%)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 -4px 30px rgba(0,0,0,0.12)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 6px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: M.border }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 20px 14px" }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: M.textPrimary }}>{title}</div>
          <button
            onClick={onClose}
            style={{ border: "none", background: "#f0ede9", borderRadius: "50%", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <MobileIcon name="x" size={15} color={M.textSecondary} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch", padding: "0 20px 40px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
