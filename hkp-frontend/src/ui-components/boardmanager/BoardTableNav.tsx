import { useEffect } from "react";
import Button from "../Button";

type Props = {
  pageSize?: number;
  pageOffset: number;
  numItems: number;
  setPageOffset: (offset: number) => void;
};

export default function BoardTableNav({
  pageSize,
  pageOffset,
  numItems,
  setPageOffset,
}: Props) {
  const numPages = pageSize === undefined ? 0 : Math.ceil(numItems / pageSize);

  useEffect(() => {
    if (pageOffset >= numPages) {
      setPageOffset(numPages - 1);
    }
  }, [numPages, pageOffset]);

  const onPrevPage = () => setPageOffset(Math.max(0, pageOffset - 1));
  const onNextPage = () =>
    setPageOffset(Math.min(pageOffset + 1, numPages - 1));

  return (
    pageSize !== undefined && (
      <div className="text-center">
        <Button className="m-1" size="sm" onClick={onPrevPage}>
          {"<"}
        </Button>
        <span className="text-sm mx-2">
          {pageOffset + 1} / {numPages}
        </span>
        <Button className="m-1" size="sm" onClick={onNextPage}>
          {">"}
        </Button>
      </div>
    )
  );
}
