import { ReactNode, createContext, useContext, useMemo } from "react";

import { BoardContextState } from "hkp-frontend/src/BoardContext";

/**
 * Who the person looking at a facade is, for showing it to them.
 *
 * A board that acts on who is using it — a booking, a vote, a message with a
 * sender — has to be able to say "you are doing this as …". This is that, and
 * only that: a facade *shows* it. What a service acts on is the caller the
 * server that verified the person states (`$caller_email` in `sql`), never a
 * value a facade put into a payload, which anybody could put there.
 *
 * By default it is whoever is signed in to the app. A host that knows more —
 * a board attached through a coordinator is told what that board's member list
 * calls the person — provides it.
 */
export type FacadeIdentity = {
  /** The signed-in address. */
  email?: string;
  /**
   * What the board calls this person: on a deployed board, the name its
   * member list gives them; otherwise the account's own.
   */
  name?: string;
};

/** A reference to one of the above, written in a facade wherever a value is. */
export type FacadeUserRef = { $user: "email" | "name" };

const FacadeIdentityContext = createContext<FacadeIdentity | null>(null);

/** Says who the person is to the board being shown, where the host knows. */
export function FacadeIdentityProvider({
  identity,
  children,
}: {
  identity: FacadeIdentity | null;
  children: ReactNode;
}) {
  return (
    <FacadeIdentityContext.Provider value={identity}>
      {children}
    </FacadeIdentityContext.Provider>
  );
}

/**
 * Who the facade is being shown to: what the host said, and where it said
 * nothing, the account signed in to the app.
 */
export function useFacadeIdentity(
  boardContext: BoardContextState | null | undefined,
): FacadeIdentity {
  const provided = useContext(FacadeIdentityContext);
  const user = boardContext?.user ?? null;
  return useMemo(
    () => ({
      email: provided?.email ?? user?.email,
      name: provided?.name ?? user?.username,
    }),
    [provided?.email, provided?.name, user?.email, user?.username],
  );
}

export function isUserRef(value: unknown): value is FacadeUserRef {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { $user?: unknown }).$user === "string"
  );
}

/** What a `$user` reference stands for; nothing where it is not known. */
export function resolveUserRef(
  ref: FacadeUserRef,
  identity: FacadeIdentity | undefined,
): string | undefined {
  if (ref.$user === "email") {
    return identity?.email;
  }
  if (ref.$user === "name") {
    return identity?.name;
  }
  return undefined;
}
