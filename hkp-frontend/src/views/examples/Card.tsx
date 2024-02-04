import { Link } from "react-router-dom";
import { Card, Image } from "semantic-ui-react";

import { ExampleDescriptor } from "./types";
import { s, t } from "../../styles";

type Props = { example: ExampleDescriptor };

export default function EampleCard({ example }: Props) {
  const fontStyle = s(t.fs13, t.tc);
  return (
    <div
      key={`example-card-${example.title}`}
      style={s(t.m10, { flex: 1, width: 0, minWidth: 200 })}
    >
      <Card style={{ ...fontStyle, minHeight: 250, padding: 10 }}>
        <Link
          key={`example-link-${example.title}`}
          to={`/example/sandbox?url=${example.url}`}
        >
          <Card.Content>
            <Image
              floated="right"
              src={example.image}
              style={{ marginTop: 3, marginRight: 15, width: 20 }}
            />
            <Card.Header
              style={{
                marginTop: 3,
                textAlign: "left",
                color: "#4183c4",
                letterSpacing: 1,
              }}
            >
              <h1 className="hkp-fnt-label" style={t.fs14}>
                {example.title}
              </h1>
            </Card.Header>
            <Card.Meta
              style={{
                margin: "5px 0px",
                textAlign: "left",
                letterSpacing: 0.5,
              }}
            >
              {example.brief}
            </Card.Meta>
            <Card.Description
              style={{
                marginTop: 10,
                color: "rgb(84 84 84)",
              }}
            >
              <div
                style={s(t.tl, {
                  fontSize: 14,
                  letterSpacing: 1.5,
                })}
              >
                {Array.isArray(example.description)
                  ? example.description.map((d, idx) => (
                      <p key={`example-${example.title}-desc-${idx}`}>{d}</p>
                    ))
                  : example.description}
              </div>
            </Card.Description>
          </Card.Content>
        </Link>
      </Card>
    </div>
  );
}
