import { useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import IconButton from "../IconButton";

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
  const numPages = useMemo(
    () => (pageSize === undefined ? 0 : Math.ceil(numItems / pageSize)),
    [pageSize, numItems]
  );

  useEffect(() => {
    if (pageOffset >= numPages) {
      setPageOffset(numPages - 1);
    } else if (pageOffset < 0 && numPages > 0) {
      setPageOffset(0);
    }
  }, [numPages, pageOffset, setPageOffset]);

  const onPrevPage = () => setPageOffset(Math.max(0, pageOffset - 1));
  const onNextPage = () =>
    setPageOffset(Math.min(pageOffset + 1, numPages - 1));

  return (
    pageSize !== undefined && (
      <div className="mx-auto flex w-fit whitespace-nowrap">
        <IconButton
          className="mx-2 px-1"
          border
          onClick={onPrevPage}
          icon={ChevronLeft}
        />

        <div className="text-base">
          {pageOffset + 1} / {numPages}
        </div>
        <IconButton
          className="mx-2 px-1"
          border
          onClick={onNextPage}
          icon={ChevronRight}
        />
      </div>
    )
  );
}
