import { useParams, useLocation } from "react-router-dom";

export function isTouchDevice() {
  return "ontouchstart" in window;
}

export function withRouter(Component) {
  return (props) => (
    <Component
      {...props}
      match={{ params: { ...useParams() } }}
      location={{ ...useLocation() }}
    />
  );
}
