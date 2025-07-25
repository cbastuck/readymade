import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { decompressAndDecodeState } from "hkp-frontend/src/common";
import { importAdditionalWidgetToLocalStorage } from "./common";

export default function ImportWidget() {
  const [searchParams] = useSearchParams();
  const src = searchParams.get("src");
  const navigate = useNavigate();

  const state = src && decompressAndDecodeState(src);
  const { board, params } = state && JSON.parse(state);

  importAdditionalWidgetToLocalStorage({ board, name: board.name, params });
  useEffect(() => navigate("/home"), [navigate]);

  if (!src) {
    return <h1>Invalid URL</h1>;
  }

  if (!board || !params) {
    console.error("Invalid payload", { board, params });
    return <h1>Invalid payload</h1>;
  }
}
