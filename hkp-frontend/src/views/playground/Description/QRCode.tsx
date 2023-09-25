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
    <div style={{ margin: "auto", textAlign: "center" }}>
      <QR url={url} />
      <div style={{ width: "60%", margin: "auto" }}>
        <Copyable label="url" value={url} />
      </div>
    </div>
  );
}
