import { useCallback, useEffect, useState } from "react";

import { restoreItem, storeItem, removeItem } from "./storage";

/**
 * The parts of a profile this app owns, as opposed to the parts the sign-in
 * provider owns.
 *
 * An OIDC id_token is an assertion about who someone is, issued and signed by
 * the identity provider — nothing here can change what it says. Writing back to
 * the provider takes the Auth0 Management API, which needs an access token for
 * an API audience that this application cannot currently obtain. So what a
 * person adjusts about themselves is kept beside the token rather than in it,
 * and read as an override of the matching claim.
 *
 * The distinction survives a move to the Management API: even then only some
 * claims are writable, and `user_metadata` is exactly this shape of thing. When
 * that route opens, `loadProfile`/`saveProfile` are what changes — everything
 * reading a profile keeps working.
 */
export type UserProfile = {
  /** Shown in place of the token's `nickname`, and the source of the initials
   *  on the avatar. */
  displayName?: string;
  /** Shown in place of the token's `picture`. */
  avatarUrl?: string;
  /** Free text the person writes about themselves; unused by the app, kept so
   *  a profile is worth filling in before anything consumes it. */
  bio?: string;
};

export const EMPTY_PROFILE: UserProfile = {};

/**
 * Where one user's profile lives.
 *
 * Keyed by the token's `sub`, so two accounts used from the same browser do not
 * read each other's profile and signing out leaves nothing that the next person
 * to sign in inherits.
 */
function keyOf(userId: string): string {
  return `hkp.profile.${userId}`;
}

/** The stored profile for a user, or an empty one when nothing is stored. */
export function loadProfile(userId?: string): UserProfile {
  if (!userId) {
    return EMPTY_PROFILE;
  }
  const raw = restoreItem(keyOf(userId));
  if (!raw) {
    return EMPTY_PROFILE;
  }
  try {
    const parsed = JSON.parse(raw);
    // Anything but an object is somebody else's key, or a half-written value;
    // treat it as no profile rather than letting it reach the fields.
    return parsed && typeof parsed === "object" ? (parsed as UserProfile) : EMPTY_PROFILE;
  } catch {
    return EMPTY_PROFILE;
  }
}

/** Stores a profile, dropping the fields that were left blank so a cleared
 *  field reads as absent rather than as an empty override. */
export function saveProfile(userId: string, profile: UserProfile): UserProfile {
  const trimmed: UserProfile = {};
  for (const [field, value] of Object.entries(profile)) {
    const text = typeof value === "string" ? value.trim() : value;
    if (text) {
      trimmed[field as keyof UserProfile] = text as string;
    }
  }
  if (Object.keys(trimmed).length === 0) {
    removeItem(keyOf(userId));
  } else {
    storeItem(keyOf(userId), JSON.stringify(trimmed));
  }
  notify(userId, trimmed);
  return trimmed;
}

// Every view showing a name or an avatar has to follow an edit made in the
// profile page, including the ones already mounted in this tab. `storage` fires
// only in *other* tabs, so changes are announced here as well.
type Listener = (profile: UserProfile) => void;
const listeners = new Map<string, Set<Listener>>();

function notify(userId: string, profile: UserProfile): void {
  listeners.get(userId)?.forEach((listener) => listener(profile));
}

function subscribe(userId: string, listener: Listener): () => void {
  const forUser = listeners.get(userId) ?? new Set<Listener>();
  forUser.add(listener);
  listeners.set(userId, forUser);
  return () => {
    forUser.delete(listener);
  };
}

/**
 * The stored profile of the given user, following edits made anywhere in this
 * tab and in other tabs of the same browser.
 */
export function useUserProfile(userId?: string): UserProfile {
  const [profile, setProfile] = useState<UserProfile>(() => loadProfile(userId));

  useEffect(() => {
    setProfile(loadProfile(userId));
    if (!userId) {
      return;
    }
    const unsubscribe = subscribe(userId, setProfile);
    const onStorage = (event: StorageEvent) => {
      if (event.key === keyOf(userId)) {
        setProfile(loadProfile(userId));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
  }, [userId]);

  return profile;
}

/** The stored profile plus a setter that persists it. Blank fields are dropped,
 *  so the returned profile is what was actually stored. */
export function useEditableUserProfile(
  userId?: string,
): [UserProfile, (profile: UserProfile) => void] {
  const profile = useUserProfile(userId);
  const save = useCallback(
    (next: UserProfile) => {
      if (userId) {
        saveProfile(userId, next);
      }
    },
    [userId],
  );
  return [profile, save];
}
