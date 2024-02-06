type Props = {
  title: string;
  setIsOpen: (isOpen: boolean) => void;
};
export default function CodeBlockHeader({ title, setIsOpen }: Props) {
  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "row",
        position: "sticky",
        top: 0,
        right: 0,
        backgroundColor: "white",
        borderBottom: "solid 1px #efefef",
      }}
    >
      <div
        style={{
          width: "100%",
          textAlign: "center",
          padding: 5,
          fontWeight: "bold",
          fontSize: "13px",
        }}
      >
        {title}
      </div>
      <button
        style={{
          marginLeft: "auto",
          padding: "2px 12px",
          backgroundColor: "#efefef",
          borderRadius: 5,
          border: "solid 1px transparent",
          color: "gray",
        }}
        onClick={() => setIsOpen(false)}
      >
        X
      </button>
    </div>
  );
}
