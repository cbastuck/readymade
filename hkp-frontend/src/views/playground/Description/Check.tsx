import { useState } from "react";

import { replacePlaceholders } from "../../../core/url";
import { CheckType } from "./types";
import { s, t } from "../../../styles";

export default function Check(item: CheckType) {
  const [resolvedURLs, setResolvedUrls] = useState<{ [key: string]: any }>({});
  const url = replacePlaceholders(item.url);
  const urlKey = `check-${url}`;

  const checkPassed = resolvedURLs[urlKey];
  if (url && checkPassed === undefined) {
    fetch(url)
      .then((resp) =>
        setResolvedUrls({ ...resolvedURLs, [urlKey]: resp.status === 200 })
      )
      .catch((_err) => setResolvedUrls({ ...resolvedURLs, [urlKey]: false }));
  }

  return (
    <div style={s(t.fs12, t.ls1)}>
      {item.text} {checkPassed ? "✅" : "❌"}
    </div>
  );
}
