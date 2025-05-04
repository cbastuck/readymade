import { useState } from "react";

const model = [
  {
    name: "Fetch Data",
  },
  {
    name: "Augment Data",
    children: [
      {
        name: "Augment Derived Data",
        children: [
          {
            name: "Augment Derived Data 1",
          },
          {
            name: "Augment Derived Data 2",
          },
        ],
      },
      {
        name: "Augment External Data",
        children: [
          {
            name: "Fetch External Data",
          },
          {
            name: "Map Data",
          },
          {
            name: "Filter Data",
          },
          {
            name: "Reduce Data",
          },
          {
            name: "Verify Data",
          },
        ],
      },
    ],
  },
  {
    name: "Aggregate Data",
  },
  {
    name: "Visualize Data",
  },
];

export default function Spreadsheet() {
  const [activeCells, setActiveCells] = useState<Array<number | undefined>>([]);

  const onClickCell = (rowIndex: number, cellIndex: number) => {
    setActiveCells((prev) => {
      const newActiveCells = prev.slice(0, rowIndex + 1);
      if (newActiveCells[rowIndex] === cellIndex) {
        newActiveCells[rowIndex] = undefined;
      } else {
        newActiveCells[rowIndex] = cellIndex;
      }
      return newActiveCells;
    });
  };

  const rows = getTable(activeCells);

  const getActiveCellStyle = (rowIndex: number, cellIndex: number) =>
    activeCells[rowIndex] === cellIndex ? "bg-gray-200" : "bg-white";

  const getNestedCellStyle = (rowIndex: number, cellIndex: number) =>
    rows[rowIndex][cellIndex]?.hasChildren ? "underline" : "";

  return (
    <div className="w-full h-full m-1 font-menu">
      <table>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {rowIndex > 0
                ? makeEmptyArray(sumArray(activeCells.slice(0, rowIndex))).map(
                    (_, i) => <td key={`padding-${rowIndex}-${i}`} />
                  )
                : null}
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={`border p-2 cursor-pointer text-black select-none ${getActiveCellStyle(
                    rowIndex,
                    cellIndex
                  )} ${getNestedCellStyle(rowIndex, cellIndex)}`}
                  onClick={() => onClickCell(rowIndex, cellIndex)}
                >
                  <div className="w-[180px] text-left">{cell.name}</div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Cell = { name: string; hasChildren: boolean };

function getTable(activeCells: Array<number | undefined>): Array<Array<Cell>> {
  const lowerLevels: Array<Array<Cell>> = [];
  for (let i = 0; i < activeCells.length; ++i) {
    lowerLevels[i] =
      activeCells[i] !== undefined
        ? getChildren(model, activeCells.slice(0, i + 1))
        : [];
  }

  return [
    model.map((x) => ({ name: x.name, hasChildren: !!x.children })),
    ...lowerLevels,
  ];
}

function getChildren(
  model: Array<{ name: string; children?: Array<any> }>,
  activeCells: Array<number | undefined>
): Array<Cell> {
  if (activeCells.length === 0) {
    return model.map(({ name, children }) => ({
      name,
      hasChildren: !!children,
    }));
  }
  const selectChild = activeCells[0];
  if (selectChild === undefined) {
    return [];
  }
  const selectedModel = model[selectChild]?.children || [];
  return getChildren(selectedModel, activeCells.slice(1));
}

function makeEmptyArray(length: number | undefined): Array<undefined> {
  return new Array(length || 0).fill(undefined);
}

function sumArray(array: Array<number | undefined>): number {
  return array.reduce<number>((acc, val) => acc + (val || 0), 0);
}
