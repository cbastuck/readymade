import moment from "moment";

export function setCookie(
  key: string,
  value: string,
  expCount: number | undefined = undefined,
  expUnit: moment.unitOfTime.DurationConstructor | undefined = undefined
): void {
  if (value) {
    const exp =
      expCount && expUnit && moment.utc().add(expCount, expUnit).toString();
    const cookie = `${key}=${value}; ${exp ? `expires=${exp}` : ""}`;
    document.cookie = cookie;
  }
}

export function getCookie(key: string): string | undefined {
  const cookies = document.cookie.split(";").reduce<Record<string, string>>(
    (acc, kv) => {
      if (!kv) {
        return acc;
      }
      const [cookieKey, value] = kv.split("=");
      return cookieKey && value ? { ...acc, [cookieKey.trim()]: value } : acc;
    },
    {}
  );
  return cookies[key];
}

export function removeCookie(key: string): void {
  setCookie(key, "", -100, "y");
}

export function storeItem(key: string, value: string): void {
  localStorage.setItem(key, value);
}

export function restoreItem(key: string): string | null {
  return localStorage.getItem(key);
}

export function removeItem(key: string): void {
  return localStorage.removeItem(key);
}

export function popItem(key: string): string | null {
  const value = restoreItem(key);
  removeItem(key);
  return value;
}
