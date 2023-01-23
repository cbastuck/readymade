import { useParams, useLocation, useNavigate } from "react-router-dom";

export function isTouchDevice() {
  return "ontouchstart" in window;
}

export function withRouter(Component) {
  return (props) => {
    const navigate = useNavigate();
    return (
      <Component
        {...props}
        match={{ params: { ...useParams() } }}
        location={{ ...useLocation() }}
        navigate={navigate}
      />
    );
  };
}
