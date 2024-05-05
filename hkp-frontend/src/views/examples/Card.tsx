import { Link } from "react-router-dom";
import { Image } from "semantic-ui-react";

import { ExampleDescriptor } from "./types";
import { s, t } from "../../styles";

type Props = { example: ExampleDescriptor };

export default function Card({ example }: Props) {
  const fontStyle = s(t.fs13, t.tc);
  return (
    <div
      key={`example-card-${example.title}`}
      className="hkp-card-border"
      style={s(t.m10, {
        flex: 1,
        width: 0,
        minWidth: 200,
        height: "min-content",
      })}
    >
      <div style={{ ...fontStyle, padding: 10 }}>
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
              className="tracking-wider"
              style={{
                marginTop: 3,
                textAlign: "left",
                color: "#4183c4",
              }}
            >
              <h4>{example.title}</h4>
            </div>
            <div
              className="tracking-wide font-sans"
              style={{
                margin: "5px 0px",
                textAlign: "left",
              }}
            >
              {example.brief}
            </div>
            <div
              style={{
                marginTop: 10,
              }}
            >
              <div className="font-serif tracking-wider" style={s(t.tl)}>
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
