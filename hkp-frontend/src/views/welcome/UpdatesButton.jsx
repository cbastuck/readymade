import { Link } from "react-router-dom";
import { Icon } from "semantic-ui-react";

import "./UpdatesButton.css";

export default function UpdatesButton() {
  return (
    <div
      style={{
        marginLeft: "200px",
      }}
    >
      <div>
        <Link to="/docs/updates">
          <div className="update-bar">
            <Icon name="star" size="large" />
            <div
              style={{
                fontSize: 14,
              }}
            >
              what's new?
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
