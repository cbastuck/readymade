type Props = {
  s: string;
  c: string;
  link?: string;
  cite?: string;
};

export default function Claim(claim: Props) {
  return (
    <div
      style={{
        fontSize: 14,
        textAlign: "left",
        margin: "5px 30px",
        color: claim.c ? undefined : "#454f6d",
        letterSpacing: 1,
      }}
    >
      <span className="font-sans text-xl">{claim.s}</span>
      {claim.c ? ": " : ""}
      <span
        style={{
          fontStyle: "italic",
          letterSpacing: 1.3,
        }}
      >
        {claim.link ? (
          <a href={claim.link} target="blank">
            {claim.c}
          </a>
        ) : (
          <span className="text-lg">{claim.c}</span>
        )}
      </span>
    </div>
  );
}
