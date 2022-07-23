import { useNavigate } from "react-router-dom";

export default function NavigateButton({ destination, text }) {
  const navigate = useNavigate();
  return (
    <button
      className="button"
      onClick={() => navigate(destination)}
      style={{
        fontSize: 11,
        textTransform: "uppercase",
      }}
    >
      {text}
    </button>
  );
}
