import jwtDecode, { JwtPayload } from "jwt-decode";
import moment from "moment";

type ValidatedToken = any;

export function validateToken(token: string): ValidatedToken {
  if (!token || token === "undefined") {
    return {};
  }

  const decoded: JwtPayload = jwtDecode(token);
  if (!decoded.exp) {
    return {};
  }
  const now = moment.utc();
  const exp = moment.utc(decoded.exp * 1000);
  if (now > exp) {
    throw new Error("token expired");
  }

  return { token, decoded, exp };
}

export function processToken(incomingToken: string) {
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
