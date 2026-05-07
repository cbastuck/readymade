type Props = {
  isActive: boolean;
  accentColor: string;
};

export default function FlowWaveIcon({ isActive, accentColor }: Props) {
  return (
    <svg
      width="30"
      height="12"
      viewBox="0 0 30 12"
      fill="none"
      stroke={isActive ? accentColor : "currentColor"}
      strokeWidth={isActive ? 1 : 0.5}
      strokeLinecap="round"
      style={{
        opacity: isActive ? 0.9 : 0.35,
        position: "relative",
        top: -1,
        transition: "stroke 400ms, opacity 400ms, stroke-width 400ms",
      }}
    >
      <path d="M1 4 C7 1 11 7 18 4 C25 1 29 7 36 4 C43 1 47 7 54 4 C61 1 65 7 73 4" />
      <path d="M1 8 C7 5 11 11 18 8 C25 5 29 11 36 8 C43 5 47 11 54 8 C61 5 65 11 73 8" />
    </svg>
  );
}
