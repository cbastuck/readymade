type Props = {
  words: Array<string>;
};

export default function Claim({ words }: Props) {
  const [first, second, third] = words;
  return (
    <div className="flex" style={{ marginLeft: "3px", whiteSpace: "nowrap" }}>
      <div className="w-[40px]">{` ${first} `}</div>
      <div
        className="bg-sky-600 rounded"
        style={{
          fontStyle: "normal",
          fontWeight: "bold",
          color: "white",
          paddingLeft: "5px",
          paddingRight: "5px",
          marginRight: "5px",
        }}
      >
        {second}
      </div>
      <div>{` ${third} `}</div>
    </div>
  );
}
