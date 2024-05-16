import Copyable from "../../../components/Copyable";
import { replacePlaceholders } from "../../../core/url";
import QR from "../../../components/QR";
import { QRCodeType } from "./types";

export default function QRCode(item: QRCodeType) {
  const { href = "#", board = "unnamedboard" } = item;
  const params = Object.fromEntries(
    new URLSearchParams(document.location.search)
  );
  const url = replacePlaceholders(href, {
    board,
    ...params,
  });
  return (
    <div className="w-full flex flex-col items-center">
      <div
        style={{
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <QR url={url || ""} />
      </div>
      <div className="w-[88%] m-auto">
        <Copyable label="URL" value={url} />
      </div>
    </div>
  );
}
