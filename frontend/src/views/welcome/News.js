import { Link } from "react-router-dom";

export default function News() {
  return (
    <div
      style={{
        transform: "scale(2.5)",
        marginLeft: 20,
      }}
    >
      <Link to="/news">
        <svg
          viewBox="0 0 30 30"
          width="30"
          height="30"
          xmlns="http://www.w3.org/2000/svg"
        >
          <polygon points="10,1 4,18 19,6 1,6 16,18" fill="#464F6D" />
          <text
            fontSize="5px"
            fontWeight="bold"
            fill="white"
            stroke="gray"
            strokeWidth="0.2px"
            x="3"
            y="12"
          >
            NEWS
          </text>
        </svg>
      </Link>
    </div>
  );
}
