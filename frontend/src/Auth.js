import jwtDecode from 'jwt-decode';
import moment from 'moment';

export function validateToken(token) {
  if (!token || token === 'undefined') {
    return {};
  }
  const decoded = jwtDecode(token);
  const now = moment.utc();
  const exp = moment.utc(decoded.exp * 1000);
  if (now > exp) {
    return {};
  }

  return { token, decoded };
}
