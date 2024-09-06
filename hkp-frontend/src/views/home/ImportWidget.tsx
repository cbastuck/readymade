import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { decompressAndDecodeState } from "@/common";
import { importAdditionalWidgetToLocalStorage } from "./common";

export default function ImportWidget() {
  const [searchParams] = useSearchParams();
  const src = searchParams.get("src");
  const navigate = useNavigate();

  if (!src) {
    return <h1>Invalid URL</h1>;
  }

  const state = decompressAndDecodeState(src);
  const { board, params } = JSON.parse(state);
  if (!board || !params) {
    console.error("Invalid payload", { board, params });
    return <h1>Invalid payload</h1>;
  }

  importAdditionalWidgetToLocalStorage({ board, name: board.name, params });
  useEffect(() => navigate("/home"), []);
}
