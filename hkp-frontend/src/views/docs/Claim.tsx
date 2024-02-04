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
        color: claim.c ? "black" : "#454f6d",
        letterSpacing: 1,
        lineHeight: 1.5,
      }}
    >
      <span style={{ textTransform: "uppercase" }}>{claim.s}</span>
      {claim.c ? ": " : ""}
      <span
        style={{
          fontStyle: "italic",
          color: "#454f6d",
          letterSpacing: 1.3,
        }}
      >
        {claim.link ? (
          <a href={claim.link} target="blank">
            {claim.c}
          </a>
        ) : (
          <span
            style={{
              color: "#4183c4",
            }}
          >
            {claim.c}
          </span>
        )}
      </span>
    </div>
  );
}
