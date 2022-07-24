import { Link } from "react-router-dom";

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
          <svg
            viewBox="0 0 40 40"
            width="40"
            height="40"
            xmlns="http://www.w3.org/2000/svg"
          >
            <polygon points="10,1 4,18 19,6 1,6 16,18" fill="#464F6D40" />

            <text fontSize="7px" fontWeight="bold" fill="#464F6D" x="13" y="5">
              Updates
            </text>
          </svg>
        </Link>
      </div>
    </div>
  );
}
