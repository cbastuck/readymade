type Props = {
  value: any;
};
export default function GenericWidgetResult({ value }: Props) {
  const renderObject = (item: any, idx: number = 0) => {
    return (
      <div key={`board-output-${item.name}-${idx}`}>
        <GenericWidgetItem value={item} />
      </div>
    );
  };

  const renderArray = (array: any[]) => array.map(renderObject);

  return (
    <div className="flex flex-col gap-2">
      {Array.isArray(value) ? renderArray(value) : renderObject(value)}
    </div>
  );
}

function GenericWidgetItem({ value }: any) {
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }

  if (typeof value === "function") {
    return "<function>";
  }

  const keys = Object.keys(value);
  const values = keys.map((key) => value[key]);

  return keys.map((key, idx) => (
    <div key={`${key}-${idx}`} className="flex flex-col ">
      <div className="flex px-2 capitalize items-end tracking-widest">
        <h3>{key}</h3>
        <div className="ml-2 font-menu">{values[idx]}</div>
      </div>
    </div>
  ));
}
