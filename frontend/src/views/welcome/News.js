import { Link } from "react-router-dom";

import "./News.css";

export default function News() {
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
        <Link to="/news">
          <svg
            viewBox="0 0 30 30"
            width="30"
            height="30"
            xmlns="http://www.w3.org/2000/svg"
          >
            <polygon points="10,1 4,18 19,6 1,6 16,18" fill="#464F6D40" />

            <text fontSize="7px" fontWeight="bold" fill="#464F6D" x="13" y="5">
              News
            </text>
          </svg>
        </Link>
      </div>
    </div>
  );
}
