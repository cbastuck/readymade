/** The single place the public contact address is written down. */
export const CONTACT_EMAIL = "christoph@bstck.berlin";

type Props = {
  /** Replaces the default link styling when given. */
  className?: string;
  /** Merged into the default styling. */
  style?: React.CSSProperties;
};

/** The contact address rendered as a mailto link. */
export default function ContactMail({ className, style }: Props) {
  return (
    <a
      href={`mailto:${CONTACT_EMAIL}`}
      className={className ?? "underline hover:opacity-70"}
      style={{ textUnderlineOffset: "3px", ...style }}
    >
      {CONTACT_EMAIL}
    </a>
  );
}
