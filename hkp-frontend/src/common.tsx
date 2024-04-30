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

export async function hashString(message: string) {
  const msgUint8 = new TextEncoder().encode(message); // encode as (utf-8) Uint8Array
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8); // hash the message
  const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(""); // convert bytes to hex string
  return hashHex;
}

export type Rect = {
  x: number;
  y: number;
};

export type Size = {
  width: string | number | undefined;
  height: string | number | undefined;
};
