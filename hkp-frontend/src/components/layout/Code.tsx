type Props = {
  children: string;
};

export default function Code({ children }: Props) {
  return (
    <div
      style={{
        backgroundColor: "#555",
        borderRadius: "5px",
        padding: "20px",
        color: "white",
        fontFamily: "monospace",
        fontWeight: "bold",
        fontSize: "11pt",
      }}
    >
      <code>{children}</code>
    </div>
  );
}
