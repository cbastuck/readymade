import { IdToken, useAuth0 } from "@auth0/auth0-react";

type Props = {
  onToken: (claims: IdToken) => void;
  /**
   * Called once the Auth0 session has settled, whether or not anyone is signed
   * in — including when restoring the token failed. Callers that need
   * credentials at startup wait on this instead of polling for a user, so it
   * must fire on every terminal path or they wait forever.
   */
  onResolved?: () => void;
};

export default function RestoredUser({ onToken, onResolved }: Props) {
  const { getIdTokenClaims, isLoading, isAuthenticated, logout } = useAuth0();
  const onRestore = async () => {
    if (isLoading) {
      // Still settling — a later render reports the outcome.
      return;
    }
    if (!isAuthenticated) {
      onResolved?.();
      return;
    }

    try {
      const idToken: IdToken | undefined = await getIdTokenClaims();
      if (idToken) {
        try {
          await onToken(idToken);
        } catch (err: any) {
          if (err.message === "token expired") {
            await logout({ openUrl: false });
            throw err;
          } else {
            console.log("AppContext.updateToken() unknown error ", err);
            throw err;
          }
        }
      }
    } finally {
      onResolved?.();
    }
  };

  onRestore();
  return null;
}
