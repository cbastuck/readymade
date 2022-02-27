import React from "react";
import { Message } from "semantic-ui-react";

import { s, t } from "../../styles";
import Copyable from "../../components/Copyable";
import { replacePlaceholders } from "../../core/url";
import QR from "../../components/QR";

export default function Description({ description, boardName }) {
  if (!description) {
    return false;
  }
  const arr = Array.isArray(description) ? description : [description];
  const renderItem = (item, idx) => {
    const key = `template-description-item-${idx}`;
    if (typeof item === "string") {
      return (
        <div key={key} style={s(t.uc, t.fs12)}>
          {" "}
          {item}{" "}
        </div>
      );
    }
    if (Array.isArray(item)) {
      return (
        <div key={key} style={{ display: "flex", flexDirection: "row" }}>
          {item
            .reduce((a, c) => [...a, c, <span>&nbsp;</span>], [])
            .map((x, y) => renderItem(x, `${idx}.${y}`))}
        </div>
      );
    }
    switch (item.type) {
      case "headline":
        return (
          <h1 key={key} style={s(t.fs14, t.uc, t.ls1, t.tc)}>
            {item.text}
          </h1>
        );
      case "check": {
        const { url: rawUrl, text } = item;
        const url = replacePlaceholders(rawUrl);
        const urlKey = `check-${url}`;
        const checkPassed = this.state[urlKey];
        if (checkPassed === undefined) {
          fetch(url)
            .then((resp) => this.setState({ [urlKey]: resp.ok }))
            .catch((err) => this.setState({ [urlKey]: false }));
        }
        return (
          <div key={key} style={s(t.uc, t.fs12, t.ls1)}>
            {text} {checkPassed ? "✅" : "❌"}
          </div>
        );
      }
      case "link": {
        const { text = "text property missing", href = "#" } = item;
        return (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer"
            style={s(t.uc, t.fs12, t.ls1)}
          >
            {text}
          </a>
        );
      }
      case "vspace": {
        const { size } = item;
        return <div key={key} style={{ height: size }} />;
      }
      case "qr": {
        const { href = "#" } = item;
        const params = Object.fromEntries(
          new URLSearchParams(document.location.search)
        );
        const url = replacePlaceholders(href, {
          board: boardName,
          ...params,
        });
        return (
          <div key={key} style={{ margin: "auto", textAlign: "center" }}>
            <QR url={url} />
            <div style={{ width: "60%", margin: "auto" }}>
              <Copyable label="url" value={url} />
            </div>
          </div>
        );
      }
      case "text":
        const { value, alignment = "left" } = item;
        const alig =
          alignment === "left" ? t.tl : alignment === "center" ? t.tc : t.tr;
        return (
          <div key={key} style={s(t.uc, t.fs12, alig)}>
            {" "}
            {value}{" "}
          </div>
        );
      default:
        console.error("Unsupported description type", item);
        return (
          <div key={key} style={s(t.uc, t.fs12, t.ls1)}>
            {item}
          </div>
        );
    }
  };
  return (
    <div style={{ margin: "10px 0" }}>
      <Message
        style={{
          padding: "15px 30px",
          color: "#555",
          backgroundColor: "rgba(172, 200, 229, 0.01)",
        }}
      >
        {arr.map(renderItem)}
      </Message>
    </div>
  );
}
