import jwtDecode from "jwt-decode";
import moment from "moment";

export function validateToken(token) {
  if (!token || token === "undefined") {
    return {};
  }

  const decoded = jwtDecode(token);
  const now = moment.utc();
  const exp = moment.utc(decoded.exp * 1000);
  if (now > exp) {
    throw new Error("validateToken() token expired", { cause: "TokenExpired" });
  }

  return { token, decoded, exp };
}

export function processToken(incomingToken) {
  const { token, decoded, exp } = validateToken(incomingToken);

  const { nickname, sub, features, picture, ...rest } = decoded;

  return {
    token,
    username: nickname,
    userId: sub,
    features: JSON.parse(decoded.features || "{}"),
    picture,
    exp,
    ...rest,
  };
}
