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

/**
 * Every claim in an id_token, without judging whether the token is still valid.
 *
 * `processToken` is the session path and refuses an expired token, because a
 * session must not be restored from one. Showing an account is the other case:
 * what the token says about a person stays true after it expires, and a page
 * that renders nothing but a decoding error is a worse answer than the identity
 * plus the fact that the session has run out.
 */
export function claimsOf(idToken?: string): JwtPayload & Record<string, any> {
  if (!idToken) {
    return {};
  }
  try {
    return jwtDecode<JwtPayload & Record<string, any>>(idToken);
  } catch {
    return {};
  }
}
