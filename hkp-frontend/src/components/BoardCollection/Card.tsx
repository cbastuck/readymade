import { Link } from "react-router-dom";
import { Image, Icon } from "semantic-ui-react";

import Description from "./Description";
import { UsecaseDescriptor } from "../../types";
import { s, t } from "../../styles";

type Props = {
  value: UsecaseDescriptor;
};
export default function CardComponent({ value: item }: Props) {
  const { url, name, description, metadata, image, repo } = item;
  return (
    <div
      className="hkp-card-border"
      style={s(t.p10, {
        letterSpacing: 1,
        minWidth: 200,
        flex: 1,
        margin: 10,
      })}
      key={`board-card-${name}`}
    >
      <div>
        {!repo ? (
          <Image
            floated="right"
            size="mini"
            src={image || "/assets/shutterstock_1196210650.png"}
            style={{ marginTop: 3 }}
          />
        ) : (
          <Image floated="right" size="mini" style={{ marginTop: 3 }}>
            <a href={repo} target="_blank" rel="noreferrer">
              <Icon size="large" name="github" />
            </a>
          </Image>
        )}
        <Link key={`board-card-link-${name}`} to={url}>
          <div style={{ marginTop: 3, textAlign: "left", color: "#4183c4" }}>
            <h1 className="hkp-fnt-family" style={t.fs14}>
              {name}
            </h1>
          </div>
          {metadata && (
            <div
              style={{
                margin: "5px 0px",
                textAlign: "left",
                fontSize: 13,
                textTransform: "capitalize",
              }}
            >
              {metadata}
            </div>
          )}
          <div className="hkp-fnt-color" style={{ marginTop: 10 }}>
            <div style={s(t.tl, t.nc)}>
              <Description name={name} description={description} />
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
