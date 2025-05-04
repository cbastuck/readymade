import { useState } from "react";

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

  const getIsNestedCellStyle = (rowIndex: number, cellIndex: number) => {
    const isNestedCell = rows[rowIndex][cellIndex];
    return isNestedCell ? "text-gray-400" : "";
  };

  return (
    <div className="w-full h-full m-4">
      <table className="table-auto border-collapse border w-full">
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
                  )} ${getIsNestedCellStyle(rowIndex, cellIndex)}`}
                  onClick={() => onClickCell(rowIndex, cellIndex)}
                >
                  <div className="w-[100px] overflow-hidden">{cell}</div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Cell = string;

const model = [
  {
    name: "eins",
  },
  {
    name: "zwei",
    children: [
      {
        name: "zwei.eins",
        children: [
          {
            name: "zwei.eins.eins",
          },
          {
            name: "zwei.eins.zwei",
          },
        ],
      },
      {
        name: "zwei.zwei",
        children: [
          {
            name: "zwei.zwei.eins",
          },
          {
            name: "zwei.zwei.zwei",
          },
        ],
      },
    ],
  },
  {
    name: "drei",
  },
  {
    name: "vier",
  },
  {
    name: "fünf",
    children: [
      {
        name: "fünf.eins",
      },
    ],
  },
];

function getTable(activeCells: Array<number | undefined>): Array<Array<Cell>> {
  const lowerLevels: Array<Array<Cell>> = [];
  for (let i = 0; i < activeCells.length; ++i) {
    lowerLevels[i] =
      activeCells[i] !== undefined
        ? getChildren(model, activeCells.slice(0, i + 1))
        : [];
  }

  return [model.map((x) => x.name), ...lowerLevels];
}

function getChildren(
  model: Array<{ name: string; children?: Array<any> }>,
  activeCells: Array<number | undefined>
): Array<Cell> {
  if (activeCells.length === 0) {
    return model.map(({ name }) => name);
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
