import { Link } from "react-router-dom";
import { Icon } from "semantic-ui-react";

import "./UpdatesButton.css";

export default function UpdatesButton() {
  return (
    <div
      style={{
        marginLeft: 5,
      }}
    >
      <div
        style={{
          transform: "scale(1.6)",
          transformOrigin: "center",
        }}
      >
        <Link to="/docs/updates">
          <div className="update-bar">
            <Icon name="star outline" size="mini" />
            <div style={{ fontSize: 7, marginTop: -57, marginLeft: -3 }}>
              What's new?
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
