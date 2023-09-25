import {
  useParams,
  useLocation,
  useNavigate,
  NavigateFunction,
  Location,
} from "react-router-dom";

export function isTouchDevice() {
  return "ontouchstart" in window;
}

export type WithRouterProps = {
  match: {
    params: { [key: string]: string | undefined };
  };
  location: Location;
  navigate: NavigateFunction;
};

export function withRouter(WrappedComponent: any) {
  return (props: any) => {
    const navigate = useNavigate();
    return (
      <WrappedComponent
        {...props}
        match={{ params: { ...useParams() } }}
        location={{ ...useLocation() }}
        navigate={navigate}
      />
    );
  };
}
