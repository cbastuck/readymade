import { ReactNode, useState } from "react";
import { AlertTriangle, Check, Copy, Info, ShieldCheck, X } from "lucide-react";

import "./settings.css";

/**
 * The pieces settings surfaces are built from, styled by settings.css. A
 * surface wraps them in an element with the `hkp-set` class (the settings
 * dialog and the connection panels do), which is where the kit's colours and
 * type are defined.
 */

export function SettingsStack({ children }: { children: ReactNode }) {
  return <div className="hkp-set-stack">{children}</div>;
}

type SectionProps = {
  label: string;
  hint?: ReactNode;
  /** Rendered at the right of the label, e.g. a button acting on the section. */
  action?: ReactNode;
  children?: ReactNode;
};

export function SettingsSection({ label, hint, action, children }: SectionProps) {
  return (
    <section className="hkp-set-section">
      <div className="hkp-set-section-head">
        <span className="hkp-set-label">{label}</span>
        {action}
      </div>
      {hint && <p className="hkp-set-hint">{hint}</p>}
      {children}
    </section>
  );
}

export function SettingsCard({ children }: { children: ReactNode }) {
  return <div className="hkp-set-card">{children}</div>;
}

/** Rows in one card, divided. Shows `empty` when there are no children. */
export function SettingsList({
  children,
  empty,
}: {
  children?: ReactNode;
  empty?: string;
}) {
  const hasRows = Array.isArray(children)
    ? children.some((child) => child !== null && child !== false)
    : !!children;
  return (
    <div className="hkp-set-list">
      {hasRows ? children : empty && <div className="hkp-set-empty">{empty}</div>}
    </div>
  );
}

type RowProps = {
  /** An icon (rendered in a tile) or any leading element, e.g. a colour swatch. */
  icon?: ReactNode;
  /** Render `icon` as-is instead of inside the tile. */
  bareIcon?: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Titles and subtitles rendered in a monospace face (hosts, references). */
  mono?: boolean;
  trailing?: ReactNode;
  children?: ReactNode;
};

export function SettingsRow({
  icon,
  bareIcon,
  title,
  subtitle,
  mono,
  trailing,
  children,
}: RowProps) {
  return (
    <div>
      <div className="hkp-set-row">
        {icon &&
          (bareIcon ? icon : <span className="hkp-set-row-icon">{icon}</span>)}
        <div className="hkp-set-row-text">
          <div className={`hkp-set-row-title${mono ? " hkp-set-mono" : ""}`}>
            {title}
          </div>
          {subtitle && (
            <div className={`hkp-set-row-sub${mono ? " hkp-set-mono" : ""}`}>
              {subtitle}
            </div>
          )}
        </div>
        {trailing}
      </div>
      {children}
    </div>
  );
}

export function RemoveButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button className="hkp-set-icon-btn" onClick={onClick} aria-label={label}>
      <X size={15} />
    </button>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "block";
};

export function SettingsButton({
  variant = "default",
  className,
  ...props
}: ButtonProps) {
  const variantClass =
    variant === "primary"
      ? " hkp-set-btn--primary"
      : variant === "block"
        ? " hkp-set-btn--block"
        : "";
  return (
    <button
      className={`hkp-set-btn${variantClass}${className ? ` ${className}` : ""}`}
      {...props}
    />
  );
}

export function SettingsInput({
  className,
  mono,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }) {
  return (
    <input
      className={`hkp-set-input${mono ? " hkp-set-mono" : ""}${className ? ` ${className}` : ""}`}
      {...props}
    />
  );
}

/** A labelled input. The label wraps the input, so the two are associated
 *  without an id; `htmlFor` is for inputs rendered elsewhere. */
export function SettingsField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <label className="hkp-set-field" htmlFor={htmlFor}>
      <span className="hkp-set-label">{label}</span>
      {children}
    </label>
  );
}

type Choice<T extends string> = {
  id: T;
  label: ReactNode;
  sub?: ReactNode;
  title?: string;
};

export function SettingsChoices<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<Choice<T>>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="hkp-set-choices">
      {options.map((option) => (
        <button
          key={option.id}
          className="hkp-set-choice"
          title={option.title}
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
          {option.sub && <span className="hkp-set-choice-sub">{option.sub}</span>}
        </button>
      ))}
    </div>
  );
}

export function SettingsSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="hkp-set-switch"
      onClick={() => onChange(!checked)}
    />
  );
}

export function SettingsNote({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "ok";
  children: ReactNode;
}) {
  const Icon = tone === "warn" ? AlertTriangle : tone === "ok" ? ShieldCheck : Info;
  return (
    <div className={`hkp-set-note${tone === "info" ? "" : ` hkp-set-note--${tone}`}`}>
      <Icon size={14} />
      <div>{children}</div>
    </div>
  );
}

/** A value shown whole, copied to the clipboard on click. */
export function CopyableValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable; ignore.
    }
  };

  return (
    <button className="hkp-set-copy" onClick={handleCopy}>
      <span className="hkp-set-mono" style={{ wordBreak: "break-all" }}>
        {value}
      </span>
      {copied ? (
        <Check size={15} color="var(--set-ok)" style={{ flex: "0 0 auto" }} />
      ) : (
        <Copy size={15} color="var(--set-mut)" style={{ flex: "0 0 auto" }} />
      )}
    </button>
  );
}
