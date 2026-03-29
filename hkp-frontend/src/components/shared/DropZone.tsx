import React, { useState } from "react";

type DragItem = { type: string; data: string };

type Props = {
  label?: React.ReactNode;
  style?: React.CSSProperties;
  onFiles?: (files: FileList) => void;
  onItems?: (items: DragItem[]) => void;
};

export default function DropZone({ label, style, onFiles, onItems }: Props): JSX.Element {
  const [dragZoneOpen, setDragZoneOpen] = useState(false);

  const isFilesDrag = (ev: React.DragEvent): boolean =>
    ev.dataTransfer.types.indexOf("Files") !== -1;

  const isItemsDrag = (ev: React.DragEvent): boolean =>
    ev.dataTransfer.types.length > 0 && !isFilesDrag(ev);

  const isDragAccepted = (ev: React.DragEvent): boolean => {
    if (onFiles && isFilesDrag(ev)) {
      return true;
    }

    if (onItems && isItemsDrag(ev)) {
      return true;
    }

    return false;
  };

  const onDragOver = (ev: React.DragEvent): void => {
    if (isDragAccepted(ev)) {
      setDragZoneOpen(true);
    }
    ev.preventDefault();
  };

  const onDragLeave = (_ev: React.DragEvent): void => {
    setDragZoneOpen(false);
  };

  const onDrop = (ev: React.DragEvent): void => {
    const data = ev.dataTransfer;

    if (isDragAccepted(ev)) {
      if (isFilesDrag(ev)) {
        (onFiles as (files: FileList) => void)(data.files);
      }

      if (isItemsDrag(ev)) {
        const items = Array.from(data.items).map(({ type }) => ({
          type,
          data: data.getData(type),
        }));
        (onItems as (items: DragItem[]) => void)(items);
      }
    }

    setDragZoneOpen(false);
    ev.preventDefault();
  };

  return (
    <div
      className="flex items-center"
      style={{
        ...style,
        border: "solid 1px lightgray",
        borderRadius: 5,
        backgroundColor: dragZoneOpen ? "lightgreen" : "#4183c4",
        color: "white",
        textAlign: "center",
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
    >
      {label}
    </div>
  );
}
