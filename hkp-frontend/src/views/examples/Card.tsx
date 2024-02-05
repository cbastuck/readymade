import { Link } from "react-router-dom";
import { Image } from "semantic-ui-react";

import { ExampleDescriptor } from "./types";
import { s, t } from "../../styles";

type Props = { example: ExampleDescriptor };

export default function EampleCard({ example }: Props) {
  const fontStyle = s(t.fs13, t.tc);
  return (
    <div
      key={`example-card-${example.title}`}
      className="hkp-card-border"
      style={s(t.m10, {
        flex: 1,
        width: 0,
        minWidth: 200,
      })}
    >
      <div style={{ ...fontStyle, minHeight: 250, padding: 10 }}>
        <Link
          key={`example-link-${example.title}`}
          to={`/example/sandbox?url=${example.url}`}
        >
          <div>
            <Image
              floated="right"
              src={example.image}
              style={{ marginTop: 3, marginRight: 15, width: 20 }}
            />
            <div
              style={{
                marginTop: 3,
                textAlign: "left",
                color: "#4183c4",
                letterSpacing: 1,
              }}
            >
              <h1 className="hkp-fnt-family" style={t.fs14}>
                {example.title}
              </h1>
            </div>
            <div
              style={{
                margin: "5px 0px",
                textAlign: "left",
                letterSpacing: 0.5,
              }}
            >
              {example.brief}
            </div>
            <div
              className="hkp-fnt-color"
              style={{
                marginTop: 10,
              }}
            >
              <div
                style={s(t.tl, {
                  fontSize: 14,
                  letterSpacing: 1.4,
                })}
              >
                {Array.isArray(example.description)
                  ? example.description.map((d, idx) => (
                      <p key={`example-${example.title}-desc-${idx}`}>{d}</p>
                    ))
                  : example.description}
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
