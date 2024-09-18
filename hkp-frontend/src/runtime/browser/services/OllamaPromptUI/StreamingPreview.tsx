export default function StreamingPreview({ value }: { value: string }) {
  return (
    <div
      className="w-full min-h-9 max-h-9 py-2 my-0 text-md font-menu text-left w-full overflow-y-auto"
      style={{ position: "relative" }}
    >
      <div
        className="text-gray-500"
        style={{
          position: "absolute",
          textOverflow: "ellipsis",
          overflowX: "hidden",
          whiteSpace: "nowrap",
          width: "100%",
          direction: "rtl",
          textAlign: "left",
          minWidth: "500px",
        }}
      >
        Idle, updates appear here during process {value}
      </div>
    </div>
  );
}
