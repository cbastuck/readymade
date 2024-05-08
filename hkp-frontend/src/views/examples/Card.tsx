import { Link } from "react-router-dom";

import Image from "@/ui-components/Image";
import { ExampleDescriptor } from "./types";
import { s, t } from "../../styles";
import CardText from "@/ui-components/CardText";

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
      <div className="p-4" style={fontStyle}>
        <div className="flex items-end">
          <div
            className="tracking-wider"
            style={{
              marginTop: 3,
              textAlign: "left",
              color: "#4183c4",
            }}
          >
            <h4>
              <Link
                className="color-red-100 hover:no-underline"
                key={`example-link-${example.title}`}
                to={`/example/sandbox?url=${example.url}`}
              >
                {example.title}
              </Link>
            </h4>
          </div>
          <Image className="ml-auto mx-1" src={example.image} size={20} />
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
            <CardText>
              {Array.isArray(example.description)
                ? example.description.map((d, idx) => (
                    <p key={`example-${example.title}-desc-${idx}`}>{d}</p>
                  ))
                : example.description}
            </CardText>
          </div>
        </div>
      </div>
    </div>
  );
}
