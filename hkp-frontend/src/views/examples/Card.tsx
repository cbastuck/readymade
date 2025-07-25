import { Link } from "react-router-dom";

import Image from "hkp-frontend/src/ui-components/Image";
import { ExampleDescriptor } from "./types";
import { s, t } from "../../styles";
import CardText from "hkp-frontend/src/ui-components/CardText";

type Props = { example: ExampleDescriptor };

export default function Card({ example }: Props) {
  const fontStyle = s(t.fs13, t.tc);
  const url = `/example/sandbox?url=${example.url}`;

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
      <div className="p-4" style={fontStyle}>
        <div className="flex items-center">
          <div
            className="tracking-wider"
            style={{
              marginTop: 3,
              textAlign: "left",
              color: "#4183c4",
            }}
          >
            <h4>
              <Link className="hover:no-underline" to={url}>
                {example.title}
              </Link>
            </h4>
          </div>
          <div className="ml-auto mx-1 p-0">
            <a href={example.url} className="m-0 p-0 hover:no-underline">
              <Image src={example.image} size={20} />
            </a>
          </div>
        </div>
        <div>
          <div className="tracking-wide font-sans text-left">
            {example.brief}
          </div>
          <div
            style={{
              marginTop: 10,
            }}
          >
            <Link className="hover:no-underline" to={url}>
              <CardText>
                {Array.isArray(example.description)
                  ? example.description.map((d, idx) => (
                      <p key={`example-${example.title}-desc-${idx}`}>{d}</p>
                    ))
                  : example.description}
              </CardText>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
